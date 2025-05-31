# Shopify Sync Test Execution Guide

This guide explains how to execute the unit and integration tests for the Shopify synchronization engine.

## Prerequisites

Ensure you have all required dependencies installed:

```bash
# Install core requirements
pip install -r requirements.txt

# Install test-specific dependencies
pip install -r requirements-test.txt
```

## Test Environment Setup

Before running the tests, you may need to set up a virtual environment:

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-test.txt
```

## Running the Tests

### Run All Sync Tests

To run all tests related to the Shopify sync engine:

```bash
pytest tests/sync -v
```

### Run Individual Test Modules

To run specific test modules:

```bash
# Run model tests
pytest tests/sync/test_sync_models.py -v

# Run ShopifySyncEngine tests
pytest tests/sync/test_shopify_sync.py -v

# Run Celery tasks tests
pytest tests/sync/test_shopify_sync_tasks.py -v

# Run integration tests
pytest tests/sync/test_integration.py -v
```

### Run with Coverage

To generate a coverage report:

```bash
pytest tests/sync --cov=src.sync --cov-report=term -v
```

For a more detailed HTML coverage report:

```bash
pytest tests/sync --cov=src.sync --cov-report=html -v
```

This will create a `htmlcov` directory with the coverage report that you can open in a browser.

## Test Categories

The test suite includes the following categories:

1. **Unit Tests**: Testing individual components in isolation
   - Tests for `ShopifySyncEngine` class methods
   - Tests for sync data models (SyncResult, SyncRecord, etc.)
   - Tests for Celery tasks

2. **Integration Tests**: Testing component interactions
   - Multi-platform synchronization
   - Error handling across components
   - Thread and scheduler management

## Troubleshooting Common Issues

### Missing Dependencies

If you encounter `ModuleNotFoundError` errors, ensure all dependencies are installed:

```bash
pip install -r requirements.txt 
pip install -r requirements-test.txt
```

### Async Test Failures

For async test failures, ensure you're using the `pytest-asyncio` plugin and the `@pytest.mark.asyncio` decorator on async test functions.

### Mock Configuration

If tests fail due to mock issues, check:
- Mock return values match expected types
- AsyncMock is used for async methods
- Side effects are properly configured

## Continuous Integration

These tests have been configured to run in the CI pipeline on every pull request and push to the main branch. The CI configuration can be found in the project's GitHub Actions workflow files.

## Adding New Tests

When adding new functionality to the sync engine, please add corresponding tests:

1. Create test functions in the appropriate test file
2. Use existing fixtures from `conftest.py` when possible
3. Create new fixtures for specialized test scenarios
4. Ensure both success and error paths are tested

## Interpreting Test Results

Test execution will show:
- Total tests run
- Number of passed/failed tests
- Coverage percentage (if run with `--cov`)
- Detailed failure information for any failing tests

A successful test run should look like:

```
==================== 42 passed in 3.52s ====================
```

## Next Steps for Test Improvement

Future improvements to the test suite will include:

1. End-to-end tests with containerized Shopify and external platform mocks
2. Performance benchmarking tests
3. Load testing for high-volume sync operations
4. Improved mocking of external API responses