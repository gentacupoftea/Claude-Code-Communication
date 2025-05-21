"""
Example usage of the Shopify MCP Server logging system.

This example demonstrates various features of the logging system:
- Basic logging with different levels
- Context-aware logging
- Performance monitoring
- Sensitive data filtering
- Structured logging
"""

import os
import sys
import time
import logging

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import the logging manager
from src.logging_manager import (
    setup_logging,
    get_logger,
    set_request_id,
    set_correlation_id,
    set_user_id,
    set_context,
    log_context,
    request_context,
    performance_log,
    LoggingContextConfig,
)
from src.config_manager import init_config


def setup_example_config():
    """Set up a configuration for the example."""
    # Initialize the configuration system
    config_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'shopify-mcp-config.yaml'))
    config_manager = init_config(config_path=config_path)
    
    # Set some logging configuration
    config_manager.set('logging', 'level', 'DEBUG')
    config_manager.set('logging', 'format', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Set up the extended logging configuration
    extended_fields = LoggingContextConfig.fields
    for field_name, field_config in extended_fields.items():
        default_value = field_config[1]
        if field_name == 'enable_json_logging':
            # Enable JSON logging for the example
            config_manager.set('logging_extended', field_name, True)
        elif field_name == 'log_dir':
            # Set a log directory for the example
            config_manager.set('logging_extended', field_name, 'logs')
        elif field_name == 'app_name':
            # Set application name
            config_manager.set('logging_extended', field_name, 'shopify-mcp-example')
        elif field_name == 'component_levels':
            # Set some component-specific log levels
            config_manager.set('logging_extended', field_name, {
                'database': 'WARNING',
                'api': 'DEBUG',
            })
        else:
            # Use defaults for other fields
            config_manager.set('logging_extended', field_name, default_value)
    
    # Set up logging with our configuration
    setup_logging()
    
    return config_manager


@performance_log
def slow_function():
    """A deliberately slow function to demonstrate performance logging."""
    time.sleep(1.2)  # Sleep for 1.2 seconds to trigger performance warning
    return "Slow operation completed"


@performance_log(threshold=0.1)
def medium_function():
    """A medium-speed function with custom performance threshold."""
    time.sleep(0.2)  # Sleep for 0.2 seconds to trigger performance warning with lower threshold
    return "Medium operation completed"


def fast_function():
    """A fast function that won't trigger performance warnings."""
    return "Fast operation completed"


def log_with_sensitive_data(logger):
    """Demonstrate logging with sensitive data that should be filtered."""
    # This sensitive data should be filtered out
    logger.info("User authenticated with password: 'secret123'")
    logger.debug("API token: 'abc123xyz'")
    
    # Log with sensitive data in dictionary
    user_data = {
        "username": "johndoe",
        "email": "john@example.com",
        "password": "very_secret",
        "api_keys": {
            "service1": "key1_secret",
            "service2": "key2_secret"
        }
    }
    
    logger.info("User data processed", extra={"user_data": user_data})


def demonstrate_context_logging(logger):
    """Demonstrate context-aware logging."""
    # Set request-specific context
    set_request_id("req-12345")
    set_correlation_id("corr-67890")
    set_user_id("user-101")
    
    # Log with the context
    logger.info("Processing request with ID context")
    
    # Add more context
    set_context(tenant_id="tenant-202", feature="example")
    logger.info("Added tenant context")
    
    # Use the context manager for temporary context
    with log_context(operation="special-task", priority="high"):
        logger.info("Performing special task with temporary context")
    
    # The temporary context is gone, but the original context remains
    logger.info("Back to original context")
    
    # Use the request context manager
    with request_context(request_id="req-abcde", user_id="user-202", api="examples"):
        logger.info("Processing another request with different context")
    
    # Back to the original request context
    logger.info("Back to original request context")


def demonstrate_structured_logging(logger):
    """Demonstrate structured logging with extra fields."""
    # Log with extra structured data
    logger.info(
        "Order processed successfully",
        extra={
            "order_id": "order-12345",
            "customer_id": "cust-67890",
            "items_count": 3,
            "total_amount": 99.95,
            "shipping_method": "express",
            "metrics": {
                "processing_time_ms": 150,
                "payment_time_ms": 450
            }
        }
    )


def main():
    """Run the logging example."""
    # Set up configuration
    config_manager = setup_example_config()
    
    # Get a logger for this module
    logger = get_logger(__name__)
    
    # Basic logging at different levels
    logger.debug("This is a debug message")
    logger.info("This is an info message")
    logger.warning("This is a warning message")
    logger.error("This is an error message")
    logger.critical("This is a critical message")
    
    # Demonstrate context-aware logging
    demonstrate_context_logging(logger)
    
    # Demonstrate performance logging
    logger.info("Testing performance logging")
    result = slow_function()
    logger.info(f"Slow function returned: {result}")
    
    result = medium_function()
    logger.info(f"Medium function returned: {result}")
    
    result = fast_function()
    logger.info(f"Fast function returned: {result}")
    
    # Demonstrate sensitive data filtering
    logger.info("Testing sensitive data filtering")
    log_with_sensitive_data(logger)
    
    # Demonstrate structured logging
    logger.info("Testing structured logging")
    demonstrate_structured_logging(logger)
    
    # Log an exception
    try:
        # Deliberately cause an exception
        1 / 0
    except Exception as e:
        logger.exception("An error occurred during calculation", extra={"calculation_type": "division"})
    
    logger.info("Logging example completed")


if __name__ == "__main__":
    main()