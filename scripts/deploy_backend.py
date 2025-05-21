#!/usr/bin/env python3
"""
Coneaプロジェクト バックエンドデプロイスクリプト

ステージング環境または本番環境へのバックエンドサービスの
デプロイを行うスクリプトです。
"""

import os
import sys
import json
import time
import argparse
import subprocess
import datetime
from pathlib import Path

# プロジェクトルートディレクトリ
PROJECT_ROOT = Path(__file__).parent.parent.absolute()


def parse_args():
    """コマンドライン引数の解析"""
    parser = argparse.ArgumentParser(description="Deploy Conea backend service")
    parser.add_argument("--env", default="staging", choices=["staging", "production"],
                        help="Target environment (staging or production)")
    parser.add_argument("--package", help="Path to deployment package (ZIP file)")
    parser.add_argument("--dry-run", action="store_true", help="Perform a dry run without actual deployment")
    parser.add_argument("--no-prompt", action="store_true", help="Do not prompt for confirmation")
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
            try:
                key, value = line.split("=", 1)
                env_vars[key.strip()] = value.strip()
            except ValueError:
                continue
    
    return env_vars


def setup_deployment_environment(env_name, dry_run=False):
    """デプロイ環境のセットアップ"""
    print(f"Setting up deployment environment for {env_name}...")
    
    # 環境変数の読み込み
    env_vars = load_env_file(env_name)
    
    # 必要な環境変数の確認
    required_vars = [
        "PROJECT_ID", "REGION", "SERVICE_NAME", "MEMORY", "CPU",
        "MIN_INSTANCES", "MAX_INSTANCES"
    ]
    
    # レガシー互換性のための変数マッピング
    legacy_mappings = {
        "PROJECT_ID": "SHOPIFY_MCP_PROJECT_ID",
        "SERVICE_NAME": "SHOPIFY_MCP_SERVICE_NAME",
        "SERVICE_ACCOUNT": "SHOPIFY_MCP_SERVICE_ACCOUNT"
    }
    
    # 環境変数の検証と補完
    for var in required_vars:
        if var not in env_vars:
            # レガシー名称の確認
            if var in legacy_mappings and legacy_mappings[var] in env_vars:
                env_vars[var] = env_vars[legacy_mappings[var]]
                print(f"Using legacy environment variable {legacy_mappings[var]} for {var}")
            else:
                # デフォルト値の設定
                if var == "PROJECT_ID":
                    env_vars[var] = f"conea-{env_name}"
                elif var == "REGION":
                    env_vars[var] = "asia-northeast1"
                elif var == "SERVICE_NAME":
                    env_vars[var] = f"conea-{env_name}"
                elif var == "MEMORY":
                    env_vars[var] = "2Gi"
                elif var == "CPU":
                    env_vars[var] = "2"
                elif var == "MIN_INSTANCES":
                    env_vars[var] = "1"
                elif var == "MAX_INSTANCES":
                    env_vars[var] = "5" if env_name == "production" else "3"
                print(f"Using default value for {var}: {env_vars[var]}")
    
    # サービスアカウントの設定
    if "SERVICE_ACCOUNT" not in env_vars:
        if "SHOPIFY_MCP_SERVICE_ACCOUNT" in env_vars:
            env_vars["SERVICE_ACCOUNT"] = env_vars["SHOPIFY_MCP_SERVICE_ACCOUNT"]
        else:
            env_vars["SERVICE_ACCOUNT"] = f"conea-sa@{env_vars['PROJECT_ID']}.iam.gserviceaccount.com"
    
    return env_vars


