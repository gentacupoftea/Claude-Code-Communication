#!/usr/bin/env python3
"""
Shopify MCP Server
Main server application for Claude Desktop integration
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
import logging
import os
from pathlib import Path

# プロジェクトルートの設定
import sys
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from src.api.shopify_api import ShopifyAPI
    from src.api.shopify_graphql import ShopifyGraphQLAPI
except ImportError:
    # 開発環境での直接実行用
    sys.path.append(str(project_root))
    from api.shopify_api import ShopifyAPI
    from api.shopify_graphql import ShopifyGraphQLAPI

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPIアプリケーションの初期化
app = FastAPI(
    title="Shopify MCP Server",
    description="MCP Server for Shopify API integration with Claude Desktop",
    version="0.2.0"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Claude Desktopからのアクセスを許可
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 設定の読み込み
config_path = Path.home() / '.shopify-mcp-server' / 'config.json'
if config_path.exists():
    with open(config_path, 'r') as f:
        config = json.load(f)
else:
    config = {
        "api_key": "",
        "api_secret": "",
        "access_token": "",
        "shop_url": "",
        "use_graphql": True,
        "api_version": "2024-10"
    }

# Shopify APIクライアントの初期化
shopify_api = None
shopify_graphql = None

if config.get('access_token') and config.get('shop_url'):
    try:
        shopify_api = ShopifyAPI(
            shop_url=config['shop_url'],
            access_token=config['access_token'],
            api_version=config.get('api_version', '2024-10')
        )
        
        if config.get('use_graphql', True):
            shopify_graphql = ShopifyGraphQLAPI(
                shop_url=config['shop_url'],
                access_token=config['access_token'],
                api_version=config.get('api_version', '2024-10')
            )
        
        logger.info(f"Shopify API initialized for {config['shop_url']}")
    except Exception as e:
        logger.error(f"Failed to initialize Shopify API: {e}")

# リクエスト/レスポンスモデル
class MCPRequest(BaseModel):
    action: str
    params: Optional[Dict[str, Any]] = {}

class MCPResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

# ヘルスチェックエンドポイント
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": "0.2.0",
        "shopify_connected": shopify_api is not None,
        "graphql_enabled": shopify_graphql is not None
    }

# MCP エンドポイント
@app.post("/api/v1/shopify", response_model=MCPResponse)
async def shopify_mcp_endpoint(request: MCPRequest):
    if not shopify_api:
        return MCPResponse(
            success=False,
            error="Shopify API not initialized. Please check configuration."
        )
    
    try:
        action = request.action.lower()
        params = request.params or {}
        
        # アクションに基づいて処理を分岐
        if action == "get_products":
            # GraphQLが有効な場合は優先的に使用
            if shopify_graphql and config.get('use_graphql', True):
                data = await shopify_graphql.get_products(**params)
            else:
                data = await shopify_api.get_products(**params)
            
            return MCPResponse(success=True, data=data)
        
        elif action == "get_orders":
            if shopify_graphql and config.get('use_graphql', True):
                data = await shopify_graphql.get_orders(**params)
            else:
                data = await shopify_api.get_orders(**params)
            
            return MCPResponse(success=True, data=data)
        
        elif action == "get_customers":
            if shopify_graphql and config.get('use_graphql', True):
                data = await shopify_graphql.get_customers(**params)
            else:
                data = await shopify_api.get_customers(**params)
            
            return MCPResponse(success=True, data=data)
        
        elif action == "get_inventory":
            # REST APIのみでサポート
            data = await shopify_api.get_inventory(**params)
            return MCPResponse(success=True, data=data)
        
        elif action == "get_shop_info":
            # ショップ情報の取得
            data = await shopify_api.get_shop_info()
            return MCPResponse(success=True, data=data)
        
        else:
            return MCPResponse(
                success=False,
                error=f"Unknown action: {action}"
            )
    
    except Exception as e:
        logger.error(f"Error processing MCP request: {e}")
        return MCPResponse(
            success=False,
            error=str(e)
        )

# 設定更新エンドポイント
@app.post("/api/v1/config")
async def update_config(new_config: Dict[str, Any]):
    global config, shopify_api, shopify_graphql
    
    try:
        # 設定を更新
        config.update(new_config)
        
        # 設定ファイルに保存
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        
        # APIクライアントを再初期化
        if config.get('access_token') and config.get('shop_url'):
            shopify_api = ShopifyAPI(
                shop_url=config['shop_url'],
                access_token=config['access_token'],
                api_version=config.get('api_version', '2024-10')
            )
            
            if config.get('use_graphql', True):
                shopify_graphql = ShopifyGraphQLAPI(
                    shop_url=config['shop_url'],
                    access_token=config['access_token'],
                    api_version=config.get('api_version', '2024-10')
                )
        
        return {"success": True, "message": "Configuration updated"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)