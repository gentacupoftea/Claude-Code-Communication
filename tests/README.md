# Shopify MCP Server Tests

This directory contains comprehensive tests for the Shopify MCP Server application.

## Test Structure

The tests are organized into the following categories:

- **Unit Tests**: Located in `tests/unit/`, these test individual components in isolation
  - `server/`: Tests for server initialization and CLI
  - `api/`: Tests for API endpoints and MCP tools
  - `utils/`: Tests for utility functions

- **Integration Tests**: Located in `tests/integration/`, these test how components work together

## Running Tests

To run all tests:

```bash
pytest
```

To run only unit tests:

```bash
pytest -m unit
```

To run only specific test categories:

```bash
pytest -m server      # Server initialization tests
pytest -m rest_api    # REST API tests
pytest -m cli         # Command-line interface tests
pytest -m integration # Integration tests (requires RUN_INTEGRATION_TESTS=1)
```

## Running with Coverage

To run tests with coverage reporting:

```bash
pytest --cov=shopify_mcp_server --cov=utils
```

To generate an HTML coverage report:

```bash
pytest --cov=shopify_mcp_server --cov=utils --cov-report=html
```

## Environment Variables

The tests use environment variables defined in `conftest.py`. For integration tests, you can create a `.env.test` file with your test credentials.

To enable integration tests, set:

```bash
export RUN_INTEGRATION_TESTS=1
```

## Test Dependencies

Required packages for testing are listed in `requirements-test.txt` and include:

- pytest
- pytest-asyncio
- pytest-cov
- pytest-xdist

## Adding New Tests

When adding new tests:

1. Use appropriate markers (`@pytest.mark.unit`, `@pytest.mark.server`, etc.)
2. Follow the existing structure for consistency
3. Ensure tests run in isolation