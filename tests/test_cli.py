"""
Tests for the MCP server command-line interface.
Tests the CLI functionality for starting, configuring, and managing the server.
"""
import os
import sys
import pytest
import io
import tempfile
from unittest.mock import Mock, patch, MagicMock

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import the CLI module if available, or mock it if not
try:
    from src.cli import parse_args, main, configure, start_server, stop_server, status, sync_command
except ImportError:
    # Mock imports for testing - in a real scenario, you would implement these modules
    parse_args = main = configure = start_server = stop_server = status = sync_command = None


# Skip all tests if CLI module is not implemented
pytestmark = pytest.mark.skipif(
    parse_args is None,
    reason="CLI module not implemented yet"
)


@pytest.fixture
def mock_server():
    """Mock server instance for CLI testing."""
    server = Mock()
    server.start.return_value = True
    server.shutdown.return_value = True
    server.is_running.return_value = True
    server.get_status.return_value = {
        "status": "running",
        "uptime": "1h 23m 45s",
        "endpoints": ["http://127.0.0.1:8765"],
        "components": {
            "cache": True,
            "sync": True
        }
    }
    return server


@pytest.fixture
def mock_config_file():
    """Create a temporary mock configuration file."""
    config_content = """
    {
        "server": {
            "host": "127.0.0.1",
            "port": 8765
        },
        "enable_analytics": true,
        "enable_sync": true,
        "log_level": "INFO"
    }
    """
    with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.json') as temp:
        temp.write(config_content)
        temp_path = temp.name
    
    yield temp_path
    
    # Clean up
    os.unlink(temp_path)


class TestCLIArguments:
    """Test command-line argument parsing."""
    
    def test_parse_args_no_args(self):
        """Test parsing command-line arguments with no arguments."""
        with patch('sys.argv', ['shopify-mcp-server']):
            args = parse_args()
            
            # Default command should be 'start'
            assert args.command == 'start'
            assert args.config is None
            assert args.verbose is False

    def test_parse_args_start_with_config(self):
        """Test parsing start command with config file."""
        with patch('sys.argv', ['shopify-mcp-server', 'start', '--config', 'config.json']):
            args = parse_args()
            
            assert args.command == 'start'
            assert args.config == 'config.json'
            assert args.verbose is False

    def test_parse_args_configure(self):
        """Test parsing configure command."""
        with patch('sys.argv', ['shopify-mcp-server', 'configure', '--api-key', 'abc123']):
            args = parse_args()
            
            assert args.command == 'configure'
            assert hasattr(args, 'api_key')
            assert args.api_key == 'abc123'

    def test_parse_args_status(self):
        """Test parsing status command."""
        with patch('sys.argv', ['shopify-mcp-server', 'status']):
            args = parse_args()
            
            assert args.command == 'status'

    def test_parse_args_stop(self):
        """Test parsing stop command."""
        with patch('sys.argv', ['shopify-mcp-server', 'stop']):
            args = parse_args()
            
            assert args.command == 'stop'

    def test_parse_args_sync(self):
        """Test parsing sync command."""
        with patch('sys.argv', [
            'shopify-mcp-server', 'sync',
            '--platform', 'shopify',
            '--entity', 'products',
            '--force'
        ]):
            args = parse_args()
            
            assert args.command == 'sync'
            assert args.platform == 'shopify'
            assert args.entity == 'products'
            assert args.force is True


