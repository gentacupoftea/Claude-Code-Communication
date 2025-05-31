#!/usr/bin/env python3
"""
インポートテストスクリプト
"""

import sys
from pathlib import Path

# プロジェクトルートをPythonパスに追加
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "src"))

print("Python path:")
for path in sys.path:
    print(f"  {path}")

print("\nテスト1: 直接インポート")
try:
    from api.shopify_api import ShopifyAPI
    print("✅ api.shopify_api のインポート成功")
except ImportError as e:
    print(f"❌ api.shopify_api のインポート失敗: {e}")

print("\nテスト2: srcを含むインポート")
try:
    from src.api.shopify_api import ShopifyAPI
    print("✅ src.api.shopify_api のインポート成功")
except ImportError as e:
    print(f"❌ src.api.shopify_api のインポート失敗: {e}")

print("\n利用可能なモジュール:")
import os
for item in os.listdir(project_root / "src" / "api"):
    if item.endswith(".py") and not item.startswith("__"):
        print(f"  {item}")

print("\n__init__.py の確認:")
init_files = [
    project_root / "src" / "__init__.py",
    project_root / "src" / "api" / "__init__.py"
]
for init_file in init_files:
    if init_file.exists():
        print(f"✅ {init_file}")
    else:
        print(f"❌ {init_file} - 存在しません")