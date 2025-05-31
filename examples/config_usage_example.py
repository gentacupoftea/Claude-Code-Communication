"""
Example of using the configuration management system.

This example demonstrates how to:
1. Initialize the configuration manager
2. Load configuration from different sources
3. Access configuration values
4. Create and use typed configuration sections
5. Update configuration at runtime
"""
import os
import logging
from src.config_manager import (
    init_config, get_config, ConfigSource, ConfigSectionFactory,
    get_database_config, get_api_config, get_shopify_config,
    get_cache_config, get_logging_config, get_security_config,
    configure_logging
)

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def basic_usage():
    """Demonstrate basic usage of the configuration manager."""
    logger.info("=== Basic Configuration Usage ===")
    
    # Default configuration values
    defaults = {
        "database": {
            "host": "localhost",
            "port": 5432,
            "name": "shopify_mcp",
            "user": "postgres",
            "password": "postgres"
        },
        "api": {
            "host": "0.0.0.0",
            "port": 8000,
            "debug": False
        }
    }
    
    # Initialize configuration manager
    config_path = os.path.join(os.path.dirname(__file__), "../shopify-mcp-config.json")
    config_manager = init_config(
        config_path=config_path,
        env_prefix="SHOPIFY_MCP_",
        defaults=defaults
    )
    
    # Access configuration values
    db_host = config_manager.get("database", "host")
    db_port = config_manager.get("database", "port")
    logger.info(f"Database connection: {db_host}:{db_port}")
    
    # Get all values for a section
    db_config = config_manager.get_section("database")
    logger.info(f"Database configuration: {db_config}")
    
    # Set a value at runtime
    config_manager.set("api", "debug", True, source=ConfigSource.RUNTIME)
    debug_mode = config_manager.get("api", "debug")
    logger.info(f"API debug mode: {debug_mode}")


def typed_sections():
    """Demonstrate typed configuration sections."""
    logger.info("\n=== Typed Configuration Sections ===")
    
    # Get typed database configuration
    db_config = get_database_config()
    logger.info(f"Database host: {db_config.host}")
    logger.info(f"Database port: {db_config.port}")
    logger.info(f"Connection URL: {db_config.get_connection_url()}")
    
    # Get typed API configuration
    api_config = get_api_config()
    logger.info(f"API host: {api_config.host}")
    logger.info(f"API port: {api_config.port}")
    logger.info(f"API debug mode: {api_config.debug}")
    
    # Get typed Shopify configuration
    shopify_config = get_shopify_config()
    logger.info(f"Shopify API version: {shopify_config.api_version}")
    logger.info(f"Shopify scopes: {shopify_config.scopes}")


def custom_section():
    """Demonstrate creating a custom configuration section."""
    logger.info("\n=== Custom Configuration Section ===")
    
    # Define field types and defaults
    fields = {
        "enabled": (bool, True, "Whether the feature is enabled"),
        "batch_size": (int, 100, "Batch size for processing"),
        "timeout": (int, 30, "Timeout in seconds"),
    }
    
    # Define validators
    validators = {
        "batch_size": lambda v: v if 1 <= v <= 1000 else 100,
        "timeout": lambda v: v if 1 <= v <= 300 else 30,
    }
    
    # Create a new section in the configuration
    config = get_config()
    config.set("feature", "enabled", True)
    config.set("feature", "batch_size", 200)
    config.set("feature", "timeout", 60)
    
    # Create section class
    FeatureConfig = ConfigSectionFactory.create_section_class(
        "feature",
        fields,
        validators
    )
    
    # Create instance with loaded values
    feature_config = FeatureConfig(**config.get_section("feature"))
    
    # Access typed properties
    logger.info(f"Feature enabled: {feature_config.enabled}")
    logger.info(f"Feature batch size: {feature_config.batch_size}")
    logger.info(f"Feature timeout: {feature_config.timeout}")


def environment_override():
    """Demonstrate environment variable overrides."""
    logger.info("\n=== Environment Variable Overrides ===")
    
    # The following would typically be set in the environment
    # We're simulating it in code for this example
    os.environ["SHOPIFY_MCP_DATABASE__HOST"] = "db.example.com"
    os.environ["SHOPIFY_MCP_API__PORT"] = "9000"
    
    # Refresh configuration to load environment variables
    get_config().refresh()
    
    # Get updated values
    db_host = get_config().get("database", "host")
    api_port = get_config().get("api", "port")
    
    logger.info(f"Database host (from env): {db_host}")
    logger.info(f"API port (from env): {api_port}")
    
    # Clean up environment
    del os.environ["SHOPIFY_MCP_DATABASE__HOST"]
    del os.environ["SHOPIFY_MCP_API__PORT"]


def encryption_example():
    """Demonstrate encryption of sensitive values."""
    logger.info("\n=== Encrypted Configuration Values ===")
    
    # Generate an encryption key
    from cryptography.fernet import Fernet
    key = Fernet.generate_key().decode()
    logger.info(f"Generated encryption key: {key}")
    
    # Set sensitive keys
    sensitive_keys = {"database.password", "shopify.api_secret"}
    
    # Initialize a new config with encryption
    config = init_config(
        encryption_key=key,
        sensitive_keys=sensitive_keys
    )
    
    # Set sensitive values
    config.set("database", "password", "super_secret_db_password")
    config.set("shopify", "api_secret", "top_secret_api_key")
    
    # Access values (decrypted automatically)
    db_password = config.get("database", "password")
    api_secret = config.get("shopify", "api_secret")
    
    logger.info(f"Database password (decrypted): {db_password}")
    logger.info(f"Shopify API secret (decrypted): {api_secret}")
    
    # Look at the raw configuration (should be encrypted)
    raw_config = config._config[ConfigSource.RUNTIME]
    logger.info(f"Raw database password entry: {raw_config['database']['password']}")
    logger.info(f"Raw Shopify API secret entry: {raw_config['shopify']['api_secret']}")


def main():
    """Main function to run all examples."""
    # Run basic usage example
    basic_usage()
    
    # Run typed sections example
    typed_sections()
    
    # Run custom section example
    custom_section()
    
    # Run environment override example
    environment_override()
    
    # Run encryption example
    encryption_example()
    
    # Configure logging based on configuration
    configure_logging()
    logger.info("\nLogging configured from configuration")


if __name__ == "__main__":
    main()