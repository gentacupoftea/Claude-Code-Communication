# Shopify Sync Engine Tests

This directory contains tests for the Shopify synchronization engine and related functionality.

## Test Structure

- `test_shopify_sync.py`: Unit tests for the `ShopifySyncEngine` class
- `test_shopify_sync_tasks.py`: Unit tests for Celery tasks
- `test_sync_models.py`: Unit tests for sync models (SyncStatus, SyncType, SyncResult, etc.)
- `test_integration.py`: Integration tests for multi-platform sync

## Running Tests

### Run All Sync Tests

```bash
pytest tests/sync -v
```

### Run Specific Test Modules

```bash
# Run only the ShopifySyncEngine tests
pytest tests/sync/test_shopify_sync.py -v

# Run only the Celery tasks tests
pytest tests/sync/test_shopify_sync_tasks.py -v

# Run only the model tests
pytest tests/sync/test_sync_models.py -v
```

### Run Integration Tests Only

```bash
pytest tests/sync/test_integration.py -v
```

### Run Tests with Coverage

```bash
pytest tests/sync --cov=src.sync -v
```

## Test Fixtures

Common test fixtures are defined in `conftest.py`:

- `mock_shopify_api`: Mock Shopify API for testing
- `mock_external_api`: Mock external platform API
- `sync_engine`: Pre-configured ShopifySyncEngine instance
- `sample_sync_result`: Example SyncResult instance
- `sample_sync_history`: Example SyncHistory with multiple results

## Writing New Tests

When adding new features to the sync engine, please add corresponding tests.

### Test Categories

1. **Unit Tests**: Test individual methods and classes in isolation
2. **Integration Tests**: Test interaction between multiple components
3. **Error Handling Tests**: Verify proper handling of error conditions
4. **Edge Case Tests**: Test boundary conditions and unusual scenarios

### Best Practices

- Use the provided fixtures when applicable
- Mock external dependencies
- Test both success and failure scenarios
- Verify all external API calls
- Check return values and state changes

## Debugging Failures

If tests fail, check:

1. Mock configuration: Ensure mocks are set up correctly
2. Async handling: Ensure async methods are properly mocked
3. Thread safety: Check for potential race conditions
4. Error propagation: Verify errors are caught and handled appropriately