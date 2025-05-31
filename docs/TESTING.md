# Shopify MCP Server Testing Guide

This document describes the testing structure and processes for the Shopify MCP Server project.

## Testing Framework

The Shopify MCP Server uses pytest as the primary testing framework. Tests are organized as follows:

```
tests/
├── README.md              # Testing documentation
├── conftest.py            # Common fixtures and setup
├── unit/                  # Unit tests
│   ├── server/            # Server initialization tests
│   │   ├── test_server_initialization.py
│   │   └── test_cli.py
│   ├── api/               # API endpoint tests
│   │   ├── test_shopify_api.py
│   │   └── test_mcp_tools.py
│   └── utils/             # Utility function tests
│       └── test_utils.py
└── integration/           # Integration tests
    └── test_integration.py
```

## Running Tests

You can run tests using the provided script:

```bash
./run_tests.sh             # Run unit tests
./run_tests.sh --coverage  # Run tests with coverage report
./run_tests.sh --integration # Run integration tests
```

Or directly with pytest:

```bash
pytest                     # Run all tests
pytest tests/unit/         # Run all unit tests
pytest tests/unit/server/  # Run server tests
pytest -m "server"         # Run tests with server marker
```

## Test Structure

### Unit Tests

Unit tests focus on testing individual components in isolation. They use mocking to avoid external dependencies.

#### Server Tests

Tests in `tests/unit/server/` verify:
- Server initialization
- Environment variable processing
- Command-line interface functionality

#### API Tests

Tests in `tests/unit/api/` verify:
- Shopify API client functionality
- MCP tool behavior
- API endpoint error handling

#### Utility Tests

Tests in `tests/unit/utils/` verify:
- Cache functionality
- Data optimization functions
- Rate limiting behavior

### Integration Tests

Integration tests in `tests/integration/` verify how components work together. They are skipped by default unless the `RUN_INTEGRATION_TESTS=1` environment variable is set.

## Test Markers

The following pytest markers are used:

- `@pytest.mark.unit`: Unit tests (default)
- `@pytest.mark.server`: Server initialization tests
- `@pytest.mark.rest_api`: REST API endpoint tests
- `@pytest.mark.cli`: Command-line interface tests
- `@pytest.mark.integration`: Integration tests (skipped by default)
- `@pytest.mark.asyncio`: Tests that use asyncio

## Fixtures

Common test fixtures are defined in `tests/conftest.py`, including:

- `mock_env_vars`: Sets up mock environment variables
- `mock_orders`: Provides mock order data
- `mock_products`: Provides mock product data
- `mock_customers`: Provides mock customer data
- `mock_shopify_api`: Mocks the Shopify API client
- `mock_mcp`: Mocks the FastMCP class

## Test Coverage

To check test coverage:

```bash
./run_tests.sh --coverage
```

This will generate an HTML coverage report in the `htmlcov/` directory.

## Writing New Tests

### Writing Unit Tests

1. Determine the appropriate category (server, api, utils)
2. Create a test file in the appropriate directory
3. Use appropriate pytest markers
4. Use fixtures from conftest.py when possible
5. Mock external dependencies

Example:

```python
@pytest.mark.unit
@pytest.mark.server
def test_server_initialization(mock_env_vars):
    # Test code here
    pass
```

### Writing Integration Tests

1. Add tests to `tests/integration/`
2. Use the `@pytest.mark.integration` marker
3. Consider how components interact together
4. Use `mock_env_file` to create a test environment

## Best Practices

1. Keep tests small and focused
2. Mock external dependencies in unit tests
3. Use descriptive test names that explain what's being tested
4. Use fixtures to reduce duplicated setup code
5. Make sure tests clean up after themselves
6. Include both success and failure paths

## Continuous Integration

Tests are automatically run in CI/CD pipelines to ensure code quality before merging.

The CI pipeline runs:
1. All unit tests
2. Linting checks
3. Coverage reports

Integration tests are typically run on a scheduled basis or manually triggered.