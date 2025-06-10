#!/usr/bin/env python3
"""
環境変数の読み込みテストスクリプト
.envファイルから環境変数が正しく読み込まれているか確認します
"""

import os
import sys

# プロジェクトのルートディレクトリをPythonパスに追加
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from multiLLM_system.config.settings import settings

print("=== 環境変数の読み込みテスト ===\n")

print(f"DATABASE_URL: {settings.DATABASE_URL}")
print(f"POSTGRES_USER: {settings.POSTGRES_USER}")
print(f"POSTGRES_PASSWORD: {settings.POSTGRES_PASSWORD}")
print(f"POSTGRES_DB: {settings.POSTGRES_DB}")
print(f"REDIS_URL: {settings.REDIS_URL}")
print(f"API_PORT: {settings.API_PORT}")
print(f"DEBUG: {settings.DEBUG}")
print(f"LOG_LEVEL: {settings.LOG_LEVEL}")

print("\n=== 解析されたデータベース設定 ===")

from multiLLM_system.orchestrator.persistence import PersistenceManager

pm = PersistenceManager({})
db_config = pm._parse_database_url()

print(f"Host: {db_config['host']}")
print(f"Port: {db_config['port']}")
print(f"Database: {db_config['database']}")
print(f"User: {db_config['user']}")
print(f"Password: {'*' * len(db_config['password']) if db_config['password'] else 'None'}")

print("\n✅ 環境変数のチェックが完了しました")