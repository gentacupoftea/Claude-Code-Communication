#!/bin/bash

# MCP Server Test Script

echo "Testing Shopify MCP Server..."
echo ""

# Change to correct directory
cd /Users/mourigenta/shopify-mcp-server

# Test 1: Health check
echo "1. Health Check:"
echo '{"method": "health", "id": 1}' | python3 simple_mcp_server.py | tail -n 1
echo ""

# Test 2: Initialize
echo "2. Initialize:"
echo '{"method": "initialize", "id": 2}' | python3 simple_mcp_server.py | tail -n 1
echo ""

# Test 3: Test echo
echo "3. Test Echo:"
echo '{"method": "shopify/test", "params": {"message": "Hello MCP!"}, "id": 3}' | python3 simple_mcp_server.py | tail -n 1
echo ""

# Test 4: List products
echo "4. List Products:"
echo '{"method": "shopify/products/list", "id": 4}' | python3 simple_mcp_server.py | tail -n 1
echo ""

# Test 5: List orders
echo "5. List Orders:"
echo '{"method": "shopify/orders/list", "id": 5}' | python3 simple_mcp_server.py | tail -n 1
echo ""

echo "Tests completed!"