class TestCLICommands:
    """Test CLI command execution."""
    
    @patch('src.cli.start_api_server')
    def test_start_server_command(self, mock_start_api_server, mock_config_file):
        """Test the start server command."""
        mock_server = Mock()
        mock_start_api_server.return_value = mock_server
        
        # Call the start_server function
        with patch('sys.stdout', new=io.StringIO()) as fake_out:
            result = start_server(config=mock_config_file, verbose=True)
        
        # Check that server was started
        assert result == 0
        mock_start_api_server.assert_called_once()
        mock_server.start.assert_called_once()
        
        # Check output
        output = fake_out.getvalue()
        assert "Starting MCP server" in output
        assert "Server started successfully" in output

    @patch('src.cli.start_api_server')
    def test_start_server_error(self, mock_start_api_server):
        """Test error handling in start server command."""
        mock_start_api_server.side_effect = Exception("Configuration error")
        
        # Call the start_server function
        with patch('sys.stdout', new=io.StringIO()) as fake_out:
            result = start_server(config=None, verbose=False)
        
        # Check error handling
        assert result != 0
        
        # Check output
        output = fake_out.getvalue()
        assert "Failed to start server" in output
        assert "Configuration error" in output

    @patch('src.cli.stop_server_process')
    def test_stop_server_command(self, mock_stop_server_process):
        """Test the stop server command."""
        mock_stop_server_process.return_value = True
        
        # Call the stop_server function
        with patch('sys.stdout', new=io.StringIO()) as fake_out:
            result = stop_server()
        
        # Check that server was stopped
        assert result == 0
        mock_stop_server_process.assert_called_once()
        
        # Check output
        output = fake_out.getvalue()
        assert "Stopping MCP server" in output
        assert "Server stopped successfully" in output

    @patch('src.cli.stop_server_process')
    def test_stop_server_not_running(self, mock_stop_server_process):
        """Test stopping the server when it's not running."""
        mock_stop_server_process.return_value = False
        
        # Call the stop_server function
        with patch('sys.stdout', new=io.StringIO()) as fake_out:
            result = stop_server()
        
        # Check that function handled non-running server
        assert result == 0
        
        # Check output
        output = fake_out.getvalue()
        assert "No running server found" in output

    @patch('src.cli.get_server_status')
    def test_status_command_running(self, mock_get_server_status):
        """Test the status command when server is running."""
        server_status = {
            "status": "running",
            "uptime": "1h 23m 45s",
            "endpoints": ["http://127.0.0.1:8765"],
            "pid": 12345,
            "components": {
                "cache": True,
                "sync": True
            }
        }
        mock_get_server_status.return_value = server_status
        
        # Call the status function
        with patch('sys.stdout', new=io.StringIO()) as fake_out:
            result = status()
        
        # Check function execution
        assert result == 0
        mock_get_server_status.assert_called_once()
        
        # Check output
        output = fake_out.getvalue()
        assert "Server Status: running" in output
        assert "Uptime: 1h 23m 45s" in output
        assert "PID: 12345" in output

    @patch('src.cli.get_server_status')
    def test_status_command_not_running(self, mock_get_server_status):
        """Test the status command when server is not running."""
        mock_get_server_status.return_value = None
        
        # Call the status function
        with patch('sys.stdout', new=io.StringIO()) as fake_out:
            result = status()
        
        # Check function execution
        assert result == 0
        
        # Check output
        output = fake_out.getvalue()
        assert "Server is not running" in output

    @patch('src.cli.create_config')
    def test_configure_command(self, mock_create_config):
        """Test the configure command."""
        # Set up arguments
        args = Mock()
        args.api_key = "test_api_key"
        args.api_secret = "test_api_secret"
        args.shop_name = "test_shop"
        args.access_token = "test_token"
        
        # Call the configure function
        with patch('sys.stdout', new=io.StringIO()) as fake_out:
            result = configure(args)
        
        # Check function execution
        assert result == 0
        mock_create_config.assert_called_once_with(
            api_key="test_api_key",
            api_secret="test_api_secret",
            shop_name="test_shop",
            access_token="test_token"
        )
        
        # Check output
        output = fake_out.getvalue()
        assert "Configuration saved successfully" in output

    @patch('src.cli.trigger_sync')
    def test_sync_command(self, mock_trigger_sync):
        """Test the sync command."""
        # Set up mock response
        mock_trigger_sync.return_value = {
            "status": "scheduled",
            "task_id": "task123",
            "message": "Synchronization of products from shopify scheduled"
        }
        
        # Set up arguments
        args = Mock()
        args.platform = "shopify"
        args.entity = "products"
        args.force = True
        args.params = None
        
        # Call the sync_command function
        with patch('sys.stdout', new=io.StringIO()) as fake_out:
            result = sync_command(args)
        
        # Check function execution
        assert result == 0
        mock_trigger_sync.assert_called_once_with(
            platform="shopify",
            entity_type="products",
            force=True,
            params=None
        )
        
        # Check output
        output = fake_out.getvalue()
        assert "Triggering synchronization" in output
        assert "Task ID: task123" in output
        assert "Status: scheduled" in output


class TestCLIMain:
    """Test the main CLI function."""
    
    @patch('src.cli.parse_args')
    @patch('src.cli.start_server')
    def test_main_start(self, mock_start_server, mock_parse_args):
        """Test main function with start command."""
        # Set up mock arguments
        args = Mock()
        args.command = 'start'
        args.config = 'config.json'
        args.verbose = True
        mock_parse_args.return_value = args
        
        # Set up mock start_server
        mock_start_server.return_value = 0
        
        # Call main function
        result = main()
        
        # Check function execution
        assert result == 0
        mock_parse_args.assert_called_once()
        mock_start_server.assert_called_once_with(config='config.json', verbose=True)

    @patch('src.cli.parse_args')
    @patch('src.cli.stop_server')
    def test_main_stop(self, mock_stop_server, mock_parse_args):
        """Test main function with stop command."""
        # Set up mock arguments
        args = Mock()
        args.command = 'stop'
        mock_parse_args.return_value = args
        
        # Set up mock stop_server
        mock_stop_server.return_value = 0
        
        # Call main function
        result = main()
        
        # Check function execution
        assert result == 0
        mock_parse_args.assert_called_once()
        mock_stop_server.assert_called_once()

    @patch('src.cli.parse_args')
    @patch('src.cli.status')
    def test_main_status(self, mock_status, mock_parse_args):
        """Test main function with status command."""
        # Set up mock arguments
        args = Mock()
        args.command = 'status'
        mock_parse_args.return_value = args
        
        # Set up mock status
        mock_status.return_value = 0
        
        # Call main function
        result = main()
        
        # Check function execution
        assert result == 0
        mock_parse_args.assert_called_once()
        mock_status.assert_called_once()

    @patch('src.cli.parse_args')
    @patch('src.cli.configure')
    def test_main_configure(self, mock_configure, mock_parse_args):
        """Test main function with configure command."""
        # Set up mock arguments
        args = Mock()
        args.command = 'configure'
        mock_parse_args.return_value = args
        
        # Set up mock configure
        mock_configure.return_value = 0
        
        # Call main function
        result = main()
        
        # Check function execution
        assert result == 0
        mock_parse_args.assert_called_once()
        mock_configure.assert_called_once_with(args)

    @patch('src.cli.parse_args')
    @patch('src.cli.sync_command')
    def test_main_sync(self, mock_sync_command, mock_parse_args):
        """Test main function with sync command."""
        # Set up mock arguments
        args = Mock()
        args.command = 'sync'
        mock_parse_args.return_value = args
        
        # Set up mock sync_command
        mock_sync_command.return_value = 0
        
        # Call main function
        result = main()
        
        # Check function execution
        assert result == 0
        mock_parse_args.assert_called_once()
        mock_sync_command.assert_called_once_with(args)