"""
Unit tests for the configuration manager module.
"""
import os
import json
import yaml
import tempfile
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from src.config_manager import (
    ConfigManager, ConfigSource, ConfigFileFormat,
    get_config, init_config, ConfigSectionFactory,
    DatabaseConfig, ApiConfig, ShopifyConfig, CacheConfig,
    LoggingConfig, SecurityConfig, generate_default_config
)


class TestConfigManager:
    """Tests for the ConfigManager class."""
    
    def setup_method(self):
        """Set up test fixtures."""
        # Create test configuration files
        self.temp_dir = tempfile.TemporaryDirectory()
        self.config_dir = Path(self.temp_dir.name)
        
        # JSON config
        self.json_config = {
            "database": {
                "host": "db.example.com",
                "port": 5432,
                "name": "test_db"
            },
            "api": {
                "port": 8080,
                "debug": True
            }
        }
        self.json_path = self.config_dir / "config.json"
        with open(self.json_path, "w") as f:
            json.dump(self.json_config, f)
        
        # YAML config
        self.yaml_config = {
            "database": {
                "host": "db.example.org",
                "user": "test_user",
                "password": "test_password"
            },
            "shopify": {
                "api_key": "test_key",
                "api_secret": "test_secret"
            }
        }
        self.yaml_path = self.config_dir / "config.yaml"
        with open(self.yaml_path, "w") as f:
            yaml.dump(self.yaml_config, f)
        
        # INI config
        self.ini_config = """
[database]
host = db.example.net
port = 5433

[api]
base_path = /api/v2
        """
        self.ini_path = self.config_dir / "config.ini"
        with open(self.ini_path, "w") as f:
            f.write(self.ini_config)
        
        # Default config for testing
        self.default_config = {
            "database": {
                "host": "localhost",
                "port": 5432,
                "name": "default_db",
                "user": "default_user",
                "password": "default_pass"
            },
            "api": {
                "host": "0.0.0.0",
                "port": 8000,
                "debug": False,
                "base_path": "/api"
            }
        }
    
    def teardown_method(self):
        """Tear down test fixtures."""
        self.temp_dir.cleanup()
    
    def test_load_from_json(self):
        """Test loading from JSON configuration file."""
        config = ConfigManager(config_path=str(self.json_path))
        config.load_from_file()
        
        assert config.get("database", "host") == "db.example.com"
        assert config.get("database", "port") == 5432
        assert config.get("api", "port") == 8080
        assert config.get("api", "debug") is True
    
    def test_load_from_yaml(self):
        """Test loading from YAML configuration file."""
        config = ConfigManager(config_path=str(self.yaml_path))
        config.load_from_file()
        
        assert config.get("database", "host") == "db.example.org"
        assert config.get("database", "user") == "test_user"
        assert config.get("database", "password") == "test_password"
        assert config.get("shopify", "api_key") == "test_key"
        assert config.get("shopify", "api_secret") == "test_secret"
    
    def test_load_from_ini(self):
        """Test loading from INI configuration file."""
        config = ConfigManager(config_path=str(self.ini_path))
        config.load_from_file()
        
        assert config.get("database", "host") == "db.example.net"
        assert config.get("database", "port") == "5433"  # Note: INI values are strings
        assert config.get("api", "base_path") == "/api/v2"
    
    def test_load_defaults(self):
        """Test loading default configuration."""
        config = ConfigManager()
        config.load_defaults(self.default_config)
        
        assert config.get("database", "host") == "localhost"
        assert config.get("database", "port") == 5432
        assert config.get("api", "host") == "0.0.0.0"
        assert config.get("api", "port") == 8000
    
    def test_priority_order(self):
        """Test configuration priority order."""
        # Set up environment variables (highest priority)
        with patch.dict(os.environ, {
            "SHOPIFY_MCP_DATABASE__HOST": "env.example.com"
        }):
            # Create config
            config = ConfigManager(config_path=str(self.json_path))
            config.load_defaults(self.default_config)  # Lowest priority
            config.load_from_file()  # Medium priority
            config.load_from_env()  # Highest priority
            
            # Check priority: ENV_VARS > CONFIG_FILE > DEFAULT
            assert config.get("database", "host") == "env.example.com"  # From env
            
            # When setting runtime values (highest priority)
            config.set("database", "host", "runtime.example.com", source=ConfigSource.RUNTIME)
            assert config.get("database", "host") == "runtime.example.com"
    
    def test_get_with_default(self):
        """Test getting config with default value for missing keys."""
        config = ConfigManager()
        
        # No configuration loaded yet, should return default
        assert config.get("database", "host", default="default.example.com") == "default.example.com"
        assert config.get("nonexistent", "key", default="default_value") == "default_value"
        
        # Load configuration
        config.load_from_file(str(self.json_path))
        
        # Existing keys should return configured value
        assert config.get("database", "host") == "db.example.com"
        
        # Non-existent keys should return default
        assert config.get("database", "user", default="default_user") == "default_user"
        assert config.get("nonexistent", "key", default="default_value") == "default_value"
    
    def test_convert_env_value(self):
        """Test conversion of environment variable string values to appropriate types."""
        config = ConfigManager()
        
        # Boolean values
        assert config._convert_env_value("true") is True
        assert config._convert_env_value("True") is True
        assert config._convert_env_value("yes") is True
        assert config._convert_env_value("1") is True
        assert config._convert_env_value("false") is False
        assert config._convert_env_value("False") is False
        assert config._convert_env_value("no") is False
        assert config._convert_env_value("0") is False
        
        # Numeric values
        assert config._convert_env_value("123") == 123
        assert config._convert_env_value("123.45") == 123.45
        
        # JSON values
        assert config._convert_env_value('{"key": "value"}') == {"key": "value"}
        assert config._convert_env_value('[1, 2, 3]') == [1, 2, 3]
        
        # String values
        assert config._convert_env_value("hello") == "hello"
        assert config._convert_env_value("123abc") == "123abc"
    
    def test_load_from_env(self):
        """Test loading configuration from environment variables."""
        env_vars = {
            "SHOPIFY_MCP_DATABASE__HOST": "env.example.com",
            "SHOPIFY_MCP_DATABASE__PORT": "5555",
            "SHOPIFY_MCP_API__DEBUG": "true",
            "SHOPIFY_MCP_API__CORS_ORIGINS": '["http://example.com", "https://example.org"]',
            "SHOPIFY_MCP_LOG_LEVEL": "DEBUG"
        }
        
        with patch.dict(os.environ, env_vars):
            config = ConfigManager(env_prefix="SHOPIFY_MCP_")
            config.load_from_env()
            
            # Check normal section__key format
            assert config.get("database", "host") == "env.example.com"
            assert config.get("database", "port") == 5555
            assert config.get("api", "debug") is True
            assert config.get("api", "cors_origins") == ["http://example.com", "https://example.org"]
            
            # Check top-level keys (without section)
            assert config.get("default", "log_level") == "DEBUG"
    
    def test_get_section(self):
        """Test getting all configuration values for a section."""
        # Set up config
        config = ConfigManager(config_path=str(self.json_path))
        config.load_defaults(self.default_config)
        config.load_from_file()
        
        # Get database section
        db_config = config.get_section("database")
        
        # Should contain merged values from default and file
        assert db_config["host"] == "db.example.com"  # From file
        assert db_config["port"] == 5432  # From file
        assert db_config["name"] == "test_db"  # From file
        assert db_config["user"] == "default_user"  # From default
        assert db_config["password"] == "default_pass"  # From default
    
    def test_get_all(self):
        """Test getting all configuration values."""
        # Set up config
        config = ConfigManager(config_path=str(self.json_path))
        config.load_defaults(self.default_config)
        config.load_from_file()
        
        # Get all config
        all_config = config.get_all()
        
        # Should contain merged values from all sources
        assert all_config["database"]["host"] == "db.example.com"  # From file
        assert all_config["database"]["user"] == "default_user"  # From default
        assert all_config["api"]["port"] == 8080  # From file
        assert all_config["api"]["host"] == "0.0.0.0"  # From default
    
    def test_save_to_file(self):
        """Test saving configuration to a file."""
        # Set up config
        config = ConfigManager()
        config.load_defaults(self.default_config)
        
        # Change some values
        config.set("database", "host", "new.example.com")
        config.set("api", "port", 9000)
        
        # Save to a new file
        new_config_path = self.config_dir / "new_config.yaml"
        config.save_to_file(str(new_config_path), ConfigFileFormat.YAML)
        
        # Load the saved file
        saved_config = ConfigManager(config_path=str(new_config_path))
        saved_config.load_from_file()
        
        # Check values
        assert saved_config.get("database", "host") == "new.example.com"
        assert saved_config.get("api", "port") == 9000
    
    def test_validation(self):
        """Test validation of configuration values."""
        config = ConfigManager()
        
        # Register validator
        def validate_port(value):
            if not 1 <= value <= 65535:
                raise ValueError("Port must be between 1 and 65535")
            return value
        
        config.register_validator("api.port", validate_port)
        
        # Valid value
        config.set("api", "port", 8080)
        assert config.get("api", "port") == 8080
        
        # Invalid value
        with pytest.raises(ValueError):
            config.set("api", "port", 70000)
    
    def test_encryption(self):
        """Test encryption of sensitive values."""
        # Generate a key for testing
        from cryptography.fernet import Fernet
        key = Fernet.generate_key()
        
        # Set up config with encryption
        config = ConfigManager(encryption_key=key, sensitive_keys={"database.password"})
        
        # Set sensitive value
        config.set("database", "password", "super_secret")
        
        # Get raw config (should be encrypted)
        raw_config = config._config[ConfigSource.RUNTIME]["database"]["password"]
        assert isinstance(raw_config, dict)
        assert raw_config.get("is_encrypted") is True
        assert raw_config.get("value") != "super_secret"
        
        # Get value through accessor (should be decrypted)
        assert config.get("database", "password") == "super_secret"
    
    def test_refresh(self):
        """Test refreshing configuration from all sources."""
        # Set up initial config
        config = ConfigManager(config_path=str(self.json_path))
        config.load_from_file()
        
        # Check initial values
        assert config.get("database", "host") == "db.example.com"
        
        # Modify the config file
        modified_config = {
            "database": {
                "host": "modified.example.com",
                "port": 5432,
                "name": "test_db"
            }
        }
        with open(self.json_path, "w") as f:
            json.dump(modified_config, f)
        
        # Refresh config
        config.refresh()
        
        # Check updated value
        assert config.get("database", "host") == "modified.example.com"


