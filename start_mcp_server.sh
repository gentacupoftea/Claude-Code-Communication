#!/bin/bash
# Shopify MCP Server Startup Script

# ディレクトリ移動
cd /Users/mourigenta/shopify-mcp-server

# 仮想環境を有効化
source /Users/mourigenta/shopify_env_312/bin/activate

# サーバーを起動
exec python run_server.py