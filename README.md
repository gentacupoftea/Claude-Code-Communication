# Shopify MCP Server

Model Context Protocol (MCP) server for integrating Shopify API with Claude Desktop for real-time e-commerce analytics and data visualization.

**Version**: v0.3.0 (Analytics Edition)  
**Status**: Production Ready  
**Documentation**: [Full Documentation](docs/README.md)

## 🚀 What's New in v0.3.0

- **Google Analytics Integration**: Comprehensive GA4 API support with real-time data
- **Advanced Analytics**: Conversion funnels, user segments, and custom metrics
- **Intelligent Caching**: Redis-based caching for improved performance
- **Extended API Support**: Both REST and GraphQL endpoints for analytics

### Previous Updates (v0.2.0)
- **GraphQL API Support**: Efficient data fetching with up to 70% fewer API calls
- **Enhanced Testing**: Comprehensive test suite with coverage reporting
- **Flexible Dependencies**: Better compatibility with version ranges
- **Network Resilience**: Improved handling of restricted network environments

## ✨ Features

### Core Capabilities
- 🛍️ Real-time order data aggregation
- 📊 Sales analytics and visualization
- 💰 Currency-aware reporting (Multi-currency support)
- 🔒 Secure API integration
- 📈 Product performance tracking
- 🌐 GraphQL and REST API support
- 📊 Google Analytics integration (NEW in v0.3.0)

### Technical Features
- 🚄 High-performance caching
- 🧪 Comprehensive test coverage
- 🐳 Docker support
- 📝 Extensive documentation
- 🔄 CI/CD ready
- 🛡️ Network resilient installation
- 🔐 Redis-based caching for Google Analytics

## 📚 Quick Start

### Prerequisites
- Python 3.8+
- Shopify store with API access
- Claude Desktop application

### Installation

#### Standard Installation

```bash
# 1. Clone the repository
git clone https://github.com/mourigenta/shopify-mcp-server.git
cd shopify-mcp-server

# 2. Set up environment with network resilience
./setup_test_env.sh
# Or with custom options:
# INSTALL_TIMEOUT=300 INSTALL_RETRY=5 ./setup_test_env.sh

# 3. Configure your Shopify credentials
cp .env.example .env
# Edit .env with your credentials
```

#### Installation in Restricted Networks

```bash
# For environments with network restrictions:

# 1. Behind a proxy
export PIP_PROXY=http://your-proxy:port
./setup_test_env.sh

# 2. Limited network connectivity
INSTALL_TIMEOUT=300 INSTALL_RETRY=10 ./setup_test_env.sh

# 3. Offline installation
# First, download packages on a connected machine:
pip download -r requirements.txt -d vendor/
# Then on the target machine:
OFFLINE_MODE=1 ./setup_test_env.sh

# 4. Minimal installation (core features only)
INSTALL_OPTIONAL=0 INSTALL_DEV=0 ./setup_test_env.sh
```

### Dependency Installation Options

```bash
# Core dependencies only (minimal functionality)
pip install -r requirements-base.txt

# Extended dependencies (recommended)
pip install -r requirements-extended.txt

# Full installation (all features)
pip install -r requirements.txt
```

### Configuration

Configure your Shopify credentials in `.env`:

```bash
SHOPIFY_SHOP_NAME=your-shop-name
SHOPIFY_ACCESS_TOKEN=your-access-token
SHOPIFY_API_VERSION=2024-01
```

See [Environment Setup Guide](docs/configuration/environment.md) for detailed instructions.

## 🛠️ Available Tools

### REST API Tools
- `get_orders_summary`: Order statistics and revenue
- `get_sales_analytics`: Sales trends and analytics
- `get_product_performance`: Top performing products

### GraphQL API Tools
- `get_shop_info_graphql`: Comprehensive shop information
- `get_products_graphql`: Efficient product data fetching  
- `get_inventory_levels_graphql`: Location-aware inventory tracking

### Google Analytics API Tools (v0.3.0+)
- `run_ga_report`: Execute Google Analytics reports
- `get_realtime_data`: Real-time visitor analytics
- `get_conversion_funnel`: Analyze conversion paths
- `get_user_segments`: Compare user segments

### When to Use Which?

**Use GraphQL for:**
- Complex queries with related data
- Mobile apps with bandwidth constraints
- Selective field fetching

**Use REST for:**
- Simple CRUD operations
- Cached content
- Legacy integrations

See [GraphQL vs REST Guide](docs/user-guide/graphql-vs-rest.md) for detailed comparisons.

## 🧪 Testing

Prepare the test environment and run the suite:

```bash
# Copy example variables for testing
cp .env.test.example .env.test
# Install dependencies in a virtualenv
./setup_test_env.sh

# Run all tests with automatic dependency detection
python run_adaptive_tests.py

# Run with coverage report
./run_tests.sh --coverage

# Run specific test file
python -m pytest test_graphql_client.py

# Check environment and dependencies
python test_imports.py
```

## 🔧 Troubleshooting

### Network Issues

If you encounter dependency installation failures:

1. **Check proxy settings**: `export PIP_PROXY=http://proxy:port`
2. **Increase timeout**: `INSTALL_TIMEOUT=300 ./setup_test_env.sh`
3. **Use offline mode**: See [docs/NETWORK_TROUBLESHOOTING.md](docs/NETWORK_TROUBLESHOOTING.md)
4. **Disable retries**: `INSTALL_RETRY_DISABLED=1 ./setup_test_env.sh`

### Common Issues

- **Import errors**: Run `python test_imports.py` for specific instructions
- **SSL errors**: Update certificates or use trusted sources
- **Timeout errors**: Increase `INSTALL_TIMEOUT` environment variable

## 🐳 Docker Support

Deploy with Docker:

```bash
# Build and run
docker-compose up

# Production deployment
docker-compose -f docker-compose.prod.yml up
```

See [Docker Configuration](docs/configuration/docker.md) for details.

## 📊 Google Analytics Integration

### Setup
1. Configure GA credentials in `.env`:
```bash
GA_CREDENTIALS_PATH=/path/to/service-account.json
GA_PROPERTY_ID=123456789
```

2. Start Redis for caching:
```bash
docker-compose -f docker-compose.ga.yml up redis
```

3. Run the GA server:
```bash
python -m src.google_analytics.main
```

### Features
- Real-time visitor tracking
- Custom report generation
- Conversion funnel analysis
- Multi-property support
- Intelligent caching with Redis

See [Google Analytics Guide](docs/GOOGLE_ANALYTICS_GUIDE.md) for detailed documentation.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/contributing/README.md) for:

- Development workflow
- Code style guidelines
- Pull request process
- Release procedures

## 📊 Performance

v0.2.0 brings significant performance improvements:

- **70% reduction** in API calls for complex queries (GraphQL)
- **40% faster** response times for multi-resource fetches
- **50% less bandwidth** usage with selective field queries
- **Network resilient** installation process

## 🔐 Security

- Environment-based configuration
- Secure token storage
- Rate limiting awareness
- SSL/TLS support

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Thanks to all contributors who have helped make this project better!

## 📞 Support

- 📖 [Documentation](docs/README.md)
- 💬 [Discussions](https://github.com/gentacupoftea/shopify-mcp-server/discussions)
- 🐛 [Issue Tracker](https://github.com/gentacupoftea/shopify-mcp-server/issues)
- 📧 Email: support@example.com

---

<p align="center">
  Made with ❤️ by the Shopify MCP Server team
</p>