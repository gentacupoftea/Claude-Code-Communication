#!/usr/bin/env python3
"""
Shopify MCP Server Runner
"""

import uvicorn
from pathlib import Path
import sys

# プロジェクトのルートディレクトリをPythonパスに追加
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

import logging

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
    # src/apiディレクトリが存在するか確認
    api_path = project_root / "src" / "api"
    if not api_path.exists():
        print(f"警告: APIディレクトリが見つかりません: {api_path}")
        
    # Uvicornサーバーを起動
    uvicorn.run(
        "src.shopify_mcp_server:app",
        host="127.0.0.1",
        port=5000,
        reload=True,
        log_level="info"
    )
