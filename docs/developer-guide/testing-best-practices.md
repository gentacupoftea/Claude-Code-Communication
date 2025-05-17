# Testing Best Practices

This document outlines best practices for writing and maintaining tests in the Shopify MCP Server project.

## Core Principles

1. **Environment Independence**: Tests should adapt to available dependencies
2. **Clear Failure Messages**: Failed tests should clearly indicate the issue
3. **Minimal Dependencies**: Use the least dependencies required for each test
4. **Comprehensive Coverage**: Test all critical paths and edge cases

## Writing Adaptive Tests

### 1. Dependency Detection

Always check for optional dependencies:

```python
import pytest

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

@pytest.mark.skipif(not HAS_PANDAS, reason="pandas not available")
def test_data_processing():
    # Test code using pandas
    pass
```

### 2. Fallback Implementations

Provide alternatives when dependencies are missing:

```python
def process_data(data):
    if HAS_PANDAS:
        return pd.DataFrame(data).mean()
    else:
        # Fallback implementation
        return sum(data) / len(data)
```

### 3. Mock External Services

Always mock external API calls:

```python
from unittest.mock import Mock, patch

@patch('shopify_api.ShopifyAPI._make_request')
def test_api_call(mock_request):
    mock_request.return_value = {"orders": []}
    # Test code here
```

### 4. Environment-Specific Configuration

Use environment variables for test configuration:

```python
import os

TEST_MODE = os.getenv('TEST_MODE', 'minimal')

if TEST_MODE == 'full':
    # Run comprehensive tests
    pass
else:
    # Run basic tests
    pass
```

## Test Organization

### Directory Structure
```
tests/
├── unit/              # Unit tests (minimal dependencies)
├── integration/       # Integration tests (more dependencies)
├── e2e/              # End-to-end tests (full dependencies)
└── fixtures/         # Test data and fixtures
```

### Naming Conventions

- Test files: `test_<module_name>.py`
- Test functions: `test_<functionality>_<scenario>`
- Test classes: `Test<ClassName>`

Example:
```python
# test_graphql_client.py
class TestGraphQLClient:
    def test_query_products_success(self):
        pass
    
    def test_query_products_error_handling(self):
        pass
```

## Performance Considerations

### 1. Test Isolation

Each test should be independent:

```python
class TestAPI:
    def setup_method(self):
        """Run before each test"""
        self.api = ShopifyAPI()
    
    def teardown_method(self):
        """Run after each test"""
        self.api = None
```

### 2. Efficient Fixtures

Use pytest fixtures for reusable test data:

```python
@pytest.fixture
def sample_order():
    return {
        "id": "123",
        "total_price": "100.00",
        "currency": "USD"
    }

def test_order_processing(sample_order):
    # Use sample_order fixture
    pass
```

### 3. Parametrized Tests

Test multiple scenarios efficiently:

```python
@pytest.mark.parametrize("input,expected", [
    ("valid_data", True),
    ("invalid_data", False),
    ("", False),
    (None, False),
])
def test_validation(input, expected):
    assert validate(input) == expected
```

## Error Handling

### 1. Descriptive Assertions

Use clear assertion messages:

```python
def test_api_response():
    response = api.get_orders()
    assert response.status_code == 200, \
        f"Expected status 200, got {response.status_code}. Response: {response.text}"
```

### 2. Expected Exceptions

Test error conditions explicitly:

```python
def test_invalid_token():
    with pytest.raises(AuthenticationError) as exc_info:
        api = ShopifyAPI(token="invalid")
    
    assert "Invalid token" in str(exc_info.value)
```

### 3. Timeout Handling

Set appropriate timeouts for long-running tests:

```python
@pytest.mark.timeout(30)  # 30 seconds timeout
def test_large_data_processing():
    # Test code
    pass
```

## Documentation

### 1. Test Docstrings

Document test purpose and requirements:

```python
def test_graphql_pagination():
    """
    Test GraphQL pagination functionality.
    
    Requirements:
    - GraphQL client (gql)
    - Mock Shopify responses
    
    Verifies:
    - Cursor-based pagination works correctly
    - All pages are fetched
    - Error handling for invalid cursors
    """
    # Test implementation
```

### 2. Comments for Complex Logic

Explain non-obvious test logic:

```python
def test_rate_limiting():
    # Simulate rapid API calls to trigger rate limiting
    for i in range(10):
        response = api.make_request()
        
        # After 5 calls, we expect rate limiting
        if i >= 5:
            assert response.status_code == 429
```

## Continuous Integration

### 1. Environment Variables

Use CI-specific environment variables:

```python
IS_CI = os.getenv('CI', 'false').lower() == 'true'

if IS_CI:
    # CI-specific configuration
    TIMEOUT = 60
else:
    # Local development configuration
    TIMEOUT = 10
```

### 2. Artifact Collection

Save test artifacts for debugging:

```python
def test_with_artifacts(tmp_path):
    output_file = tmp_path / "test_output.json"
    
    # Run test and save output
    result = process_data()
    output_file.write_text(json.dumps(result))
    
    # Assertions
    assert result['status'] == 'success'
```

### 3. Test Reporting

Generate detailed test reports:

```python
def pytest_configure(config):
    config._metadata['Project'] = 'Shopify MCP Server'
    config._metadata['Test Environment'] = os.getenv('TEST_ENV', 'local')
```

## Anti-Patterns to Avoid

### 1. Hard-Coded Values

❌ Avoid:
```python
def test_api():
    api = ShopifyAPI(token="hardcoded-token")
```

✅ Better:
```python
def test_api():
    api = ShopifyAPI(token=os.getenv("TEST_TOKEN", "default"))
```

### 2. Test Interdependence

❌ Avoid:
```python
def test_create_order():
    global order_id
    order_id = create_order()

def test_update_order():
    update_order(order_id)  # Depends on previous test
```

✅ Better:
```python
def test_update_order():
    order_id = create_test_order()  # Self-contained
    update_order(order_id)
```

### 3. Overly Complex Tests

❌ Avoid:
```python
def test_everything():
    # 200 lines of test code testing multiple features
```

✅ Better:
```python
def test_order_creation():
    # Test only order creation

def test_order_update():
    # Test only order update

def test_order_deletion():
    # Test only order deletion
```

## Maintenance

### Regular Review

1. Review test coverage monthly
2. Update deprecated test patterns
3. Remove obsolete tests
4. Refactor complex tests

### Test Performance

Monitor and optimize slow tests:

```python
# Mark slow tests
@pytest.mark.slow
def test_large_dataset():
    pass

# Run fast tests only
# pytest -m "not slow"
```

### Dependency Updates

When updating dependencies:
1. Run full test suite
2. Check for deprecation warnings
3. Update tests if APIs change
4. Document any breaking changes

## Resources

- [pytest Best Practices](https://docs.pytest.org/en/stable/explanation/goodpractices.html)
- [Python Testing 101](https://realpython.com/python-testing/)
- [Test-Driven Development](https://testdriven.io/)
- [Mock Object Library](https://docs.python.org/3/library/unittest.mock.html)