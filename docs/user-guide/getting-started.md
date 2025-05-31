# Getting Started

This guide will help you get Shopify MCP Server up and running in minutes.

## System Requirements

- Python 3.12 or higher
- macOS, Linux, or Windows
- Shopify store with API access
- Claude Desktop application

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/gentacupoftea/shopify-mcp-server.git
cd shopify-mcp-server
```

### 2. Set Up Python Environment

```bash
python3.12 -m venv venv
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate  # On Windows
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment

#### Option 1: Use Setup Script (Recommended)
```bash
./env_setup.sh
```

#### Option 2: Manual Configuration
```bash
cp .env.example .env
# Edit .env with your Shopify credentials
```

#### Option 3: Export Variables
```bash
export SHOPIFY_SHOP_NAME="your-shop-name"
export SHOPIFY_API_VERSION="2024-01"
export SHOPIFY_ACCESS_TOKEN="your-access-token"
export SHOPIFY_API_KEY="your-api-key"
export SHOPIFY_API_SECRET_KEY="your-secret-key"
```

## Shopify API Setup

### 1. Create a Private App

1. Log into your Shopify admin panel
2. Go to Settings > Apps and sales channels
3. Click "Develop apps"
4. Click "Create an app"
5. Give your app a name
6. Configure API scopes:
   - `read_orders`
   - `read_products`
   - `read_customers`
   - `read_inventory`

### 2. Get API Credentials

1. In your app settings, go to "API credentials"
2. Copy the following:
   - Admin API access token
   - API key
   - API secret key

## Claude Desktop Configuration

### 1. Add Server to Claude

1. Open Claude Desktop
2. Go to Settings > MCP Servers
3. Add new server configuration:

```json
{
  "shopify-mcp": {
    "path": "/path/to/shopify-mcp-server/shopify-mcp-server.py"
  }
}
```

### 2. Restart Claude

After adding the configuration, restart Claude Desktop to load the MCP server.

## Verification

### 1. Test Connection

In Claude, try:
```
Show me today's orders from Shopify
```

### 2. Check Available Tools

Ask Claude:
```
What Shopify tools are available?
```

You should see:
- REST API tools (orders, products, customers)
- GraphQL API tools (shop info, products, inventory)

### 3. Run Tests

```bash
./run_tests.sh
```

## Troubleshooting

### Common Issues

1. **SSL Certificate Error**
   - Solution: Update certificates or temporarily disable verification in development

2. **API Authentication Failed**
   - Solution: Verify your API credentials and permissions

3. **Module Import Errors**
   - Solution: Ensure all dependencies are installed with `pip install -r requirements.txt`

### Getting Help

- Check [FAQ](../faq.md)
- Review [troubleshooting guide](troubleshooting.md)
- Ask in [discussions](https://github.com/gentacupoftea/shopify-mcp-server/discussions)

## Next Steps

- Learn about [Basic Usage](basic-usage.md)
- Explore [GraphQL vs REST](graphql-vs-rest.md)
- Check out [Common Use Cases](use-cases.md)