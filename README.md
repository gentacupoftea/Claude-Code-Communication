# Conea（旧Shopify MCP Server）

Conea（旧Shopify MCP Server）は、複数のECプラットフォーム（Shopify、楽天、Amazon）とClaude Desktopを連携するためのModel Context Protocol（MCP）サーバーで、リアルタイム分析とデータ可視化機能を提供します。

**Version**: v0.3.0 (Analytics & MCP Edition)  
**Status**: Production Ready  
**Documentation**: [Full Documentation](docs/README.md)

## 🚀 What's New in v0.3.0

- **Native MCP Integration**: Full support for Claude Desktop's Model Context Protocol
- **Google Analytics Integration**: Comprehensive GA4 API support with real-time data
- **Advanced Analytics**: Conversion funnels, user segments, and custom metrics
- **Intelligent Caching**: Redis-based caching for improved performance
- **Extended API Support**: Both REST and GraphQL endpoints for analytics

### Updates in v0.2.1
- **Adaptive Rate Limiting**: Automatic API request throttling to prevent rate limit errors
- **Exponential Backoff**: Smart retry mechanism for failed requests
- **Rate Limit Monitoring**: New tool to track API usage and rate limit status

### Previous Updates (v0.2.0)
- **GraphQL API Support**: Efficient data fetching with up to 70% fewer API calls
- **Enhanced Testing**: Comprehensive test suite with coverage reporting
- **Flexible Dependencies**: Better compatibility with version ranges
- **Network Resilience**: Improved handling of restricted network environments

## ✨ Features

### Core Capabilities
- 🛍️ Real-time order data aggregation
- 📊 Sales analytics and visualization
- 📈 Interactive analytics dashboard
- 💰 Currency-aware reporting (Multi-currency support)
- 🔒 Secure API integration
- 📈 Product performance tracking
- 🌐 GraphQL and REST API support
- 📊 Google Analytics integration

### Technical Features
- 🤖 Native MCP server implementation
- 🚄 High-performance caching
- 🧪 Comprehensive test coverage
- 🐳 Docker support
- 📝 Extensive documentation
- 🔄 Integrated CI/CD with GitHub Actions
- 🛡️ Network resilient installation
- 🔐 Redis-based caching for Google Analytics
- 🧩 TypeScript and Python dual support

## 📚 Quick Start

### Prerequisites
- Python 3.8+
- Shopify store with API access
- Claude Desktop application

### Installation

#### Standard Installation

```bash
# 1. Clone the repository
git clone https://github.com/mourigenta/conea.git
cd conea

# 2. Set up environment with network resilience
./setup_env.sh
# Or with custom options:
# INSTALL_TIMEOUT=300 INSTALL_RETRY=5 ./setup_env.sh

# 3. Configure your Shopify credentials
# Edit .env with your credentials (created by setup_env.sh)
```

#### Installation in Restricted Networks

```bash
# For environments with network restrictions:

# 1. Behind a proxy
export PIP_PROXY=http://your-proxy:port
./setup_env.sh

# 2. Limited network connectivity
INSTALL_TIMEOUT=300 INSTALL_RETRY=10 ./setup_env.sh

# 3. Offline installation
# First, download packages on a connected machine:
pip download -r requirements.txt -d vendor/
# Then on the target machine:
OFFLINE_MODE=1 ./setup_env.sh

# 4. Minimal installation (core features only)
INSTALL_DEV=0 INSTALL_GOOGLE=0 INSTALL_PRODUCTION=0 ./setup_env.sh
```

### Running the Server

```bash
# Start the MCP server
./run_server.py

# For legacy FastAPI mode
USE_FASTAPI=true ./run_server.py

# Show version
./run_server.py --version
```

### Configuration

Configure your Shopify credentials in `.env`:

```bash
SHOPIFY_SHOP_NAME=your-shop-name
SHOPIFY_ACCESS_TOKEN=your-access-token
SHOPIFY_API_VERSION=2025-04
```

See [Environment Setup Guide](docs/configuration/environment.md) for detailed instructions.

## 🛠️ Available MCP Tools

### Order Analytics
- `get_orders_summary`: Order statistics and revenue with visualization
- `get_sales_analytics`: Sales trends and analytics with charts
- `get_product_performance`: Top performing products analysis

### Shop Information
- `get_shop_info_graphql`: Comprehensive shop information via GraphQL

### Monitoring
- `get_rate_limit_stats`: Monitor API rate limit usage statistics

## 🧪 Testing

### Running Tests

```bash
# Run all tests
python -m pytest tests/

# Run with coverage report
python -m pytest tests/ --cov=shopify_mcp_server

# Run specific test file
python -m pytest tests/test_mcp.py
```

## 🔧 Troubleshooting

### Network Issues

If you encounter dependency installation failures:

1. **Check proxy settings**: `export PIP_PROXY=http://proxy:port`
2. **Increase timeout**: `INSTALL_TIMEOUT=300 ./setup_env.sh`
3. **Use offline mode**: `OFFLINE_MODE=1 ./setup_env.sh`
4. **Disable retries**: `INSTALL_RETRY=0 ./setup_env.sh`

### API Rate Limiting

If you experience rate limiting issues with Shopify API:

1. **Adjust rate limit settings**: Modify the following environment variables:
   ```
   SHOPIFY_RATE_LIMIT_RPS=2.0    # Requests per second
   SHOPIFY_RATE_LIMIT_BURST=10   # Maximum burst size
   SHOPIFY_RATE_LIMIT_LOG=true   # Enable detailed logging
   ```
2. **Monitor rate limit usage**: Use the `get_rate_limit_stats` MCP tool
3. **Check rate limit headers**: Review logs for "Shopify API Rate Limit" warnings

## 🐳 Docker Support

Deploy with Docker:

```bash
# Build and run
docker-compose up

# Production deployment
docker-compose -f docker-compose.prod.yml up
```

See [Docker Configuration](docs/configuration/docker.md) for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/contributing/README.md) for:

- Development workflow
- Code style guidelines
- Pull request process
- Release procedures

## 🔐 Security

- Environment-based configuration
- Secure token storage
- Adaptive rate limiting and automatic throttling
- Rate limit statistics monitoring
- SSL/TLS support

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Thanks to all contributors who have helped make this project better!

## 📞 Support

- 📖 [Documentation](docs/README.md)
- 💬 [Discussions](https://github.com/mourigenta/conea/discussions)
- 🐛 [Issue Tracker](https://github.com/mourigenta/conea/issues)

---

<p align="center">
  Made with ❤️ by the Conea team
</p>