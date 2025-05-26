#!/usr/bin/env python3
"""
Test MCP connection
"""
import subprocess
import json
import time

def test_mcp_server():
    print("🧪 Testing MCP Server Connection...")
    
    # Start the MCP server
    process = subprocess.Popen(
        ["python3", "debug_mcp_server.py"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1
    )
    
    try:
        # Wait for initialization
        time.sleep(0.5)
        
        # Test 1: Initialize
        print("\n1. Testing initialize...")
        request = {
            "jsonrpc": "2.0",
            "method": "initialize",
            "params": {},
            "id": 1
        }
        process.stdin.write(json.dumps(request) + "\n")
        process.stdin.flush()
        
        # Read response
        response = process.stdout.readline()
        if response:
            print(f"✅ Response: {response.strip()}")
        
        # Test 2: List tools
        print("\n2. Testing tools/list...")
        request = {
            "jsonrpc": "2.0",
            "method": "tools/list",
            "params": {},
            "id": 2
        }
        process.stdin.write(json.dumps(request) + "\n")
        process.stdin.flush()
        
        response = process.stdout.readline()
        if response:
            print(f"✅ Response: {response.strip()}")
        
        # Test 3: Call test tool
        print("\n3. Testing tools/call with test tool...")
        request = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "test",
                "arguments": {"message": "Hello from test!"}
            },
            "id": 3
        }
        process.stdin.write(json.dumps(request) + "\n")
        process.stdin.flush()
        
        response = process.stdout.readline()
        if response:
            print(f"✅ Response: {response.strip()}")
        
        # Check stderr for logs
        print("\n📋 Server logs:")
        process.terminate()
        time.sleep(0.5)
        stderr = process.stderr.read()
        if stderr:
            print(stderr)
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        process.terminate()
        process.wait()

if __name__ == "__main__":
    test_mcp_server()