#!/usr/bin/env python3
"""
Coneaプロジェクト デプロイパッケージビルドスクリプト

バックエンドサービスまたはフロントエンドアプリケーションの
デプロイパッケージを構築するスクリプトです。
"""

import os
import sys
import json
import shutil
import argparse
import subprocess
import datetime
import re
from pathlib import Path

# 現在の時刻を取得
TIMESTAMP = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

# プロジェクトルートディレクトリ
PROJECT_ROOT = Path(__file__).parent.parent.absolute()

# デプロイ成果物ディレクトリ
ARTIFACTS_DIR = PROJECT_ROOT / "deploy_artifacts"


def parse_args():
    """コマンドライン引数の解析"""
    parser = argparse.ArgumentParser(description="Build deployment package for Conea")
    parser.add_argument("--backend", action="store_true", help="Build backend deployment package")
    parser.add_argument("--frontend", action="store_true", help="Build frontend deployment package")
    parser.add_argument("--env", default="staging", choices=["staging", "production"],
                        help="Target environment (staging or production)")
    parser.add_argument("--output-dir", help="Output directory for artifacts")
    parser.add_argument("--version", help="Version to tag the build with (default: date-based)")
    return parser.parse_args()


def load_env_file(env_name):
    """環境変数ファイルを読み込む"""
    env_file = PROJECT_ROOT / f".env.{env_name}"
    if not env_file.exists():
        print(f"Warning: .env.{env_name} not found, falling back to .env")
        env_file = PROJECT_ROOT / ".env"
        if not env_file.exists():
            print("Error: No environment file found")
            sys.exit(1)
    
    env_vars = {}
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, value = line.split("=", 1)
            env_vars[key.strip()] = value.strip()
    
    return env_vars


