#!/usr/bin/env python3
"""
Claude Code MCP Server - Minimal working implementation
"""
import sys
import json
import asyncio
import subprocess
from typing import Dict, Any, Union

class MCPServer:
    def __init__(self):
        self.initialized = False
        
    async def handle_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Handle incoming JSON-RPC message"""
        method = message.get("method")
        params = message.get("params", {})
        msg_id = message.get("id")
        
        # Initialize
        if method == "initialize":
            self.initialized = True
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "serverInfo": {
                        "name": "ClaudeCode",
                        "version": "1.0.0"
                    },
                    "capabilities": {
                        "tools": {}
                    }
                }
            }
            
        # Tools list
        elif method == "tools/list":
            if not self.initialized:
                return {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {"code": -32002, "message": "Not initialized"}
                }
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "tools": [
                        {
                            "name": "memory_save",
                            "description": "記憶を保存する",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "content": {"type": "string"}
                                },
                                "required": ["content"],
                                "additionalProperties": False,
                                "$schema": "http://json-schema.org/draft-07/schema#"
                            }
                        },
                        {
                            "name": "memory_search",
                            "description": "記憶を検索する",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "query": {"type": "string"}
                                },
                                "required": ["query"],
                                "additionalProperties": False,
                                "$schema": "http://json-schema.org/draft-07/schema#"
                            }
                        }
                    ]
                }
            }
            
        # Tools call
        elif method == "tools/call":
            if not self.initialized:
                return {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {"code": -32002, "message": "Not initialized"}
                }
                
            tool_name = params.get("name")
            arguments = params.get("arguments", {})
            
            # Execute OpenMemory command
            try:
                if tool_name == "memory_save":
                    content = arguments.get("content", "")
                    result = subprocess.run(
                        ["/Users/mourigenta/openmemory_cli.sh", "記憶して", content],
                        capture_output=True,
                        text=True
                    )
                    output = result.stdout.strip() if result.returncode == 0 else f"Error: {result.stderr}"
                    
                elif tool_name == "memory_search":
                    query = arguments.get("query", "")
                    result = subprocess.run(
                        ["/Users/mourigenta/openmemory_cli.sh", "思い出して", query],
                        capture_output=True,
                        text=True
                    )
                    output = result.stdout.strip() if result.returncode == 0 else f"Error: {result.stderr}"
                    
                else:
                    return {
                        "jsonrpc": "2.0",
                        "id": msg_id,
                        "error": {"code": -32601, "message": f"Unknown tool: {tool_name}"}
                    }
                    
                return {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "content": [
                            {"type": "text", "text": output}
                        ]
                    }
                }
                
            except Exception as e:
                return {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {"code": -32603, "message": str(e)}
                }
                
        # Unknown method
        else:
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {"code": -32601, "message": f"Method not found: {method}"}
            }

async def main():
    """Main event loop"""
    server = MCPServer()
    
    # Create stdin reader
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)
    
    while True:
        try:
            # Read line
            line_bytes = await reader.readline()
            if not line_bytes:
                break
                
            line = line_bytes.decode('utf-8').strip()
            if not line:
                continue
                
            # Parse and handle
            try:
                message = json.loads(line)
                response = await server.handle_message(message)
                
                # Send response
                print(json.dumps(response))
                sys.stdout.flush()
                
            except json.JSONDecodeError:
                # Skip invalid JSON
                pass
                
        except Exception:
            # Continue on error
            pass

if __name__ == "__main__":
    asyncio.run(main())