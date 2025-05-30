# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-05-30

### 🎉 Major Release

This is a major release that includes breaking changes and new features.

### Added
- 楽天API統合機能
- RAGシステムによるAI商品説明生成
- ペルソナ分析サービス
- Docker Compose環境
- Google Cloud Run対応
- 包括的なテストスイート

### Changed
- プロジェクト名をShopify MCP ServerからConea Integration Platformに変更
- バックエンドアーキテクチャの全面リファクタリング
- フロントエンドUIの刷新
- APIエンドポイントの再設計

### Fixed
- TypeScript型定義エラー
- Docker環境の安定性向上
- 認証フローの改善

### Breaking Changes
- APIエンドポイントのパス変更
- 環境変数名の変更
- データベーススキーマの更新

### Migration Guide
詳細な移行ガイドは `docs/MIGRATION_GUIDE.md` を参照してください。

## [1.1.0] - 2025-05-26
- 初期リリース
- Shopify基本統合機能

## [0.3.0] - 2025-05-31

> 🔄 **Name Change**: With this release, we begin transitioning from "Shopify MCP Server" to our new name "Conea". Documentation has been updated to reflect this change, with full code migration coming in v0.3.1 and v0.3.2. See our [Rename Migration Plan](docs/RENAME_MIGRATION.md) for details.

### Added
- Project rename: First phase of migration from "Shopify MCP Server" to "Conea"
- Intelligent processing prototype for enhanced data handling
- Native MCP server implementation
- Advanced data visualization components
- Internationalization support (EN, JA, FR)
- Comprehensive export functionality
- GraphQL API optimization
- Performance monitoring dashboard
- Memory-optimized data processing
- Rate limit statistics monitoring
- Automated testing suite
- Documentation in multiple languages

### Changed
- Complete project restructuring as a Python package
- Improved API response format
- Enhanced error handling
- Memory-optimized data types
- Optimized caching system
- Adaptive rate limiting implementation

### Deprecated
- Legacy FastAPI mode (still available with USE_FASTAPI=true)
- Old configuration format (use new environment variables)
- Custom rate limiting implementations (use built-in system)

### Removed
- Deprecated v1 API endpoints
- Legacy jQuery dependencies
- Unused configuration options

### Fixed
- Memory leak in real-time data updates (#142)
- Race condition in batch processing (#156)
- Date formatting issues in different timezones (#163)
- Currency display for multi-currency stores (#171)
- Export functionality for large datasets (#189)

## [0.2.1] - 2025-05-20

### Added
- Adaptive rate limiting for Shopify API requests
  - Automatic request throttling to prevent API rate limit errors
  - Exponential backoff for retrying throttled requests
  - Rate limit statistics monitoring tool
  - Configurable via environment variables

### Changed
- Improved API client resilience
  - Better handling of 429 rate limit errors
  - Automatic retry mechanism for rate-limited requests
  - Header-based rate limit tracking

### Performance
- Optimized API usage to stay within Shopify rate limits
- Reduced API errors and improved reliability
- Added rate limit statistics display

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