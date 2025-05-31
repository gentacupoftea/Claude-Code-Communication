# Logging System

The Shopify MCP Server includes a comprehensive logging system with support for multiple destinations, structured logging, performance monitoring, and more.

## Features

- **Multiple log destinations**: Console, file, syslog
- **Different log levels per component**: Configure log levels independently for each component
- **Structured logging**: JSON format support for better log processing
- **Log rotation**: Manage log file size with automatic rotation
- **Context information**: Automatically include request ID, correlation ID, user ID, etc.
- **Performance logging**: Track and alert on slow operations
- **Sensitive information filtering**: Automatically redact sensitive data like passwords and tokens
- **Log volume metrics**: Track and report on log volume stats
- **Configurable**: Full integration with the config system

## Basic Usage

```python
from src.logging_manager import get_logger

# Get a logger for your module
logger = get_logger(__name__)

# Basic logging
logger.debug("Debug message")
logger.info("Info message")
logger.warning("Warning message")
logger.error("Error message")
logger.critical("Critical message")

# Logging with extra context
logger.info("User logged in", extra={"user_id": "12345", "ip_address": "192.168.1.1"})
```

## Context-Aware Logging

The logging system supports request-context awareness, which is essential for tracking operations across multiple components:

```python
from src.logging_manager import get_logger, request_context, set_request_id

# Set global request ID for the current thread
set_request_id("req-12345")

# Or use the context manager for a specific scope
with request_context(request_id="req-12345", user_id="user-101"):
    logger.info("Processing request")
    
    # All logs within this context will automatically include the request and user IDs
    process_order()  # Logs from this function will have the same context
```

## Performance Logging

Track the performance of functions and methods:

```python
from src.logging_manager import performance_log, get_logger

logger = get_logger(__name__)

# Basic performance tracking (default threshold)
@performance_log
def process_order(order_id):
    # Processing logic
    return result

# Custom threshold (in seconds)
@performance_log(threshold=0.5)
def validate_payment(payment_id):
    # Validation logic
    return result
```

## Configuration

### Basic Configuration

Configure via environment variables:

```bash
LOG_LEVEL=INFO
LOG_FORMAT="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
LOG_FILE=/var/log/shopify-mcp.log
LOG_JSON=false
LOG_SYSLOG=false
```

### Advanced Configuration

Configure via the config file (`shopify-mcp-config.yaml`):

```yaml
logging:
  level: INFO
  format: "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
  file: /var/log/shopify-mcp.log
  syslog: false
  json_format: false

logging_extended:
  enable_json_logging: true
  log_dir: logs
  app_name: shopify-mcp-server
  log_file_max_size: 10485760  # 10MB
  log_file_backup_count: 5
  enable_access_log: true
  enable_metrics: true
  metrics_interval: 60
  enable_syslog: false
  syslog_address: /dev/log
  syslog_facility: 1
  sample_rate: 1.0
  sensitive_fields:
    - password
    - token
    - secret
    - key
    - auth
    - credential
  performance_threshold: 1.0
  cloud_logging: false
  component_levels:
    database: WARNING
    api: DEBUG
    shopify: INFO
```

## Structured Logging

When JSON logging is enabled, logs are output in a structured format for easier processing by log management systems:

```json
{
  "timestamp": "2025-05-21T10:30:45.123Z",
  "level": "INFO",
  "logger": "shopify_mcp_server.api",
  "message": "Order processed successfully",
  "component": "api",
  "request_id": "req-12345",
  "correlation_id": "corr-67890",
  "user_id": "user-101",
  "hostname": "server-01",
  "app_name": "shopify-mcp-server",
  "environment": "production",
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
```

## Logging Sensitive Information

The logging system automatically redacts sensitive information:

```python
# This will redact the password in logs
logger.info("User logged in with password: 'mysecret'")
# Output: "User logged in with password: '[REDACTED]'"

# Dictionary fields with sensitive names are also redacted
user_data = {
    "username": "johndoe",
    "password": "very_secret",
    "api_keys": {
        "service1": "key1_secret"
    }
}
logger.info("User data", extra={"user_data": user_data})
# The password and api_keys fields will be redacted in the log output
```

## Log Metrics

When metrics are enabled, the system periodically logs statistics about log volume:

```json
{
  "timestamp": "2025-05-21T10:31:45.456Z",
  "level": "INFO",
  "logger": "src.logging_manager",
  "message": "Log metrics",
  "metrics": {
    "duration_seconds": 60.23,
    "logs_per_level": {
      "debug": 245,
      "info": 127,
      "warning": 12,
      "error": 3,
      "critical": 0
    },
    "logs_per_component": {
      "api": {
        "debug": 120,
        "info": 75,
        "warning": 5,
        "error": 1
      },
      "database": {
        "debug": 95,
        "info": 30,
        "warning": 7,
        "error": 2
      },
      "shopify": {
        "debug": 30,
        "info": 22
      }
    },
    "total_logs": 387,
    "logs_per_second": 6.42
  }
}
```

## Middleware Integration

Integrate with web frameworks by adding request context middleware:

### FastAPI Example

```python
from fastapi import FastAPI, Request, Response
from src.logging_manager import request_context, get_logger

app = FastAPI()
logger = get_logger(__name__)

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    
    with request_context(
        request_id=request_id,
        correlation_id=request.headers.get("X-Correlation-ID", ""),
        user_id=request.headers.get("X-User-ID", ""),
        method=request.method,
        path=request.url.path
    ):
        logger.info(f"Request started: {request.method} {request.url.path}")
        try:
            start_time = time.time()
            response = await call_next(request)
            duration = time.time() - start_time
            
            logger.info(
                f"Request completed: {request.method} {request.url.path}",
                extra={
                    "status_code": response.status_code,
                    "duration_seconds": duration
                }
            )
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            return response
        except Exception as e:
            logger.exception(f"Request failed: {request.method} {request.url.path}")
            raise
```

## Example

See the complete example in `examples/logging_example.py` for a demonstration of all logging features.