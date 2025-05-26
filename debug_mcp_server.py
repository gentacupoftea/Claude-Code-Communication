#!/usr/bin/env python3
"""
Debug MCP Server - Minimal implementation for testing
"""
import sys
import json
import logging
from datetime import datetime

# ログを標準エラー出力に設定（MCPプロトコルは標準出力を使用するため）
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

def send_response(response):
    """MCPレスポンスを送信"""
    response_str = json.dumps(response)
    print(response_str)
    sys.stdout.flush()
    logger.debug(f"Sent response: {response_str}")

def main():
    logger.info("Debug MCP Server starting...")
    
    # MCPサーバーは初期化を待つ必要がある
    # 初期化メッセージは送信しない（クライアントからの初期化リクエストを待つ）
    
    while True:
        try:
            # 標準入力から読み取り
            line = sys.stdin.readline()
            if not line:
                logger.info("EOF received, shutting down")
                break
            
            line = line.strip()
            if not line:
                continue
            
            logger.debug(f"Received: {line}")
            
            # JSONパース
            try:
                request = json.loads(line)
            except json.JSONDecodeError as e:
                logger.error(f"JSON parse error: {e}")
                send_response({
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32700,
                        "message": "Parse error"
                    },
                    "id": None
                })
                continue
            
            # リクエスト処理
            method = request.get("method")
            params = request.get("params", {})
            request_id = request.get("id")
            
            logger.info(f"Processing method: {method}")
            
            # メソッドに応じて処理
            if method == "initialize":
                response = {
                    "jsonrpc": "2.0",
                    "result": {
                        "capabilities": {
                            "tools": ["test", "health"]
                        }
                    },
                    "id": request_id
                }
            elif method == "tools/list":
                response = {
                    "jsonrpc": "2.0",
                    "result": {
                        "tools": [
                            {
                                "name": "test",
                                "description": "Test tool",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "message": {"type": "string"}
                                    }
                                }
                            },
                            {
                                "name": "health",
                                "description": "Health check",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {}
                                }
                            }
                        ]
                    },
                    "id": request_id
                }
            elif method == "tools/call":
                tool_name = params.get("name")
                if tool_name == "test":
                    message = params.get("arguments", {}).get("message", "Hello!")
                    response = {
                        "jsonrpc": "2.0",
                        "result": {
                            "content": [
                                {
                                    "type": "text",
                                    "text": f"Test response: {message}"
                                }
                            ]
                        },
                        "id": request_id
                    }
                elif tool_name == "health":
                    response = {
                        "jsonrpc": "2.0",
                        "result": {
                            "content": [
                                {
                                    "type": "text",
                                    "text": f"Server healthy at {datetime.now().isoformat()}"
                                }
                            ]
                        },
                        "id": request_id
                    }
                else:
                    response = {
                        "jsonrpc": "2.0",
                        "error": {
                            "code": -32601,
                            "message": f"Unknown tool: {tool_name}"
                        },
                        "id": request_id
                    }
            else:
                response = {
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {method}"
                    },
                    "id": request_id
                }
            
            send_response(response)
            
        except KeyboardInterrupt:
            logger.info("Keyboard interrupt received")
            break
        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            if 'request_id' in locals():
                send_response({
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32603,
                        "message": "Internal error",
                        "data": str(e)
                    },
                    "id": request_id
                })
    
    logger.info("Debug MCP Server stopped")

if __name__ == "__main__":
    main()