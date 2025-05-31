#!/usr/bin/env python3
"""
Shopify MCP Server - Basic Server Startup and Configuration Example

This script demonstrates how to start and configure the Shopify MCP Server
with both basic and advanced configuration options.
"""

import os
import sys
import json
import yaml
import time
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import server components
from src.config_manager import ConfigManager
from src.logging_manager import LoggingManager
from src.cache.cache_factory import CacheFactory
from src.sync.sync_scheduler import SyncScheduler
from src.sync.sync_manager import SyncManager


def setup_basic_server():
    """
    Demonstrates how to start the MCP server with basic configuration.
    """
    print("\n=== Starting Server with Basic Configuration ===\n")
    
    # Create basic configuration file
    config_path = "basic_config.json"
    basic_config = {
        "server": {
            "host": "127.0.0.1",
            "port": 8765,
            "workers": 4,
            "debug": True
        },
        "logging": {
            "level": "INFO",
            "file": "mcp_server.log",
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        },
        "cache": {
            "type": "memory",
            "memory_cache_size": 1000
        },
        "shopify": {
            "api_version": "2025-04",
            "retry_attempts": 3,
            "timeout": 30
        }
    }
    
    # Write config to file
    with open(config_path, 'w') as f:
        json.dump(basic_config, f, indent=2)
    
    print(f"Created basic configuration file: {config_path}")
    
    # Initialize configuration
    config = ConfigManager(config_path)
    print(f"Configuration loaded from: {config.config_path}")
    
    # Initialize logging system
    log_level = getattr(logging, config.get('logging.level', 'INFO'))
    logging_manager = LoggingManager(config, log_level)
    logger = logging_manager.get_logger("basic_example")
    
    logger.info("Shopify MCP Server initialized with basic configuration")
    
    # Display server settings
    print(f"Server would start on: {config.get('server.host')}:{config.get('server.port')}")
    print(f"With {config.get('server.workers')} workers")
    print(f"Cache type: {config.get('cache.type')}")
    print(f"Shopify API version: {config.get('shopify.api_version')}")
    
    # Clean up
    logger.info("Example completed")
    os.remove(config_path)
    
    print("\n=== Basic server setup completed ===\n")


def setup_advanced_server():
    """
    Demonstrates how to start the MCP server with advanced configuration.
    """
    print("\n=== Starting Server with Advanced Configuration ===\n")
    
    # Create advanced configuration file
    config_path = "advanced_config.yaml"
    advanced_config = """
server:
  host: 0.0.0.0
  port: 8765
  workers: 8
  debug: false
  timeout: 120
  cors:
    enabled: true
    allow_origins: ["https://admin.example.com", "https://dashboard.example.com"]
    allow_methods: ["GET", "POST", "PUT", "DELETE"]

logging:
  level: INFO
  file: logs/mcp_server.log
  format: "%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s"
  rotation:
    when: midnight
    interval: 1
    backup_count: 7
  syslog:
    enabled: false
    facility: local7

cache:
  type: redis
  memory_cache_size: 10000
  redis_ttl: 3600
  memory_ttl: 300
  enable_compression: true
  compression_min_size: 1024
  enable_adaptive_ttl: true
  redis:
    host: localhost
    port: 6379
    db: 0
    socket_timeout: 2.0
    connection_pool_size: 10
  enable_dependency_tracking: true
  dependency_tracker:
    dependency_ttl: 86400
    max_dependencies_per_key: 1000
    dependency_cleanup_interval: 3600

shopify:
  api_version: 2025-04
  retry_attempts: 5
  timeout: 60
  rate_limiting:
    enabled: true
    max_requests_per_second: 2
    bucket_size: 10
  graphql:
    use_optimized_client: true
    batch_size: 250
    max_retries: 3
    enable_cost_analysis: true

sync:
  enabled: true
  default_interval: 300
  max_concurrent_jobs: 5
  batch_size: 50
  error_retry_delay: 60
  jobs:
    products:
      enabled: true
      interval: 900
      priority: high
    orders:
      enabled: true
      interval: 300
      priority: highest
    inventory:
      enabled: true
      interval: 600
      priority: medium
    customers:
      enabled: false
      interval: 1800
      priority: low

security:
  auth:
    enabled: true
    jwt_secret: "change_this_in_production"
    token_expiry: 86400
  rate_limiting:
    enabled: true
    default_limit: 60
    window_size: 60
  ip_whitelist:
    enabled: false
    allowed_ips: []
"""
    
    # Write config to file
    with open(config_path, 'w') as f:
        f.write(advanced_config)
    
    print(f"Created advanced configuration file: {config_path}")
    
    # Initialize configuration
    config = ConfigManager(config_path)
    print(f"Configuration loaded from: {config.config_path}")
    
    # Initialize logging system
    log_level = getattr(logging, config.get('logging.level', 'INFO'))
    logging_manager = LoggingManager(config, log_level)
    logger = logging_manager.get_logger("advanced_example")
    
    logger.info("Shopify MCP Server initialized with advanced configuration")
    
    # Initialize cache system
    cache_type = config.get('cache.type', 'memory')
    cache_config = config.get('cache', {})
    cache_factory = CacheFactory(cache_type, cache_config)
    
    # Create cache manager with mocked Redis for example
    try:
        from unittest.mock import MagicMock
        redis_mock = MagicMock()
        cache_manager = cache_factory.create_cache_manager_with_client(redis_mock)
        logger.info(f"Cache system initialized with type: {cache_type}")
    except ImportError as e:
        logger.warning(f"Could not initialize Redis cache: {e}")
        cache_manager = cache_factory.create_memory_cache_manager()
        logger.info("Fallback to memory cache")
    
    # Initialize sync manager (if enabled)
    if config.get('sync.enabled', False):
        sync_manager = SyncManager(config, cache_manager, logger)
        sync_scheduler = SyncScheduler(sync_manager, config)
        
        # Print sync job configuration
        print("\nSync Jobs Configuration:")
        for job_name, job_config in config.get('sync.jobs', {}).items():
            status = "Enabled" if job_config.get('enabled', False) else "Disabled"
            interval = job_config.get('interval', config.get('sync.default_interval', 300))
            priority = job_config.get('priority', 'medium')
            print(f"  - {job_name}: {status}, Interval: {interval}s, Priority: {priority}")
    
    # Display server settings
    print("\nServer Configuration:")
    print(f"Server would start on: {config.get('server.host')}:{config.get('server.port')}")
    print(f"With {config.get('server.workers')} workers")
    print(f"Cache type: {config.get('cache.type')}")
    print(f"Shopify API version: {config.get('shopify.api_version')}")
    print(f"Rate limiting: {'Enabled' if config.get('shopify.rate_limiting.enabled', False) else 'Disabled'}")
    
    # Display security settings
    print("\nSecurity Configuration:")
    print(f"Authentication: {'Enabled' if config.get('security.auth.enabled', False) else 'Disabled'}")
    print(f"API Rate limiting: {'Enabled' if config.get('security.rate_limiting.enabled', False) else 'Disabled'}")
    print(f"IP Whitelist: {'Enabled' if config.get('security.ip_whitelist.enabled', False) else 'Disabled'}")
    
    # Clean up
    logger.info("Example completed")
    os.remove(config_path)
    
    print("\n=== Advanced server setup completed ===\n")


