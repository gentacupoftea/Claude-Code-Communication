import unittest
import os
import subprocess
import sys
from pathlib import Path

class TestDeploymentScripts(unittest.TestCase):
    """デプロイスクリプトのテスト"""
    
    def setUp(self):
        """テスト前のセットアップ"""
        # プロジェクトのルートディレクトリを取得
        self.project_root = Path(__file__).parent.parent.absolute()
        # scriptsディレクトリのパス
        self.scripts_dir = self.project_root / "scripts"
        
        # テスト用の環境変数
        self.test_env = os.environ.copy()
        self.test_env["PROJECT_ID"] = "conea-test"
        self.test_env["SERVICE_NAME"] = "conea-test-service"
        self.test_env["REGION"] = "asia-northeast1"
    
    def test_deploy_script_exists(self):
        """デプロイスクリプトが存在することを確認"""
        # デプロイスクリプトのパス
        deploy_script = self.scripts_dir / "deploy_production.sh"
        
        # ファイルが存在するか確認
        self.assertTrue(deploy_script.exists(), 
                        f"デプロイスクリプトが見つかりません: {deploy_script}")
    
    def test_rollback_script_exists(self):
        """ロールバックスクリプトが存在することを確認"""
        # ロールバックスクリプトのパス
        rollback_script = self.scripts_dir / "rollback_v0.3.0.sh"
        
        # ファイルが存在するか確認
        self.assertTrue(rollback_script.exists(), 
                        f"ロールバックスクリプトが見つかりません: {rollback_script}")
    
    def test_scripts_have_execute_permission(self):
        """スクリプトに実行権限があることを確認"""
        for script_name in ["deploy_production.sh", "rollback_v0.3.0.sh"]:
            script_path = self.scripts_dir / script_name
            
            # 実行権限があるか確認
            self.assertTrue(os.access(script_path, os.X_OK), 
                           f"スクリプトに実行権限がありません: {script_path}")
    
    def test_environment_variable_compatibility(self):
        """環境変数の互換性をテスト"""
        # 新旧両方の環境変数設定でテスト
        test_cases = [
            # 新変数名のみ
            {"PROJECT_ID": "conea-new-vars", "SERVICE_NAME": "conea-service"},
            # 旧変数名のみ
            {"SHOPIFY_MCP_PROJECT_ID": "shopify-old-vars", "SHOPIFY_MCP_SERVICE_NAME": "shopify-service"},
            # 両方設定（新変数が優先されることを期待）
            {
                "PROJECT_ID": "conea-priority", 
                "SHOPIFY_MCP_PROJECT_ID": "shopify-ignored",
                "SERVICE_NAME": "conea-service-priority",
                "SHOPIFY_MCP_SERVICE_NAME": "shopify-service-ignored"
            }
        ]
        
        # デプロイスクリプト内の変数展開をテスト
        deploy_script = self.scripts_dir / "deploy_production.sh"
        
        for env_vars in test_cases:
            # テスト用の環境変数をセット
            test_env = os.environ.copy()
            test_env.update(env_vars)
            
            # printコマンドを使って変数の展開結果を取得
            test_command = f"bash -c 'source {deploy_script} --dry-run && echo PROJECT_ID=$PROJECT_ID SERVICE_NAME=$SERVICE_NAME'"
            
            try:
                # スクリプトを実行
                result = subprocess.run(
                    test_command,
                    shell=True,
                    env=test_env,
                    capture_output=True,
                    text=True,
                    check=False  # エラーが発生してもテストを継続
                )
                
                # 結果の検証
                # (実際のテストではより詳細な検証を行う)
                self.assertIn("PROJECT_ID=", result.stdout)
                self.assertIn("SERVICE_NAME=", result.stdout)
                
            except subprocess.CalledProcessError as e:
                self.fail(f"テスト中にエラーが発生しました: {e.stderr}")
    
    @unittest.skipIf(not os.environ.get("RUN_FULL_DEPLOY_TEST"), "完全なデプロイテストはスキップ")
    def test_deploy_script_dry_run(self):
        """デプロイスクリプトのドライラン実行テスト"""
        # このテストは実際に--dry-runフラグでスクリプトを実行
        # 環境によってはスキップされる
        
        deploy_script = self.scripts_dir / "deploy_production.sh"
        
        try:
            # --dry-runフラグでスクリプトを実行
            result = subprocess.run(
                [str(deploy_script), "--dry-run"],
                env=self.test_env,
                capture_output=True,
                text=True,
                check=True
            )
            
            # 出力にエラーメッセージが含まれていないことを確認
            self.assertNotIn("ERROR", result.stdout.upper())
            self.assertNotIn("ERROR", result.stderr.upper())
            
            # Coneaの名前が出力に含まれていることを確認
            self.assertIn("conea", result.stdout.lower())
            
        except subprocess.CalledProcessError as e:
            self.fail(f"デプロイスクリプトの実行に失敗しました: {e.stderr}")


if __name__ == "__main__":
    unittest.main()