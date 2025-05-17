#!/usr/bin/env python3
"""
Test script for Shopify MCP Server
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

async def test_server():
    """Test the Shopify MCP server without connecting to Claude Desktop"""
    print("Testing Shopify MCP Server...")
    
    # Check environment variables
    env_vars = [
        "SHOPIFY_API_KEY",
        "SHOPIFY_ACCESS_TOKEN", 
        "SHOPIFY_SHOP_NAME"
    ]
    
    missing_vars = []
    for var in env_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"Error: Missing environment variables: {', '.join(missing_vars)}")
        print("Please create a .env file with the required variables")
        return 1
    
    # Import server after env check
    try:
        from shopify_mcp_server import mcp
        print("✓ Server imported successfully")
        
        # List available tools
        print("\nAvailable tools:")
        for tool_name, tool_func in mcp._tools.items():
            print(f"  - {tool_name}")
        
        print("\n✓ Test passed!")
        return 0
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(test_server())
    sys.exit(exit_code)