def simulate_server_startup():
    """
    Simulates the actual server startup process.
    """
    print("\n=== Simulating Server Startup ===\n")
    
    # Create a simplified config for this example
    config_path = "startup_simulation.yaml"
    config_content = """
server:
  host: 127.0.0.1
  port: 8765
  workers: 2
  debug: true

logging:
  level: INFO
  file: mcp_server_simulation.log

cache:
  type: memory
  memory_cache_size: 1000

shopify:
  api_version: 2025-04
  retry_attempts: 3
  timeout: 30

sync:
  enabled: true
  default_interval: 30
  jobs:
    products:
      enabled: true
      interval: 60
    orders:
      enabled: true
      interval: 30
"""
    
    # Write config to file
    with open(config_path, 'w') as f:
        f.write(config_content)
    
    # Initialize configuration
    config = ConfigManager(config_path)
    
    # Initialize logging
    logging_manager = LoggingManager(config, logging.INFO)
    logger = logging_manager.get_logger("simulation")
    
    # Setup cache system
    cache_factory = CacheFactory(config.get('cache.type', 'memory'), config.get('cache', {}))
    cache_manager = cache_factory.create_cache_manager()
    
    # Setup sync system
    sync_manager = SyncManager(config, cache_manager, logger)
    sync_scheduler = SyncScheduler(sync_manager, config)
    
    # Simulate server startup
    print("Starting server simulation...")
    print(f"Server listening on {config.get('server.host')}:{config.get('server.port')}")
    print("Press Ctrl+C to stop the server")
    
    try:
        # Start sync scheduler
        sync_scheduler.start()
        
        # Simulate server running for a while
        for i in range(10):
            print(f"Server running... ({i+1}/10)")
            time.sleep(1)
        
        # Show sync status
        jobs_status = sync_manager.get_status()
        print("\nSync Jobs Status:")
        if hasattr(jobs_status, 'items'):
            for job_id, status in jobs_status.items():
                print(f"  - Job {job_id}: {status}")
        else:
            print("  No active sync jobs")
            
    except KeyboardInterrupt:
        print("\nReceived shutdown signal")
    finally:
        # Stop sync scheduler
        sync_scheduler.stop()
        
        # Clean up resources
        cache_manager.shutdown()
        
        # Remove config file
        os.remove(config_path)
        
        print("Server stopped")
    
    print("\n=== Server simulation completed ===\n")


def main():
    """Main function to run all examples."""
    print("Shopify MCP Server - Startup and Configuration Examples")
    
    # Run basic setup example
    setup_basic_server()
    
    # Run advanced setup example
    setup_advanced_server()
    
    # Run server startup simulation
    simulate_server_startup()
    
    print("\nAll examples completed successfully!")


if __name__ == "__main__":
    main()