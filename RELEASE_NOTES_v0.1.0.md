# Release Notes - v0.1.0 (MVP)

## Shopify MCP Server MVP Release

We're excited to announce the first MVP release of Shopify MCP Server! This release provides core functionality for integrating Shopify stores with Claude Desktop for real-time e-commerce analytics.

### What's Included

#### Core Features
- **Order Management**: Real-time order data aggregation and visualization
- **Sales Analytics**: Daily, weekly, and monthly sales trend analysis
- **Product Performance**: Track top-performing products by revenue and quantity
- **Customer Analytics**: Customer lifecycle and spending pattern analysis
- **Multi-currency Support**: Proper formatting for JPY and other currencies

#### Technical Enhancements
- Data processing optimization with intelligent caching
- Robust error handling for network and API issues
- Memory-efficient data structures
- Environment variable management tool

### Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/gentacupoftea/shopify-mcp-server.git
   cd shopify-mcp-server
   ```

2. **Set up environment**:
   ```bash
   ./env_setup.sh
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the server**:
   ```bash
   python shopify-mcp-server.py
   ```

### Key Improvements

- **PR #5**: Data processing optimization
  - Implemented caching with @memoize decorator
  - Optimized DataFrame memory usage
  - Reduced API call frequency

- **PR #4**: Enhanced error handling
  - Centralized request processing
  - Comprehensive error logging
  - Graceful failure recovery

### Known Issues

- MCP package installation requires manual setup
- Some GraphQL features are still in development

### Coming Next

- GraphQL API support (v0.2.0)
- Advanced analytics features
- CI/CD pipeline integration
- Performance benchmarking tools

### Contributors

- Lead Engineer: Claude Code (OdenCraft)
- AI Assistants: Devin AI, CODEX

### Support

For issues or questions, please:
- Open an issue on GitHub
- Check the documentation in `/docs`
- Review the CHANGELOG.md for detailed changes

Thank you for using Shopify MCP Server!

---
Release Date: 2025-05-17
Version: 0.1.0