# Shopify MCP Server Usage Examples

This directory contains example scripts demonstrating how to use the Shopify MCP Server for various common tasks.

## Example Scripts

### 1. Basic Server Startup and Configuration

**File:** [server_startup_example.py](./server_startup_example.py)

Demonstrates how to start and configure the Shopify MCP Server with different options:
- Basic configuration with essential options
- Advanced configuration with detailed settings
- Server startup simulation
- Handling configuration via JSON and YAML files

### 2. MCP Server API Interaction 

**File:** [mcp_api_interaction_example.py](./mcp_api_interaction_example.py)

Shows how to programmatically interact with the Shopify MCP Server's API:
- Direct Shopify API client usage
- MCP Server REST API interaction
- Server status and metrics retrieval
- Sync job management via API
- Cache management via API
- GraphQL query execution through MCP

### 3. Sync Job Setup and Execution

**File:** [sync_job_example.py](./sync_job_example.py)

Demonstrates how to set up and run synchronization jobs:
- Creating and monitoring sync jobs
- Different sync directions (Shopify-to-External, External-to-Shopify, Bidirectional)
- Setting up scheduled sync jobs
- Sync job status monitoring
- Generating sync performance reports

### 4. Optimized Cache Usage

**File:** [optimized_cache_example.py](./optimized_cache_example.py)

Shows how to effectively use the cache system:
- Basic caching functionality
- Optimized caching with memory and Redis backends
- Cache dependency tracking
- Cache invalidation strategies
- Performance metrics collection
- Real-world web application scenario with caching

### 5. Monitoring and Visualization

**File:** [monitoring_visualization_example.py](./monitoring_visualization_example.py)

Demonstrates how to access and visualize monitoring data:
- Collecting system, API, cache, sync, and business metrics
- Generating textual monitoring reports
- Creating time series visualizations
- Analyzing hourly and daily patterns
- Correlation analysis between metrics
- Building monitoring dashboards

## Prerequisites

To run these examples, you'll need:

1. Python 3.9 or above
2. All required dependencies installed:
   ```
   pip install -r requirements.txt
   ```

3. For visualization examples, additional dependencies:
   ```
   pip install matplotlib numpy
   ```

4. For Redis cache examples (optional):
   ```
   pip install redis
   ```

## Running the Examples

Each example can be run directly:

```bash
python examples/server_startup_example.py
python examples/mcp_api_interaction_example.py
python examples/sync_job_example.py
python examples/optimized_cache_example.py
python examples/monitoring_visualization_example.py
```

Note that these examples use simulated data and mocked services for demonstration purposes. In a real environment, they would connect to actual Shopify stores and external services.

## Further Documentation

For more detailed information, refer to the main documentation:

- [API Reference](../docs/api-reference/README.md)
- [Developer Guide](../docs/developer-guide/README.md)
- [User Guide](../docs/user-guide/README.md)