class TestConfigIntegration:
    """Integration tests for configuration functions."""
    
    def setup_method(self):
        """Set up test fixtures."""
        # Create test configuration file
        self.temp_dir = tempfile.TemporaryDirectory()
        self.config_dir = Path(self.temp_dir.name)
        
        self.config = {
            "database": {
                "host": "db.example.com",
                "port": 5432,
                "name": "test_db",
                "user": "test_user",
                "password": "test_pass"
            },
            "api": {
                "host": "0.0.0.0",
                "port": 8080,
                "debug": True
            },
            "security": {
                "secret_key": "a" * 32,
                "allowed_hosts": ["example.com"]
            }
        }
        self.config_path = self.config_dir / "config.json"
        with open(self.config_path, "w") as f:
            json.dump(self.config, f)
        
        # Reset global config manager
        import src.config_manager
        src.config_manager._config_manager = None
    
    def teardown_method(self):
        """Tear down test fixtures."""
        self.temp_dir.cleanup()
        
        # Reset global config manager
        import src.config_manager
        src.config_manager._config_manager = None
    
    def test_init_and_get_config(self):
        """Test initializing and getting global config manager."""
        # Initialize global config
        init_config(config_path=str(self.config_path))
        
        # Get global config
        config = get_config()
        
        # Check values
        assert config.get("database", "host") == "db.example.com"
        assert config.get("api", "port") == 8080
    
    def test_config_helpers(self):
        """Test helper functions for getting typed config sections."""
        # Initialize global config
        init_config(config_path=str(self.config_path))
        
        # Test database config
        db_config = DatabaseConfig(**get_config().get_section("database"))
        assert db_config.host == "db.example.com"
        assert db_config.port == 5432
        assert db_config.name == "test_db"
        assert db_config.get_connection_url() == "postgresql://test_user:test_pass@db.example.com:5432/test_db"
        
        # Test API config
        api_config = ApiConfig(**get_config().get_section("api"))
        assert api_config.host == "0.0.0.0"
        assert api_config.port == 8080
        assert api_config.debug is True
        
        # Test security config
        security_config = SecurityConfig(**get_config().get_section("security"))
        assert security_config.secret_key == "a" * 32
        assert security_config.allowed_hosts == ["example.com"]
    
    def test_section_factory(self):
        """Test creating configuration section classes with factory."""
        # Initialize global config
        init_config(config_path=str(self.config_path))
        
        # Define field types with (type, default, description)
        fields = {
            "host": (str, "localhost", "Database hostname"),
            "port": (int, 5432, "Database port"),
            "name": (str, "default_db", "Database name"),
        }
        
        # Define validators
        def validate_port(value):
            if not 1 <= value <= 65535:
                raise ValueError("Port must be between 1 and 65535")
            return value
        
        validators = {
            "port": validate_port
        }
        
        # Create section class
        DbConfig = ConfigSectionFactory.create_section_class(
            "database",
            fields,
            validators
        )
        
        # Create instance with loaded values
        db_config = DbConfig(**get_config().get_section("database"))
        
        # Check values
        assert db_config.host == "db.example.com"
        assert db_config.port == 5432
        assert db_config.name == "test_db"


