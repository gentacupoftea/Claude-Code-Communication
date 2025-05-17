# Enhanced Documentation

This document provides additional guidance for operating the Shopify MCP Server.
It complements the main [README](README.md).

## 1. Installation Troubleshooting

### Common Issues
- **Missing Dependencies**: If `mcp`, `pandas` or other packages cannot be installed, ensure Python 3.12 or later is used. Proxy restrictions may also block access to PyPI.
- **Environment File Not Loaded**: Verify that `.env` exists and contains the required variables. Run `cp .env.example .env` and fill in your credentials.
- **SSL Certificate Errors**: On some macOS systems certificates may be missing. Set `SSL_CERT_FILE` to `/System/Library/OpenSSL/certs/cert.pem` or use the provided fallback in development.

## 2. Operational Notes
- Keep your Shopify API credentials in environment variables and never commit them to Git.
- Review the log file specified in the README for error messages during runtime.
- Monitor API rate limits to avoid `429` errors. Implement retries with exponential backoff if necessary.

## 3. API Reference
The server exposes the following MCP tools. Each tool returns a Markdown report; images are embedded as base64 encoded PNG.

### get_orders_summary
- **Parameters**: `start_date` (YYYY-MM-DD), `end_date` (YYYY-MM-DD), `visualization` ("chart", "table", "both")
- **Returns**: Orders statistics and optional charts.
- **Example**:
  ```json
  {
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "visualization": "both"
  }
  ```

### get_sales_analytics
- **Parameters**: `period` (daily/weekly/monthly), `days` (default: 30)
- **Returns**: Sales summary with trend charts.

### get_product_performance
- **Parameters**: `limit` (default: 10)
- **Returns**: Top products by revenue and quantity with charts.

### get_customer_analytics
- **Parameters**: none
- **Returns**: Customer statistics and visualizations.

### get_product_order_sales_refunds
- **Parameters**: `start_date`, `end_date`
- **Returns**: Table of orders, sales and refunds per product.

### get_referrer_order_sales_refunds
- **Parameters**: `start_date`, `end_date`
- **Returns**: Table of orders, sales and refunds by referrer.

### get_total_order_sales_refunds
- **Parameters**: `start_date`, `end_date`
- **Returns**: Overall totals for orders, sales and refunds.

### get_page_order_sales_refunds
- **Parameters**: `start_date`, `end_date`
- **Returns**: Orders, sales and refunds aggregated by landing page.

## 4. Architecture Overview

### Component Diagram
```
┌───────────────┐     ┌───────────────┐     ┌──────────────┐
│               │     │               │     │              │
│ Claude Desktop│◄───►│   MCP Server  │◄───►│  Shopify API │
│               │     │               │     │              │
└───────────────┘     └───────────────┘     └──────────────┘
        ▲                     │                    ▲
        │                     ▼                    │
        │               ┌───────────────┐         │
        └───────────────┤ Data Handling │─────────┘
                        │ & Visualization│
                        └───────────────┘
```

### Data Flow
1. **Request**: Claude Desktop sends a JSON-RPC request to the MCP server.
2. **API Call**: The server fetches data from Shopify via HTTPS.
3. **Processing**: Data is aggregated and visualized with pandas and matplotlib.
4. **Response**: Markdown with embedded images is returned to Claude Desktop.
