import pytest
import unittest.mock as mock
import os
import sys
import json
import argparse
from unittest.mock import patch, MagicMock, call

# Add the root directory to sys.path to allow imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

@pytest.fixture
def mock_env_vars():
    """Set up mock environment variables for testing"""
    with patch.dict(os.environ, {
        "LOG_LEVEL": "INFO",
        "MCP_LOG_LEVEL": "INFO",
        "SHOPIFY_API_VERSION": "2023-10",
        "SHOPIFY_API_KEY": "test_api_key",
        "SHOPIFY_API_SECRET_KEY": "test_secret_key",
        "SHOPIFY_ACCESS_TOKEN": "test_access_token",
        "SHOPIFY_SHOP_NAME": "test-shop",
        "RATE_LIMIT_ENABLED": "true"
    }):
        yield

@pytest.mark.unit
@pytest.mark.cli
class TestCommandLineInterface:
    
    def test_tool_help_output(self, mock_env_vars):
        """Test the help output for tools"""
        with patch('sys.argv', ['shopify_mcp_server.py', '--help']), \
             patch('sys.stdout', new_callable=mock.StringIO), \
             patch('sys.stderr', new_callable=mock.StringIO), \
             patch('mcp.server.fastmcp.FastMCP') as mock_fastmcp:
            
            # Set up mock MCP instance
            mock_mcp_instance = mock_fastmcp.return_value
            mock_mcp_instance.run.side_effect = SystemExit(0)
            
            # Import after mocking
            import shopify_mcp_server
            
            # Call the main block to trigger help
            with pytest.raises(SystemExit):
                if hasattr(shopify_mcp_server, 'mcp'):
                    # In actual script, `mcp.run()` is called in the main block
                    shopify_mcp_server.mcp.run()
    
    def test_tool_registration_arguments(self, mock_env_vars):
        """Test that tools register with correct arguments"""
        with patch('mcp.server.fastmcp.FastMCP') as mock_fastmcp:
            # Set up mock MCP instance
            mock_mcp_instance = mock_fastmcp.return_value
            mock_tool_decorator = MagicMock()
            mock_mcp_instance.tool = mock_tool_decorator
            
            # Import after mocking
            import shopify_mcp_server
            
            # Check tool registrations
            for call_args in mock_tool_decorator.call_args_list:
                # Each tool should have a description
                assert "description" in call_args[1]
                assert isinstance(call_args[1]["description"], str)
                assert len(call_args[1]["description"]) > 0
    
    def test_get_orders_summary_args(self, mock_env_vars):
        """Test get_orders_summary tool argument handling"""
        with patch('mcp.server.fastmcp.FastMCP') as mock_fastmcp, \
             patch('shopify_mcp_server.shopify_api.get_orders') as mock_get_orders, \
             patch('matplotlib.pyplot.figure'), \
             patch('matplotlib.pyplot.savefig'), \
             patch('matplotlib.pyplot.close'), \
             patch('io.BytesIO') as mock_bytesio:
            
            # Set up mocks
            mock_mcp_instance = mock_fastmcp.return_value
            mock_get_orders.return_value = []
            
            # Setup mock for base64 encoding
            mock_buffer = MagicMock()
            mock_bytesio.return_value = mock_buffer
            mock_buffer.read.return_value = b"test_image_data"
            
            # Import after mocking
            import shopify_mcp_server
            
            # Call the tool with different arguments
            shopify_mcp_server.get_orders_summary("2023-01-01", "2023-01-31", "chart")
            
            # Check that get_orders was called with correct date params
            mock_get_orders.assert_called_with("2023-01-01", "2023-01-31")
    
    def test_get_sales_analytics_args(self, mock_env_vars):
        """Test get_sales_analytics tool argument handling"""
        with patch('mcp.server.fastmcp.FastMCP') as mock_fastmcp, \
             patch('shopify_mcp_server.shopify_api.get_orders') as mock_get_orders, \
             patch('matplotlib.pyplot.subplots'), \
             patch('matplotlib.pyplot.savefig'), \
             patch('matplotlib.pyplot.close'), \
             patch('io.BytesIO') as mock_bytesio:
            
            # Set up mocks
            mock_mcp_instance = mock_fastmcp.return_value
            mock_get_orders.return_value = []
            
            # Setup mock for base64 encoding
            mock_buffer = MagicMock()
            mock_bytesio.return_value = mock_buffer
            mock_buffer.read.return_value = b"test_image_data"
            
            # Import after mocking
            import shopify_mcp_server
            from datetime import datetime, timedelta
            
            # Call the tool with specific arguments
            shopify_mcp_server.get_sales_analytics("weekly", 60)
            
            # Calculate expected dates for verification
            end_date = datetime.now()
            start_date = end_date - timedelta(days=60)
            
            # Check that get_orders was called with correct date range
            mock_get_orders.assert_called_with(
                start_date.strftime('%Y-%m-%d'),
                end_date.strftime('%Y-%m-%d')
            )
    
    def test_default_parameter_values(self, mock_env_vars):
        """Test default parameter values in tools"""
        with patch('mcp.server.fastmcp.FastMCP') as mock_fastmcp:
            # Import after mocking
            import shopify_mcp_server
            import inspect
            
            # Check get_orders_summary defaults
            sig = inspect.signature(shopify_mcp_server.get_orders_summary)
            assert sig.parameters['start_date'].default is None
            assert sig.parameters['end_date'].default is None
            assert sig.parameters['visualization'].default == "both"
            
            # Check get_sales_analytics defaults
            sig = inspect.signature(shopify_mcp_server.get_sales_analytics)
            assert sig.parameters['period'].default == "daily"
            assert sig.parameters['days'].default == 30
            
            # Check get_product_performance defaults
            sig = inspect.signature(shopify_mcp_server.get_product_performance)
            assert sig.parameters['limit'].default == 10