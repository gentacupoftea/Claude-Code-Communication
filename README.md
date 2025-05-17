# Shopify MCP Server

Model Context Protocol (MCP) server for integrating Shopify API with Claude Desktop for real-time e-commerce analytics and data visualization.

**Version**: v0.1.0 (MVP Release)  
**Status**: Development Ready

## Features

- 🛍️ Real-time order data aggregation
- 📊 Sales analytics and visualization
- 💰 Currency-aware reporting (JPY support)
- 🔒 Secure API integration
- 📈 Product performance tracking

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/mourigenta/shopify-mcp-server.git
cd shopify-mcp-server
```

2. Set up virtual environment:
```bash
python3.12 -m venv venv
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate  # On Windows
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
```bash
# Option 1: Use the setup script (recommended)
./env_setup.sh

# Option 2: Manual setup
cp .env.example .env
# Edit .env with your Shopify API credentials

# Option 3: Export directly
export SHOPIFY_SHOP_NAME="your-shop-name"
export SHOPIFY_API_VERSION="2024-01"
export SHOPIFY_ACCESS_TOKEN="your-access-token"
export SHOPIFY_API_KEY="your-api-key"
export SHOPIFY_API_SECRET_KEY="your-secret-key"
```

5. Run the server:
```bash
python shopify-mcp-server.py
```

## Claude Desktop Configuration

Add to your Claude Desktop configuration file (`~/Library/Application Support/Claude/config.json`):

```json
{
  "mcpServers": {
    "shopify-mcp": {
      "command": "/path/to/venv/bin/python",
      "args": ["/path/to/shopify-mcp-server.py"],
      "env": {
        "SHOPIFY_API_KEY": "${env:SHOPIFY_API_KEY}",
        "SHOPIFY_ACCESS_TOKEN": "${env:SHOPIFY_ACCESS_TOKEN}",
        "SHOPIFY_SHOP_NAME": "${env:SHOPIFY_SHOP_NAME}"
      }
    }
  }
}
```

## Project Overview

## Environment Variables

The following environment variables are required:

| Variable | Description | Example |
|----------|-------------|---------|
| SHOPIFY_SHOP_NAME | Your Shopify store domain name | mystore |
| SHOPIFY_API_VERSION | Shopify API version | 2024-01 |
| SHOPIFY_ACCESS_TOKEN | Shopify private app access token | shpat_xxx... |
| SHOPIFY_API_KEY | Shopify API key | f3xxx... |
| SHOPIFY_API_SECRET_KEY | Shopify API secret key | shpss_xxx... |

Use `./env_setup.sh` to automatically configure these variables with 1Password integration.

## Technical Stack
- **Language**: Python 3.12
- **MCP Version**: 1.9.0
- **Framework**: FastMCP (Model Context Protocol server)
- **Dependencies**: 
  - asyncio for asynchronous operations
  - urllib3 for HTTP requests
  - matplotlib for data visualization
  - SSL/TLS for secure connections

## Key Problems Solved

### 1. Asyncio Threading Issues
- **Problem**: RuntimeError "Already running asyncio in this thread"
- **Solution**: Fixed in v3-v4 by properly handling the async context
- **Error Pattern**: `asyncio.run(self.run_stdio_async)` conflicting with existing event loop

### 2. LOG_LEVEL Validation
- **Problem**: Invalid log level validation errors
- **Solution**: Proper configuration of logging levels using environment variables

### 3. SSL Certificate Verification
- **Problem**: SSL certificate verification failed errors
- **Solution**: 
  - Added certificate path detection: `/System/Library/OpenSSL/certs/`
  - Implemented fallback mechanism with SSL verification disabled for development
  - Error pattern: `SSLCertVerificationError: certificate verify failed`

### 4. Currency Display
- **Problem**: Incorrect currency formatting for shops
- **Solution**: 
  - Fetched shop currency from Shopify API
  - Implemented currency-aware formatting (e.g., JPY with ¥ symbol)
  - Added proper decimal handling for different currencies

## Solution Versions

### Version 1-2: Initial Implementation
- Basic MCP server setup
- Initial tool implementations

### Version 3-4: Asyncio Fixes
- Fixed "Already running asyncio" errors
- Corrected FastMCP API usage
- Removed incorrect `run_async` method calls

### Version 5-6: SSL Certificate Handling
- Added SSL certificate verification
- Implemented certificate path detection
- Added fallback mechanism for SSL errors

### Version 7: Final Production Version
- Currency-aware display
- Improved error handling
- Better logging with timestamps
- Japanese language support for certain outputs

## Important File Paths
- **Main Server**: `/Users/mourigenta/auto-scraper/shopify-mcp-server.py`
- **Log File**: `/Users/mourigenta/Library/Logs/Claude/mcp-server-shopify-mcp.log`
- **Virtual Environment**: `/Users/mourigenta/auto-scraper/shopify_mcp_venv312/`
- **Certificate Path**: `/System/Library/OpenSSL/certs/`

## Available Tools
1. **get_orders_summary**
   - Parameters: start_date, end_date
   - Returns order statistics and revenue

2. **get_sales_analytics**
   - Parameters: days (default: 30)
   - Returns sales trends and analytics

3. **get_product_performance**
   - Parameters: limit (default: 10)
   - Returns top performing products

## Lessons Learned

### 1. MCP Server Architecture
- FastMCP simplifies MCP server creation but requires careful async handling
- The stdio server pattern is crucial for Claude Desktop integration
- Proper error handling improves development cycle

### 2. SSL Certificate Management
- macOS systems may require explicit certificate path specification
- Development environments might need SSL verification bypass
- Production systems should always use proper SSL verification

### 3. API Integration Best Practices
- Always implement retry mechanisms for network requests
- Log API calls for debugging
- Use environment variables for sensitive credentials
- Implement proper error messages for better UX

### 4. Currency and Localization
- Fetch shop-specific settings (currency, locale)
- Implement proper formatting for different currencies
- Consider locale-specific display formats

### 5. Async Programming
- Be careful with async context conflicts
- Use proper async/await patterns throughout
- Understand FastMCP's async execution model

## Error Patterns to Watch
1. `RuntimeError: Already running asyncio in this thread`
2. `AttributeError: 'FastMCP' object has no attribute 'run_async'`
3. `SSLError(SSLCertVerificationError)`
4. `HTTPSConnectionPool: Max retries exceeded`

## Configuration Example
```bash
export LOG_LEVEL=INFO
export SHOPIFY_SHOP_NAME=5e1407-ab
export SHOPIFY_API_KEY=85dc20c1cb...
export SHOPIFY_ACCESS_TOKEN=shpat_95dd...
```

## Claude Desktop Configuration
```json
{
  "shopify-mcp": {
    "command": "uv",
    "args": [
      "--directory",
      "/Users/mourigenta/auto-scraper",
      "run",
      "shopify-mcp-server.py"
    ],
    "env": {
      "LOG_LEVEL": "INFO"
    }
  }
}
```

## Future Improvements
1. Implement caching for frequently accessed data
2. Add more visualization options
3. Implement customer analytics features
4. Add webhook support for real-time updates
5. Improve error recovery mechanisms