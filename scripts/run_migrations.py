#!/usr/bin/env python3
"""
Coneaプロジェクト データベースマイグレーション実行スクリプト

ステージング環境または本番環境のデータベースに
マイグレーションを適用するスクリプトです。
"""

import os
import sys
import argparse
import subprocess
import datetime
from pathlib import Path

# プロジェクトルートディレクトリ
PROJECT_ROOT = Path(__file__).parent.parent.absolute()


def parse_args():
    """コマンドライン引数の解析"""
    parser = argparse.ArgumentParser(description="Run database migrations for Conea")
    parser.add_argument("--env", default="staging", choices=["staging", "production"],
                        help="Target environment (staging or production)")
    parser.add_argument("--dry-run", action="store_true", help="Show migrations without applying them")
    parser.add_argument("--no-backup", action="store_true", help="Skip database backup before migration")
    parser.add_argument("--migration-dir", help="Directory containing migration files (default: migrations)")
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


def setup_database_connection(env_name):
    """データベース接続情報の設定"""
    print(f"Setting up database connection for {env_name}...")
    
    # 環境変数の読み込み
    env_vars = load_env_file(env_name)
    
    # データベース接続情報
    db_info = {
        "host": env_vars.get("DB_HOST", f"staging-db.conea.internal" if env_name == "staging" else "prod-db.conea.internal"),
        "port": env_vars.get("DB_PORT", "5432"),
        "user": env_vars.get("DB_USER", f"conea_{env_name}_user"),
        "password": env_vars.get("DB_PASSWORD", ""),
        "database": env_vars.get("DB_NAME", f"conea_{env_name}")
    }
    
    if not db_info["password"]:
        print("Warning: Database password not found in environment variables")
    
    return db_info


def backup_database(db_info, env_name):
    """データベースのバックアップを作成"""
    print(f"Creating database backup for {env_name}...")
    
    # バックアップ用ディレクトリの作成
    backup_dir = PROJECT_ROOT / "db_backups"
    backup_dir.mkdir(exist_ok=True)
    
    # バックアップファイル名の生成
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = backup_dir / f"{env_name}_db_backup_{timestamp}.sql"
    
    # pg_dumpコマンドの実行
    pg_dump_cmd = [
        "pg_dump",
        "-h", db_info["host"],
        "-p", db_info["port"],
        "-U", db_info["user"],
        "-d", db_info["database"],
        "-f", str(backup_file),
        "--clean"
    ]
    
    # 環境変数の設定
    env = os.environ.copy()
    env["PGPASSWORD"] = db_info["password"]
    
    try:
        print(f"Running pg_dump to create backup...")
        subprocess.run(pg_dump_cmd, env=env, check=True)
        print(f"Backup created successfully: {backup_file}")
        return backup_file
    except subprocess.CalledProcessError as e:
        print(f"Error creating database backup: {e}")
        return None
    except FileNotFoundError:
        print("Error: pg_dump command not found. Please ensure PostgreSQL tools are installed.")
        return None


def get_migration_files(migration_dir):
    """マイグレーションファイルの取得"""
    # マイグレーションディレクトリの確認
    if not migration_dir:
        migration_dir = PROJECT_ROOT / "migrations"
    
    if not migration_dir.exists():
        print(f"Error: Migration directory not found: {migration_dir}")
        return []
    
    # SQLファイルの検索
    migration_files = sorted(migration_dir.glob("*.sql"))
    
    return migration_files


def run_migrations(db_info, migration_files, dry_run=False):
    """マイグレーションの実行"""
    if not migration_files:
        print("No migration files found.")
        return True
    
    print(f"Found {len(migration_files)} migration files:")
    for i, file in enumerate(migration_files, 1):
        print(f"{i}. {file.name}")
    
    if dry_run:
        print("\nDry run mode: Migrations would be applied but no changes will be made.")
        return True
    
    # psqlコマンドの基本部分
    psql_base_cmd = [
        "psql",
        "-h", db_info["host"],
        "-p", db_info["port"],
        "-U", db_info["user"],
        "-d", db_info["database"]
    ]
    
    # 環境変数の設定
    env = os.environ.copy()
    env["PGPASSWORD"] = db_info["password"]
    
    # 各マイグレーションファイルの実行
    successful_migrations = []
    failed_migrations = []
    
    for migration_file in migration_files:
        print(f"\nApplying migration: {migration_file.name}")
        
        try:
            # SQLファイルを実行
            cmd = psql_base_cmd + ["-f", str(migration_file)]
            result = subprocess.run(cmd, env=env, check=True, capture_output=True, text=True)
            
            # 出力の確認
            if result.stdout:
                print("Output:")
                print(result.stdout)
            
            if result.stderr and not result.stderr.startswith("NOTICE:"):
                print("Warnings/Errors:")
                print(result.stderr)
            
            successful_migrations.append(migration_file.name)
            print(f"✅ Successfully applied migration: {migration_file.name}")
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Error applying migration {migration_file.name}:")
            if e.stderr:
                print(e.stderr)
            else:
                print(str(e))
            
            failed_migrations.append(migration_file.name)
    
    # 結果の表示
    print("\nMigration Summary:")
    print(f"- Total migrations: {len(migration_files)}")
    print(f"- Successful: {len(successful_migrations)}")
    print(f"- Failed: {len(failed_migrations)}")
    
    if failed_migrations:
        print("\nFailed migrations:")
        for migration in failed_migrations:
            print(f"- {migration}")
        return False
    
    return True


def main(args):
    """メイン処理"""
    env_name = args.env
    dry_run = args.dry_run
    no_backup = args.no_backup
    
    print(f"Running database migrations for {env_name} environment")
    print(f"Dry run: {dry_run}")
    
    # データベース接続情報のセットアップ
    db_info = setup_database_connection(env_name)
    
    # データベースバックアップの作成
    if not no_backup and not dry_run:
        backup_file = backup_database(db_info, env_name)
        if not backup_file:
            print("Warning: Failed to create database backup")
            response = input("Continue without backup? (y/n): ")
            if response.lower() != "y":
                print("Migration cancelled")
                return 1
    
    # マイグレーションディレクトリの確認
    migration_dir = args.migration_dir
    if migration_dir:
        migration_dir = Path(migration_dir)
    else:
        # デフォルトでは環境名のサブディレクトリを使用
        migration_dir = PROJECT_ROOT / "migrations" / env_name
        if not migration_dir.exists():
            # 環境名のサブディレクトリがなければ、トップレベルのマイグレーションディレクトリを使用
            migration_dir = PROJECT_ROOT / "migrations"
    
    # マイグレーションファイルの取得
    migration_files = get_migration_files(migration_dir)
    
    if not migration_files:
        print(f"No migration files found in {migration_dir}")
        return 0
    
    # マイグレーションの実行
    success = run_migrations(db_info, migration_files, dry_run)
    
    if success:
        print("\n✅ Migrations completed successfully!")
        return 0
    else:
        print("\n❌ Some migrations failed. Database may be in an inconsistent state.")
        if not no_backup and not dry_run:
            print("Restore the database from the backup if needed.")
        return 1


if __name__ == "__main__":
    args = parse_args()
    sys.exit(main(args))