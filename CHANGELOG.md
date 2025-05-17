# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-05-17

### Added
- Initial MVP release of Shopify MCP Server
- Core functionality for connecting Shopify API with Claude Desktop
- Data processing optimization with caching (PR #5)
- Enhanced error handling and centralized request processing (PR #4)
- Environment variable configuration tool (`env_setup.sh`)
- Comprehensive documentation and setup guides

### Features
- Real-time order data aggregation
- Sales analytics and visualization
- Product performance tracking
- Customer analytics
- Currency-aware reporting (JPY support)
- Secure API integration

### Technical Improvements
- Implemented @memoize decorator for efficient caching
- Added _make_request method for centralized error handling
- Optimized data types for memory efficiency
- Added comprehensive error handling for HTTP requests

### Documentation
- Created detailed README with setup instructions
- Added environment variable configuration guide
- Included API client documentation
- Created data schema documentation

[0.1.0]: https://github.com/gentacupoftea/shopify-mcp-server/releases/tag/v0.1.0