class TestDefaultConfig:
    """Tests for default configuration generation."""
    
    def test_generate_default_config(self):
        """Test generating default configuration."""
        config_yaml = generate_default_config()
        config = yaml.safe_load(config_yaml)
        
        # Check that all expected sections exist
        expected_sections = {"database", "api", "shopify", "cache", "logging", "security"}
        assert set(config.keys()) == expected_sections
        
        # Check some specific values
        assert config["database"]["host"] == "localhost"
        assert config["api"]["port"] == 8000
        assert config["shopify"]["api_version"] == "2023-10"
        assert config["cache"]["ttl"] == 3600
        assert config["logging"]["level"] == "INFO"
        assert len(config["security"]["secret_key"]) > 10  # Should be a placeholder


@patch("src.config_manager.logging")
def test_configure_logging(mock_logging):
    """Test logging configuration."""
    # Setup
    mock_logger = MagicMock()
    mock_logging.getLogger.return_value = mock_logger
    mock_formatter = MagicMock()
    mock_logging.Formatter.return_value = mock_formatter
    mock_handler = MagicMock()
    mock_logging.StreamHandler.return_value = mock_handler
    mock_file_handler = MagicMock()
    mock_logging.FileHandler.return_value = mock_file_handler
    
    # Initialize config with logging section
    with patch.dict(os.environ, {
        "SHOPIFY_MCP_LOGGING__LEVEL": "DEBUG",
        "SHOPIFY_MCP_LOGGING__FILE": "/tmp/test.log"
    }):
        init_config()
        from src.config_manager import configure_logging
        configure_logging()
    
    # Verify logging was configured
    mock_logging.getLogger.assert_called_once()
    mock_logger.setLevel.assert_called_once_with(mock_logging.DEBUG)
    mock_logging.StreamHandler.assert_called_once()
    mock_logging.FileHandler.assert_called_once_with("/tmp/test.log")
    mock_handler.setFormatter.assert_called_once_with(mock_formatter)
    mock_file_handler.setFormatter.assert_called_once_with(mock_formatter)
    assert mock_logger.addHandler.call_count == 2  # Console and file handlers