#!/usr/bin/env python3
"""
Simple Shopify MCP Server for testing
"""

from fastapi import FastAPI
import json
from pathlib import Path

app = FastAPI(title="Shopify MCP Server", version="0.2.0")

# 設定の読み込み
config_path = Path.home() / '.shopify-mcp-server' / 'config.json'
if config_path.exists():
    with open(config_path, 'r') as f:
        config = json.load(f)
else:
    config = {}

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": "0.2.0",
        "shopify_connected": bool(config.get('access_token')),
        "shop_url": config.get('shop_url', 'not configured')
    }

@app.post("/api/v1/shopify")
async def shopify_endpoint(data: dict):
    return {
        "success": True,
        "message": "MCP endpoint is working",
        "request": data
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000)