def prepare_deployment_package(package_path, env_name):
    """デプロイパッケージの準備"""
    if not package_path:
        # 最新のビルドパッケージを探す
        artifacts_dir = PROJECT_ROOT / "deploy_artifacts"
        if artifacts_dir.exists():
            zip_files = list(artifacts_dir.glob(f"conea-backend-{env_name}-*.zip"))
            if zip_files:
                # 最新のZIPファイルを選択
                latest_zip = max(zip_files, key=os.path.getmtime)
                package_path = latest_zip
                print(f"Using latest package: {package_path}")
            else:
                print(f"No deployment package found for {env_name} environment")
                return None
        else:
            print("No deploy_artifacts directory found")
            return None
    
    # 一時ディレクトリの作成
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    deploy_dir = PROJECT_ROOT / f"deploy_tmp_{timestamp}"
    deploy_dir.mkdir(exist_ok=True)
    
    # ZIPファイルの展開
    print(f"Extracting deployment package: {package_path}")
    subprocess.run(["unzip", "-q", package_path, "-d", deploy_dir], check=True)
    
    return deploy_dir


def deploy_to_cloud_run(env_vars, deploy_dir, env_name, dry_run=False):
    """Cloud Runへのデプロイ"""
    print(f"Deploying to Cloud Run ({env_name} environment)...")
    
    # プロジェクトIDの取得
    project_id = env_vars["PROJECT_ID"]
    service_name = env_vars["SERVICE_NAME"]
    region = env_vars["REGION"]
    service_account = env_vars["SERVICE_ACCOUNT"]
    memory = env_vars["MEMORY"]
    cpu = env_vars["CPU"]
    min_instances = env_vars["MIN_INSTANCES"]
    max_instances = env_vars["MAX_INSTANCES"]
    
    # 環境変数文字列の構築
    env_var_args = []
    secret_args = []
    
    # 基本的な環境変数
    env_var_args.extend([
        f"GCP_PROJECT_ID={project_id}",
        f"ENVIRONMENT={env_name}",
        f"MCP_SERVER_NAME={service_name}",
    ])
    
    # バージョン情報
    version_file = deploy_dir / "VERSION"
    if version_file.exists():
        with open(version_file, "r") as f:
            version_line = f.readline().strip()
            version = version_line.split()[-1] if version_line else "v0.3.0"
        env_var_args.append(f"MCP_SERVER_VERSION={version}")
    
    # シークレット参照
    # 注: 実際のシークレット名はGCPプロジェクトの設定に合わせて調整が必要
    secret_mappings = {
        "SHOPIFY_API_KEY": "SHOPIFY_API_KEY:latest",
        "SHOPIFY_API_SECRET": "SHOPIFY_API_SECRET:latest",
        "SESSION_SECRET": "SESSION_SECRET:latest",
        "JWT_SECRET": "JWT_SECRET:latest",
        "API_KEY_OPENAI": "API_KEY_OPENAI:latest",
        "API_KEY_ANTHROPIC": "API_KEY_ANTHROPIC:latest",
        "API_KEY_GEMINI": "API_KEY_GEMINI:latest"
    }
    
    for secret_env, secret_ref in secret_mappings.items():
        if secret_env in env_vars:
            secret_args.append(f"{secret_env}={secret_ref}")
    
    # Dockerfileのパス
    dockerfile_path = deploy_dir / "Dockerfile"
    if not dockerfile_path.exists():
        print("Error: Dockerfile not found in deployment package")
        return False
    
    # サービスアカウントの存在確認
    if not dry_run:
        try:
            print(f"Checking service account: {service_account}")
            check_result = subprocess.run(
                ["gcloud", "iam", "service-accounts", "describe", service_account, 
                 f"--project={project_id}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            if check_result.returncode != 0:
                print(f"Service account {service_account} does not exist. Creating...")
                # サービスアカウント名（@の前の部分）
                sa_name = service_account.split("@")[0]
                
                # サービスアカウント作成
                subprocess.run(
                    ["gcloud", "iam", "service-accounts", "create", sa_name,
                     "--display-name=Conea Service Account",
                     f"--project={project_id}"],
                    check=True
                )
                
                # 必要な権限付与
                # 例: Secret Managerへのアクセス権
                subprocess.run(
                    ["gcloud", "projects", "add-iam-policy-binding", project_id,
                     f"--member=serviceAccount:{service_account}",
                     "--role=roles/secretmanager.secretAccessor"],
                    check=True
                )
                
                print(f"Service account {service_account} created successfully")
        except subprocess.CalledProcessError as e:
            print(f"Error checking/creating service account: {e}")
            return False
    
    # コンテナイメージのビルドとデプロイ
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    image_name = f"{region}-docker.pkg.dev/{project_id}/conea-repo/{service_name}:{timestamp}"
    
    # リポジトリの存在確認
    if not dry_run:
        try:
            print("Checking Docker repository...")
            check_result = subprocess.run(
                ["gcloud", "artifacts", "repositories", "describe", "conea-repo",
                 f"--location={region}", f"--project={project_id}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            if check_result.returncode != 0:
                print("Docker repository does not exist. Creating...")
                subprocess.run(
                    ["gcloud", "artifacts", "repositories", "create", "conea-repo",
                     "--repository-format=docker",
                     f"--location={region}",
                     f"--project={project_id}",
                     "--description=Conea Docker Repository"],
                    check=True
                )
                print("Docker repository created successfully")
        except subprocess.CalledProcessError as e:
            print(f"Error checking/creating Docker repository: {e}")
            return False
    
    if not dry_run:
        try:
            # Docker認証設定
            print("Configuring Docker authentication...")
            subprocess.run(
                ["gcloud", "auth", "configure-docker", f"{region}-docker.pkg.dev"],
                check=True
            )
            
            # イメージのビルド
            print(f"Building Docker image: {image_name}")
            build_date = datetime.datetime.now().isoformat()
            subprocess.run(
                ["docker", "build",
                 "-t", image_name,
                 "--build-arg", f"BUILD_DATE={build_date}",
                 "--build-arg", f"VERSION={version}",
                 "--build-arg", f"ENVIRONMENT={env_name}",
                 "."],
                cwd=deploy_dir,
                check=True
            )
            
            # イメージのプッシュ
            print(f"Pushing Docker image: {image_name}")
            subprocess.run(
                ["docker", "push", image_name],
                check=True
            )
            
            # Cloud Runにデプロイ
            print(f"Deploying to Cloud Run: {service_name}")
            
            deploy_cmd = [
                "gcloud", "run", "deploy", service_name,
                f"--image={image_name}",
                f"--region={region}",
                f"--project={project_id}",
                "--platform=managed",
                f"--service-account={service_account}",
                f"--memory={memory}",
                f"--cpu={cpu}",
                f"--min-instances={min_instances}",
                f"--max-instances={max_instances}",
                "--concurrency=80",
                "--timeout=300s",
                "--ingress=all",
                "--allow-unauthenticated"
            ]
            
            # 環境変数の追加
            if env_var_args:
                env_var_str = ",".join(env_var_args)
                deploy_cmd.append(f"--set-env-vars={env_var_str}")
            
            # シークレットの追加
            if secret_args:
                secret_str = ",".join(secret_args)
                deploy_cmd.append(f"--set-secrets={secret_str}")
            
            subprocess.run(deploy_cmd, check=True)
            
            # サービスURLの取得
            service_url_result = subprocess.run(
                ["gcloud", "run", "services", "describe", service_name,
                 f"--region={region}", f"--project={project_id}",
                 "--format=value(status.url)"],
                stdout=subprocess.PIPE,
                text=True,
                check=True
            )
            
            service_url = service_url_result.stdout.strip()
            print(f"Deployment successful! Service URL: {service_url}")
            
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"Error during deployment: {e}")
            return False
    else:
        # ドライラン: コマンドを表示するだけ
        print("\nDry run mode: Would execute the following commands:")
        print(f"1. Build Docker image: docker build -t {image_name} ...")
        print(f"2. Push Docker image: docker push {image_name}")
        print(f"3. Deploy to Cloud Run: gcloud run deploy {service_name} --image={image_name} ...")
        print("   Environment variables:")
        for env_var in env_var_args:
            print(f"   - {env_var}")
        print("   Secrets:")
        for secret in secret_args:
            print(f"   - {secret}")
        return True


def verify_deployment(env_vars, env_name, dry_run=False):
    """デプロイの検証"""
    if dry_run:
        print("\nDry run mode: Would verify deployment...")
        return True
    
    print(f"Verifying deployment ({env_name} environment)...")
    
    # サービス情報の取得
    project_id = env_vars["PROJECT_ID"]
    service_name = env_vars["SERVICE_NAME"]
    region = env_vars["REGION"]
    
    try:
        # サービスURLの取得
        service_url_result = subprocess.run(
            ["gcloud", "run", "services", "describe", service_name,
             f"--region={region}", f"--project={project_id}",
             "--format=value(status.url)"],
            stdout=subprocess.PIPE,
            text=True,
            check=True
        )
        
        service_url = service_url_result.stdout.strip()
        print(f"Service URL: {service_url}")
        
        # ヘルスエンドポイントへのリクエスト
        print("Checking service health...")
        time.sleep(5)  # サービスの起動を待つ
        
        health_check = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"{service_url}/health"],
            stdout=subprocess.PIPE,
            text=True
        )
        
        if health_check.stdout.strip() == "200":
            print("Health check passed!")
        else:
            print(f"Health check failed. Status code: {health_check.stdout}")
            return False
        
        # サーバー情報の取得
        info_check = subprocess.run(
            ["curl", "-s", f"{service_url}/health/info"],
            stdout=subprocess.PIPE,
            text=True
        )
        
        try:
            info = json.loads(info_check.stdout)
            print(f"Server version: {info.get('version', 'unknown')}")
            print(f"Environment: {info.get('environment', 'unknown')}")
        except json.JSONDecodeError:
            print("Warning: Could not parse server info")
        
        print("Deployment verification complete!")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"Error verifying deployment: {e}")
        return False


