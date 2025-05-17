# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-05-30

### Added
- GraphQL API support for improved data fetching efficiency (PR #7)
  - `ShopifyGraphQLClient` class with comprehensive product, order, and customer queries
  - Three new MCP tools: `get_shop_info_graphql`, `get_products_graphql`, `get_inventory_levels_graphql`
  - Support for pagination, error handling, and query optimization
- Comprehensive test suite for GraphQL functionality
  - 14 unit tests covering all GraphQL methods
  - Integration tests for API connectivity
- Enhanced test environment and test runner
  - `run_tests.sh` script for unified test execution
  - Coverage reporting capabilities
  - Performance comparison testing features
- Flexible dependency management
  - Support for version ranges (e.g., `~=1.0.0`)
  - Compatibility with more dependency versions
- Documentation improvements
  - GraphQL vs REST API selection guide
  - GraphQL integration documentation
  - Updated API usage examples
  - Network troubleshooting guide
- Network resilient installation support
  - Configurable retry and timeout mechanisms
  - Offline mode for air-gapped environments
  - Proxy configuration support
  - Environment variable controls for installation behavior

### Changed
- Updated dependency structure for better flexibility
  - `gql==3.5.0` for GraphQL support
  - `requests-toolbelt~=1.0.0` for enhanced HTTP capabilities
  - Separated dependencies into base, extended, and optional categories
- Improved CI/CD configuration
  - Optimized Docker build process
  - Better caching strategies
  - Faster deployment pipeline
- Enhanced error handling and logging
  - GraphQL-specific error classes
  - Better error messages for debugging

### Fixed
- Dependency version conflicts
- Import errors in test environment
- SSL certificate verification issues
- Asyncio threading problems
- Installation failures in restricted network environments
- Unclear error messages during dependency installation

### Performance
- Reduced API calls through GraphQL batching
- Optimized data fetching with selective field queries
- Improved response times for complex data relationships

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