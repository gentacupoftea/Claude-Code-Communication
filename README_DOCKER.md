# Docker Support

This repository includes configuration files for running the Shopify MCP Server with Docker and Docker Compose.

## Setup

1. Build the Docker image:
   ```bash
   docker-compose build
   ```
2. Start the development server:
   ```bash
   docker-compose up dev
   ```
3. Run the tests inside a container:
   ```bash
   docker-compose run --rm test
   ```
4. Start the production server:
   ```bash
   docker-compose up -d prod
   ```

Environment variables can be configured using `.env` files or passed directly via the Compose service definitions.
