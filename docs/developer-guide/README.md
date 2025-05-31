# Developer Guide

Welcome to the Shopify MCP Server Developer Guide. This section provides detailed information for developers who want to extend, modify, or contribute to the project.

## Contents

### 1. [Architecture Overview](architecture.md)
- System design
- Component interaction
- Data flow
- GraphQL integration

### 2. [Development Setup](setup.md)
- Environment configuration
- IDE setup
- Debugging tools
- Development best practices

### 3. [Testing Guide](testing.md)
- Unit testing
- Integration testing
- Performance testing
- Test coverage

### 4. [Performance Optimization](performance.md)
- Caching strategies
- Query optimization
- Memory management
- Profiling tools

## Quick Start for Developers

1. Clone and set up development environment:
```bash
git clone https://github.com/gentacupoftea/shopify-mcp-server.git
cd shopify-mcp-server
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
```

2. Run tests:
```bash
./run_tests.sh --coverage
```

3. Start development server:
```bash
python shopify-mcp-server.py
```

## Development Workflow

1. Create feature branch
2. Write tests first (TDD)
3. Implement features
4. Run tests and linting
5. Submit pull request

## Key Components

- **ShopifyAPI**: Main API client class
- **ShopifyGraphQLClient**: GraphQL client implementation
- **MCP Tools**: Individual tool implementations
- **Utils**: Shared utilities and decorators

## Important Files

- `shopify_mcp_server.py`: Main server implementation
- `shopify_graphql_client.py`: GraphQL client
- `utils.py`: Utility functions
- `test_*.py`: Test files

## Contributing

See the [Contributing Guide](../contributing/README.md) for detailed contribution guidelines.

## Resources

- [API Reference](../api-reference/README.md)
- [Architecture Documentation](architecture.md)
- [Performance Guide](performance.md)