def cleanup(deploy_dir):
    """一時ファイルのクリーンアップ"""
    if deploy_dir and deploy_dir.exists():
        import shutil
        print(f"Cleaning up temporary directory: {deploy_dir}")
        shutil.rmtree(deploy_dir)


def main(args):
    """メイン処理"""
    env_name = args.env.lower()
    dry_run = args.dry_run
    no_prompt = args.no_prompt
    
    print(f"Preparing to deploy Conea backend to {env_name} environment")
    print(f"Dry run: {dry_run}")
    
    # 環境のセットアップ
    env_vars = setup_deployment_environment(env_name, dry_run)
    
    # 設定情報の表示
    print("\nDeployment Configuration:")
    print(f"- Project ID: {env_vars['PROJECT_ID']}")
    print(f"- Region: {env_vars['REGION']}")
    print(f"- Service Name: {env_vars['SERVICE_NAME']}")
    print(f"- Service Account: {env_vars['SERVICE_ACCOUNT']}")
    print(f"- Memory: {env_vars['MEMORY']}")
    print(f"- CPU: {env_vars['CPU']}")
    print(f"- Min Instances: {env_vars['MIN_INSTANCES']}")
    print(f"- Max Instances: {env_vars['MAX_INSTANCES']}")
    
    # 確認プロンプト
    if not no_prompt and not dry_run:
        confirmation = input("\nContinue with deployment? (y/n): ")
        if confirmation.lower() != "y":
            print("Deployment cancelled")
            return 1
    
    # デプロイパッケージの準備
    deploy_dir = prepare_deployment_package(args.package, env_name)
    if not deploy_dir:
        print("Error: Could not prepare deployment package")
        return 1
    
    try:
        # Cloud Runへのデプロイ
        if deploy_to_cloud_run(env_vars, deploy_dir, env_name, dry_run):
            # デプロイの検証
            if verify_deployment(env_vars, env_name, dry_run):
                print("\n✅ Deployment completed successfully!")
                return 0
            else:
                print("\n❌ Deployment verification failed")
                return 1
        else:
            print("\n❌ Deployment failed")
            return 1
    finally:
        # クリーンアップ
        cleanup(deploy_dir)


if __name__ == "__main__":
    args = parse_args()
    sys.exit(main(args))