# Conea（旧Shopify MCP Server）

Conea（旧Shopify MCP Server）は、複数のECプラットフォーム（Shopify、楽天、Amazon）とClaude Desktopを連携するためのModel Context Protocol（MCP）サーバーで、リアルタイム分析とデータ可視化機能を提供します。

**Version**: v0.3.1 (Analytics & MCP Edition)  
**Status**: Production Ready  
**Documentation**: [Full Documentation](docs/README.md)

## 🚀 What's New in v0.3.1

- **モダンGUIインターフェース**: 洗練されたReact/Material UIベースのダッシュボード
- **オフラインモード**: ネットワーク接続なしでも作業可能
- **包括的ヘルプシステム**: コンテキスト依存ヘルプとインタラクティブガイド
- **診断と調査ツール**: 高度な問題診断機能
- **ステージング/本番環境デプロイ**: Docker Composeによるスムーズなデプロイフロー

### Updates in v0.3.0
- **Native MCP Integration**: Full support for Claude Desktop's Model Context Protocol
- **Google Analytics Integration**: Comprehensive GA4 API support with real-time data
- **Advanced Analytics**: Conversion funnels, user segments, and custom metrics
- **Intelligent Caching**: Redis-based caching for improved performance
- **Extended API Support**: Both REST and GraphQL endpoints for analytics

### Previous Updates
- **Adaptive Rate Limiting**: Automatic API request throttling to prevent rate limit errors
- **Exponential Backoff**: Smart retry mechanism for failed requests
- **Rate Limit Monitoring**: New tool to track API usage and rate limit status
- **GraphQL API Support**: Efficient data fetching with up to 70% fewer API calls
- **Enhanced Testing**: Comprehensive test suite with coverage reporting

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
- 📱 Responsive modern UI for all devices
- 🔌 Offline mode for uninterrupted work
- 🛠️ Advanced diagnostic and debugging tools
- 📚 Contextual help and documentation

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
- 🏗️ Modern React/Material UI frontend
- 🔄 Redux state management

## 📚 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- Docker & Docker Compose (optional, for containerized deployment)
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

# 4. Install frontend dependencies
cd frontend
npm install
cd ..

# 5. Build frontend
cd frontend
npm run build
cd ..
```

#### Docker Installation

```bash
# Using Docker Compose
docker-compose up -d

# For production environment
docker-compose -f docker-compose.prod.yml up -d
```

### Running the Server

```bash
# Start the MCP server
./run_server.py

# For legacy FastAPI mode
USE_FASTAPI=true ./run_server.py

# Show version
./run_server.py --version

# Start frontend development server
cd frontend
npm run dev
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
# Run all tests (backend)
python -m pytest tests/

# Run with coverage report
python -m pytest tests/ --cov=shopify_mcp_server

# Run frontend tests
cd frontend
npm test
```

## 🚀 Deployment

### Staging Environment

Deploy to staging using GitHub Actions workflow or manually:

```bash
cd deployment/staging
cp .env.example .env  # Configure environment variables
chmod +x deploy.sh
./deploy.sh
```

See [Staging Deployment Documentation](deployment/staging/README.md) for details.

### Production Environment

Production deployment is automated through GitHub Actions with manual approval:

1. Changes are merged to the `main` branch
2. CI builds and tests the application
3. Security scans are performed
4. Manual approval is required
5. Blue-Green deployment is executed

See [Production Deployment Documentation](deployment/production/README.md) for details.

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
- Docker isolation for production deployments

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