def prepare_build_directory(build_type, env_name, version):
    """ビルドディレクトリを準備する"""
    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        output_dir = ARTIFACTS_DIR / f"{build_type}_{env_name}_{version}"
    
    # ディレクトリがすでに存在する場合はクリーンアップ
    if output_dir.exists():
        shutil.rmtree(output_dir)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def build_backend_package(env_name, version, output_dir):
    """バックエンドデプロイパッケージのビルド"""
    print(f"Building backend package for {env_name} environment (version: {version})...")
    
    # 依存関係ファイルのコピー
    shutil.copy(PROJECT_ROOT / "requirements.txt", output_dir / "requirements.txt")
    
    # セットアップファイルのコピー
    if (PROJECT_ROOT / "setup.py").exists():
        shutil.copy(PROJECT_ROOT / "setup.py", output_dir / "setup.py")
    
    # 環境設定ファイルのコピー
    env_file = PROJECT_ROOT / f".env.{env_name}"
    if env_file.exists():
        shutil.copy(env_file, output_dir / ".env")
    
    # Dockerfileのコピー
    if (PROJECT_ROOT / "Dockerfile").exists():
        shutil.copy(PROJECT_ROOT / "Dockerfile", output_dir / "Dockerfile")
    
    # ソースコードのコピー（ディレクトリ構造によって調整が必要）
    source_dirs = ["src", "conea", "shopify_mcp_server"]
    for dir_name in source_dirs:
        src_dir = PROJECT_ROOT / dir_name
        if src_dir.exists() and src_dir.is_dir():
            dest_dir = output_dir / dir_name
            shutil.copytree(src_dir, dest_dir, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo"))
    
    # スクリプトディレクトリのコピー（デプロイスクリプトのみ）
    scripts_dir = output_dir / "scripts"
    scripts_dir.mkdir(exist_ok=True)
    for script in ["deploy_production.sh", "rollback_v0.3.0.sh"]:
        script_path = PROJECT_ROOT / "scripts" / script
        if script_path.exists():
            shutil.copy(script_path, scripts_dir / script)
            # 実行権限の設定
            os.chmod(scripts_dir / script, 0o755)
    
    # バージョン情報ファイルの作成
    with open(output_dir / "VERSION", "w") as f:
        f.write(f"Conea Backend {version}\n")
        f.write(f"Build timestamp: {datetime.datetime.now().isoformat()}\n")
        f.write(f"Environment: {env_name}\n")
    
    # パッケージング（ZIPファイル作成）
    zip_filename = f"conea-backend-{env_name}-{version}.zip"
    shutil.make_archive(
        output_dir.parent / zip_filename.replace(".zip", ""),
        'zip',
        output_dir
    )
    
    print(f"Backend package built successfully: {output_dir.parent / zip_filename}")
    return output_dir.parent / zip_filename


def build_frontend_package(env_name, version, output_dir):
    """フロントエンドデプロイパッケージのビルド"""
    print(f"Building frontend package for {env_name} environment (version: {version})...")
    
    frontend_dir = PROJECT_ROOT / "frontend"
    if not frontend_dir.exists():
        print("Error: Frontend directory not found")
        sys.exit(1)
    
    # 設定ファイルの調整（環境に応じた設定）
    env_vars = load_env_file(env_name)
    
    # 環境変数をフロントエンド用の設定ファイルに変換
    frontend_config = {
        "apiUrl": env_vars.get("API_URL", f"https://{env_name}.conea.ai/api"),
        "environment": env_name,
        "version": version
    }
    
    # 設定ファイルの書き込み
    with open(frontend_dir / "src" / "config.json", "w") as f:
        json.dump(frontend_config, f, indent=2)
    
    # フロントエンドビルドコマンド
    build_cmd = f"npm run build:{env_name}"
    
    # 現在のディレクトリを保存
    current_dir = os.getcwd()
    
    try:
        # フロントエンドディレクトリに移動
        os.chdir(frontend_dir)
        
        # 依存関係のインストール
        print("Installing frontend dependencies...")
        subprocess.run(["npm", "ci"], check=True)
        
        # ビルド実行
        print(f"Running frontend build for {env_name}...")
        subprocess.run(build_cmd.split(), check=True)
        
        # ビルド成果物のコピー
        build_output = frontend_dir / "build"
        if build_output.exists():
            shutil.copytree(build_output, output_dir / "build", dirs_exist_ok=True)
        else:
            print("Warning: Frontend build output directory not found")
        
        # package.jsonのコピー
        shutil.copy(frontend_dir / "package.json", output_dir / "package.json")
        
        # バージョン情報ファイルの作成
        with open(output_dir / "VERSION", "w") as f:
            f.write(f"Conea Frontend {version}\n")
            f.write(f"Build timestamp: {datetime.datetime.now().isoformat()}\n")
            f.write(f"Environment: {env_name}\n")
        
        # パッケージング（ZIPファイル作成）
        zip_filename = f"conea-frontend-{env_name}-{version}.zip"
        shutil.make_archive(
            output_dir.parent / zip_filename.replace(".zip", ""),
            'zip',
            output_dir
        )
        
        print(f"Frontend package built successfully: {output_dir.parent / zip_filename}")
        return output_dir.parent / zip_filename
        
    finally:
        # 元のディレクトリに戻る
        os.chdir(current_dir)


def main(args):
    """メイン処理"""
    # バージョン番号の決定
    version = args.version or f"v0.3.0-{TIMESTAMP}"
    
    # 環境名の確認
    env_name = args.env.lower()
    if env_name not in ["staging", "production"]:
        print(f"Error: Invalid environment '{env_name}'")
        sys.exit(1)
    
    # ビルドタイプの確認
    build_backend = args.backend
    build_frontend = args.frontend
    
    # デフォルトでは両方ビルド
    if not build_backend and not build_frontend:
        build_backend = True
        build_frontend = True
    
    # 結果の格納用
    results = []
    
    # バックエンドパッケージのビルド
    if build_backend:
        output_dir = prepare_build_directory("backend", env_name, version)
        backend_package = build_backend_package(env_name, version, output_dir)
        results.append(("Backend", backend_package))
    
    # フロントエンドパッケージのビルド
    if build_frontend:
        output_dir = prepare_build_directory("frontend", env_name, version)
        frontend_package = build_frontend_package(env_name, version, output_dir)
        results.append(("Frontend", frontend_package))
    
    # 結果の表示
    print("\nBuild Summary:")
    print("-------------")
    for build_type, package_path in results:
        print(f"{build_type}: {package_path}")
    
    return 0


if __name__ == "__main__":
    args = parse_args()
    sys.exit(main(args))