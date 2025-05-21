#!/usr/bin/env python3
"""
コアパッケージリネーム（shopify-mcp-server → conea）の検証テスト

このテストモジュールは、パッケージ名の変更が正しく行われていることを検証します。
検証内容：
1. インポートパスの一貫性
2. 後方互換性レイヤーの動作確認
3. 設定ファイルでの名称参照
4. 環境変数の互換性
"""

import os
import sys
import importlib
import unittest
import warnings
import glob
import re


class PackageRenameTests(unittest.TestCase):
    """パッケージリネームに関するテストケース"""

    def setUp(self):
        """テスト前の準備"""
        warnings.filterwarnings("ignore", category=DeprecationWarning)
        # 現在のプロジェクトルートへのパスを取得
        self.project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))

    def test_import_conea_package(self):
        """新しいパッケージ名 'conea' がインポート可能であることを検証"""
        try:
            import conea
            self.assertIsNotNone(conea)
            self.assertIsNotNone(conea.__version__)
            print(f"Conea package version: {conea.__version__}")
        except ImportError:
            self.fail("Failed to import 'conea' package")

    def test_backward_compatibility_import(self):
        """後方互換性のためのレガシー名前空間 'shopify_mcp_server' のインポート検証"""
        try:
            with warnings.catch_warnings(record=True) as w:
                import shopify_mcp_server
                
                # 非推奨警告が発生していることを確認
                self.assertTrue(any(issubclass(warning.category, DeprecationWarning) for warning in w))
                self.assertIsNotNone(shopify_mcp_server)
        except ImportError:
            self.fail("Backward compatibility import of 'shopify_mcp_server' failed")

    def test_no_hardcoded_old_imports(self):
        """プロジェクト内のPythonファイルに古いインポートパスが残っていないことを検証"""
        python_files = glob.glob(os.path.join(self.project_root, "**", "*.py"), recursive=True)
        errors = []

        for file_path in python_files:
            # 後方互換性モジュールとテストファイルは除外
            if "__init__.py" in file_path or "compat.py" in file_path or "/tests/rename/" in file_path:
                continue

            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                # 'import shopify_mcp_server' または 'from shopify_mcp_server' のパターンを検索
                if re.search(r'^\s*import\s+shopify_mcp_server', content, re.MULTILINE) or \
                   re.search(r'^\s*from\s+shopify_mcp_server', content, re.MULTILINE):
                    relative_path = os.path.relpath(file_path, self.project_root)
                    errors.append(f"Old import found in {relative_path}")

        self.assertEqual(len(errors), 0, f"Found old imports in {len(errors)} files:\n" + "\n".join(errors))

    def test_config_files_updated(self):
        """設定ファイルが新しいパッケージ名を使用していることを検証"""
        config_files = [
            os.path.join(self.project_root, "setup.py"),
            os.path.join(self.project_root, "requirements.txt"),
            os.path.join(self.project_root, "Dockerfile"),
            os.path.join(self.project_root, "docker-compose.yml")
        ]
        
        errors = []
        for file_path in config_files:
            if not os.path.exists(file_path):
                continue
                
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                # 'shopify-mcp-server' または 'shopify_mcp_server' という文字列を検索
                # コメント行や互換性のための参照は除外
                lines = content.split("\n")
                for i, line in enumerate(lines):
                    if ("shopify-mcp-server" in line or "shopify_mcp_server" in line) and \
                       not line.strip().startswith("#") and \
                       "compat" not in line and \
                       "legacy" not in line and \
                       "backward" not in line:
                        relative_path = os.path.relpath(file_path, self.project_root)
                        errors.append(f"{relative_path}:{i+1}: {line.strip()}")
        
        self.assertEqual(len(errors), 0, f"Found old package names in {len(errors)} config lines:\n" + "\n".join(errors))

    def test_environment_variables_compatibility(self):
        """環境変数の互換性レイヤーを検証"""
        # 新しい環境変数と旧環境変数のマッピングを定義
        env_var_pairs = [
            ("PROJECT_ID", "SHOPIFY_MCP_PROJECT_ID"),
            ("SERVICE_NAME", "SHOPIFY_MCP_SERVICE_NAME"),
            ("SERVICE_ACCOUNT", "SHOPIFY_MCP_SERVICE_ACCOUNT")
        ]
        
        for new_var, old_var in env_var_pairs:
            # テスト用に環境変数を設定
            test_value = f"test_value_for_{new_var}"
            os.environ[old_var] = test_value
            
            # 互換性レイヤーをインポート
            from conea.compat import environment as env_compat
            
            # 古い環境変数で設定した値が新しい名前で取得できることを確認
            self.assertEqual(env_compat.get_env_var(new_var), test_value)
            
            # テスト後に環境変数をクリア
            del os.environ[old_var]

    def test_deployment_scripts_compatibility(self):
        """デプロイスクリプトの互換性を検証"""
        # デプロイスクリプトのパス
        deploy_script = os.path.join(self.project_root, "scripts", "deploy_production.sh")
        rollback_script = os.path.join(self.project_root, "scripts", "rollback_v0.3.0.sh")
        
        # 両方のスクリプトが存在するかチェック
        self.assertTrue(os.path.exists(deploy_script), "Production deployment script not found")
        self.assertTrue(os.path.exists(rollback_script), "Rollback script not found")
        
        # スクリプト内に互換性コードが含まれていることを確認
        scripts_to_check = [deploy_script, rollback_script]
        for script in scripts_to_check:
            with open(script, "r", encoding="utf-8") as f:
                content = f.read()
                # 互換性のための環境変数処理を検索
                self.assertTrue("SHOPIFY_MCP_PROJECT_ID" in content, 
                               f"Legacy environment variable support not found in {os.path.basename(script)}")
                # 新しい変数名を使用していることを確認
                self.assertTrue("conea" in content.lower(), 
                               f"New package name not found in {os.path.basename(script)}")


if __name__ == "__main__":
    unittest.main()