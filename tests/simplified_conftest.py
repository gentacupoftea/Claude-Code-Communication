"""
Simplified conftest for integration testing
"""
import sys
import os
import pytest
from unittest.mock import AsyncMock, Mock, patch

# Ensure project root is on sys.path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

try:
    import redis
except ImportError:
    # Mock Redis if not available
    redis = Mock()
    redis.Redis = Mock()

@pytest.fixture
def mock_response():
    """Create a mock HTTP response"""
    response = Mock()
    response.status_code = 200
    response.headers = {}
    response.json.return_value = {}
    response.text = ""
    return response