#!/usr/bin/env python3
"""
Simple MCP Server for Shopify Integration
"""
import sys
import json
import logging
from typing import Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename='mcp_server.log'
)
logger = logging.getLogger(__name__)


class SimpleMCPServer:
    """Simple MCP Server implementation"""
    
    def __init__(self):
        self.version = "1.0.0"
        logger.info("Simple MCP Server initialized")
    
    def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle incoming MCP requests"""
        method = request.get("method", "")
        params = request.get("params", {})
        request_id = request.get("id")
        
        logger.info(f"Handling request: {method}")
        
        # Route to appropriate handler
        if method == "initialize":
            response = self.handle_initialize(params)
        elif method == "shopify/test":
            response = self.handle_test(params)
        elif method == "shopify/products/list":
            response = self.handle_list_products(params)
        elif method == "shopify/orders/list":
            response = self.handle_list_orders(params)
        elif method == "health":
            response = {"status": "healthy", "version": self.version}
        else:
            response = {"error": f"Unknown method: {method}"}
        
        # Add request ID if present
        if request_id:
            response["id"] = request_id
        
        return response
    
    def handle_initialize(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle initialization"""
        return {
            "capabilities": {
                "shopify": ["products", "orders", "customers"],
                "auth": ["login", "logout"],
                "version": self.version
            }
        }
    
    def handle_test(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Test handler"""
        message = params.get("message", "Hello from MCP Server!")
        return {"result": f"Echo: {message}"}
    
    def handle_list_products(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Mock product listing"""
        # In a real implementation, this would connect to Shopify API
        return {
            "products": [
                {
                    "id": "1",
                    "title": "Sample Product 1",
                    "price": "29.99",
                    "inventory": 100
                },
                {
                    "id": "2",
                    "title": "Sample Product 2",
                    "price": "49.99",
                    "inventory": 50
                }
            ],
            "total": 2
        }
    
    def handle_list_orders(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Mock order listing"""
        return {
            "orders": [
                {
                    "id": "1001",
                    "customer": "John Doe",
                    "total": "79.98",
                    "status": "pending"
                }
            ],
            "total": 1
        }
    
    def run(self):
        """Run the MCP server"""
        logger.info("Starting Simple MCP Server...")
        print(json.dumps({"status": "ready", "version": self.version}))
        sys.stdout.flush()
        
        while True:
            try:
                # Read request from stdin
                line = sys.stdin.readline()
                if not line:
                    break
                
                # Skip empty lines
                line = line.strip()
                if not line:
                    continue
                
                # Parse JSON request
                try:
                    request = json.loads(line)
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON: {e}")
                    error_response = {"error": "Invalid JSON", "details": str(e)}
                    print(json.dumps(error_response))
                    sys.stdout.flush()
                    continue
                
                # Handle request
                response = self.handle_request(request)
                
                # Send response
                print(json.dumps(response))
                sys.stdout.flush()
                
            except KeyboardInterrupt:
                logger.info("Shutting down...")
                break
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                error_response = {"error": "Internal server error", "details": str(e)}
                print(json.dumps(error_response))
                sys.stdout.flush()
        
        logger.info("Server stopped")


def main():
    """Main entry point"""
    server = SimpleMCPServer()
    
    try:
        server.run()
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()