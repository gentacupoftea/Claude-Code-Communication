#!/usr/bin/env python3
"""
Shopify MCP Server - Async implementation with proper lifecycle
"""
import sys
import json
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional

# Configure logging to stderr (MCP uses stdout for protocol)
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

class ShopifyMCPServer:
    def __init__(self):
        self.initialized = False
        self.protocol_version = "2024-11-05"
        self.server_info = {
            "name": "shopify-mcp-server",
            "version": "1.0.0"
        }
        
    async def send_message(self, message: Dict[str, Any]):
        """Send a message to the client"""
        message_str = json.dumps(message)
        print(message_str)
        sys.stdout.flush()
        logger.debug(f"Sent: {message_str}")
        
    async def send_response(self, request_id: Any, result: Dict[str, Any]):
        """Send a successful response"""
        await self.send_message({
            "jsonrpc": "2.0",
            "result": result,
            "id": request_id
        })
        
    async def send_error(self, request_id: Any, code: int, message: str, data: Any = None):
        """Send an error response"""
        error = {
            "code": code,
            "message": message
        }
        if data is not None:
            error["data"] = data
            
        await self.send_message({
            "jsonrpc": "2.0",
            "error": error,
            "id": request_id
        })
        
    async def handle_initialize(self, request_id: Any, params: Dict[str, Any]):
        """Handle initialization request"""
        logger.info("Handling initialize request")
        
        # Send response
        await self.send_response(request_id, {
            "protocolVersion": self.protocol_version,
            "serverInfo": self.server_info,
            "capabilities": {
                "tools": {}  # We support tools
            }
        })
        
        # Mark as initialized
        self.initialized = True
        logger.info("Server initialized successfully")
        
    async def handle_tools_list(self, request_id: Any, params: Dict[str, Any]):
        """Handle tools/list request"""
        if not self.initialized:
            await self.send_error(request_id, -32002, "Server not initialized")
            return
            
        logger.info("Handling tools/list request")
        
        tools = [
            {
                "name": "shopify_products_list",
                "description": "List products from Shopify store",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "integer",
                            "description": "Number of products to retrieve",
                            "default": 10
                        }
                    }
                }
            },
            {
                "name": "shopify_orders_list",
                "description": "List orders from Shopify store",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "string",
                            "description": "Order status filter",
                            "enum": ["any", "open", "closed", "cancelled"]
                        }
                    }
                }
            },
            {
                "name": "health_check",
                "description": "Check server health status",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            }
        ]
        
        await self.send_response(request_id, {"tools": tools})
        
    async def handle_tools_call(self, request_id: Any, params: Dict[str, Any]):
        """Handle tools/call request"""
        if not self.initialized:
            await self.send_error(request_id, -32002, "Server not initialized")
            return
            
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        
        logger.info(f"Handling tools/call for {tool_name}")
        
        if tool_name == "health_check":
            result = {
                "content": [
                    {
                        "type": "text",
                        "text": f"Server is healthy. Time: {datetime.now().isoformat()}"
                    }
                ]
            }
        elif tool_name == "shopify_products_list":
            limit = arguments.get("limit", 10)
            # Mock response for now
            result = {
                "content": [
                    {
                        "type": "text",
                        "text": f"Would fetch {limit} products from Shopify (mock response)"
                    }
                ]
            }
        elif tool_name == "shopify_orders_list":
            status = arguments.get("status", "any")
            # Mock response for now
            result = {
                "content": [
                    {
                        "type": "text",
                        "text": f"Would fetch orders with status '{status}' from Shopify (mock response)"
                    }
                ]
            }
        else:
            await self.send_error(request_id, -32601, f"Unknown tool: {tool_name}")
            return
            
        await self.send_response(request_id, result)
        
    async def handle_ping(self, request_id: Any, params: Dict[str, Any]):
        """Handle ping request - allowed before initialization"""
        logger.info("Handling ping request")
        await self.send_response(request_id, {})
        
    async def handle_request(self, request: Dict[str, Any]):
        """Handle incoming request"""
        method = request.get("method")
        params = request.get("params", {})
        request_id = request.get("id")
        
        logger.info(f"Received request: {method}")
        
        # Handle different methods
        if method == "initialize":
            await self.handle_initialize(request_id, params)
        elif method == "ping":
            await self.handle_ping(request_id, params)
        elif method == "tools/list":
            await self.handle_tools_list(request_id, params)
        elif method == "tools/call":
            await self.handle_tools_call(request_id, params)
        else:
            await self.send_error(request_id, -32601, f"Method not found: {method}")
            
    async def run(self):
        """Main server loop"""
        logger.info("Shopify MCP Server starting...")
        
        # Create stdin reader
        reader = asyncio.StreamReader()
        protocol = asyncio.StreamReaderProtocol(reader)
        await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)
        
        while True:
            try:
                # Read line from stdin
                line_bytes = await reader.readline()
                if not line_bytes:
                    logger.info("EOF received, shutting down")
                    break
                    
                line = line_bytes.decode('utf-8').strip()
                if not line:
                    continue
                    
                logger.debug(f"Received: {line}")
                
                # Parse JSON
                try:
                    request = json.loads(line)
                except json.JSONDecodeError as e:
                    logger.error(f"JSON parse error: {e}")
                    await self.send_message({
                        "jsonrpc": "2.0",
                        "error": {
                            "code": -32700,
                            "message": "Parse error"
                        },
                        "id": None
                    })
                    continue
                    
                # Handle request
                await self.handle_request(request)
                
            except asyncio.CancelledError:
                logger.info("Server cancelled")
                break
            except Exception as e:
                logger.error(f"Unexpected error: {e}", exc_info=True)
                
        logger.info("Shopify MCP Server stopped")

async def main():
    server = ShopifyMCPServer()
    await server.run()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received")