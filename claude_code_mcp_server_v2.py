#!/usr/bin/env python3
"""
Claude Code MCP Server - OpenMemory Integration V2
"""
import sys
import json
import logging
import asyncio
import subprocess
from datetime import datetime
from typing import Dict, Any, Optional, Union

# Configure logging to stderr (MCP uses stdout for protocol)
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

class ClaudeCodeMCPServer:
    def __init__(self):
        self.initialized = False
        self.protocol_version = "2024-11-05"
        self.server_info = {
            "name": "ClaudeCode",
            "version": "1.0.0"
        }
        self.openmemory_cli_path = "/Users/mourigenta/openmemory_cli.sh"
        
    async def send_message(self, message: Dict[str, Any]):
        """Send a message to the client"""
        # Ensure we never send undefined or null id in error responses
        if "error" in message and "id" not in message:
            # For error responses without id, we must include id (even if null)
            message["id"] = None
            
        message_str = json.dumps(message)
        print(message_str)
        sys.stdout.flush()
        logger.debug(f"Sent: {message_str}")
        
    async def send_response(self, request_id: Union[str, int, None], result: Dict[str, Any]):
        """Send a successful response"""
        response = {
            "jsonrpc": "2.0",
            "result": result
        }
        # Always include id field
        response["id"] = request_id
        await self.send_message(response)
        
    async def send_error(self, request_id: Union[str, int, None], code: int, message: str, data: Any = None):
        """Send an error response"""
        error = {
            "code": code,
            "message": message
        }
        if data is not None:
            error["data"] = data
        
        response = {
            "jsonrpc": "2.0",
            "error": error,
            "id": request_id  # Always include id, even if None
        }
        await self.send_message(response)
        
    async def handle_initialize(self, request_id: Union[str, int, None], params: Dict[str, Any]):
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
        
    async def handle_tools_list(self, request_id: Union[str, int, None], params: Dict[str, Any]):
        """Handle tools/list request"""
        if not self.initialized:
            await self.send_error(request_id, -32002, "Server not initialized")
            return
            
        logger.info("Handling tools/list request")
        
        tools = [
            {
                "name": "memory_save",
                "description": "記憶を保存する / Save memory",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "content": {
                            "type": "string",
                            "description": "保存する内容 / Content to save"
                        }
                    },
                    "required": ["content"]
                }
            },
            {
                "name": "memory_search",
                "description": "記憶を検索する / Search memory",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "検索クエリ / Search query"
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "memory_list",
                "description": "記憶一覧を表示する / List all memories",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "memory_delete",
                "description": "記憶を削除する / Delete memory",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "memory_id": {
                            "type": "string",
                            "description": "削除するメモリのID / Memory ID to delete"
                        }
                    },
                    "required": ["memory_id"]
                }
            }
        ]
        
        await self.send_response(request_id, {"tools": tools})
        
    async def run_openmemory_command(self, command: str, *args: str) -> str:
        """Run OpenMemory CLI command"""
        try:
            cmd = [self.openmemory_cli_path, command] + list(args)
            logger.info(f"Running command: {' '.join(cmd)}")
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode('utf-8') if stderr else "Unknown error"
                logger.error(f"Command failed: {error_msg}")
                return f"Error: {error_msg}"
                
            return stdout.decode('utf-8').strip()
            
        except Exception as e:
            logger.error(f"Failed to run command: {e}", exc_info=True)
            return f"Error: {str(e)}"
        
    async def handle_tools_call(self, request_id: Union[str, int, None], params: Dict[str, Any]):
        """Handle tools/call request"""
        if not self.initialized:
            await self.send_error(request_id, -32002, "Server not initialized")
            return
            
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        
        logger.info(f"Handling tools/call for {tool_name}")
        
        try:
            if tool_name == "memory_save":
                content = arguments.get("content", "")
                result_text = await self.run_openmemory_command("記憶して", content)
                
            elif tool_name == "memory_search":
                query = arguments.get("query", "")
                result_text = await self.run_openmemory_command("思い出して", query)
                
            elif tool_name == "memory_list":
                result_text = await self.run_openmemory_command("一覧")
                
            elif tool_name == "memory_delete":
                memory_id = arguments.get("memory_id", "")
                result_text = await self.run_openmemory_command("削除", memory_id)
                
            else:
                await self.send_error(request_id, -32601, f"Unknown tool: {tool_name}")
                return
                
            # Send successful result
            result = {
                "content": [
                    {
                        "type": "text",
                        "text": result_text
                    }
                ]
            }
            await self.send_response(request_id, result)
            
        except Exception as e:
            logger.error(f"Error in tool execution: {e}", exc_info=True)
            await self.send_error(request_id, -32603, "Internal error", str(e))
        
    async def handle_ping(self, request_id: Union[str, int, None], params: Dict[str, Any]):
        """Handle ping request - allowed before initialization"""
        logger.info("Handling ping request")
        await self.send_response(request_id, {})
        
    async def handle_request(self, request: Dict[str, Any]):
        """Handle incoming request"""
        method = request.get("method")
        params = request.get("params", {})
        request_id = request.get("id")  # May be None for notifications
        
        logger.info(f"Received request: {method} with id: {request_id}")
        
        try:
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
        except Exception as e:
            logger.error(f"Error handling request: {e}", exc_info=True)
            await self.send_error(request_id, -32603, "Internal error", str(e))
            
    async def run(self):
        """Main server loop"""
        logger.info("Claude Code MCP Server starting...")
        
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
                    await self.handle_request(request)
                except json.JSONDecodeError as e:
                    logger.error(f"JSON parse error: {e}")
                    # For parse errors, we cannot determine the id, so we send error with id: null
                    await self.send_error(None, -32700, "Parse error", str(e))
                    
            except asyncio.CancelledError:
                logger.info("Server cancelled")
                break
            except Exception as e:
                logger.error(f"Unexpected error in main loop: {e}", exc_info=True)
                # For unexpected errors in the main loop, send error with null id
                try:
                    await self.send_error(None, -32603, "Internal server error", str(e))
                except:
                    # If we can't even send the error, just log it
                    logger.error("Failed to send error response")
                
        logger.info("Claude Code MCP Server stopped")

async def main():
    server = ClaudeCodeMCPServer()
    await server.run()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received")