# Conea Staging Deployment

This document provides information about the staging deployment process for the Conea MCP Platform.

## Deployment URL

The application is deployed at: https://staging.conea.ai

## Deployment Components

The deployment consists of:

1. **Backend API Server**
   - Python-based API server
   - Handles all business logic and data operations
   - Connects to MongoDB for data storage
   - Provides WebSocket connections for real-time updates

2. **Frontend Application**
   - React-based single-page application
   - Responsive design for desktop and mobile
   - Connects to the backend API
   - Deployed as static files to a hosting service

3. **Database**
   - MongoDB for structured data storage
   - Redis for caching and session management

4. **Nginx Reverse Proxy**
   - Handles routing between frontend and backend
   - Manages SSL certificate for HTTPS
   - Provides basic security measures

## Deployment Process

The deployment process is automated using Docker and Docker Compose. The process includes:

1. Building Docker images for the backend and frontend
2. Setting up the required environment variables
3. Running the containers with the correct configuration
4. Verifying the deployment with health checks

To deploy manually, run:

```bash
cd /Users/mourigenta/shopify-mcp-server/deployment/staging
./deploy.sh
```

To verify the deployment:

```bash
cd /Users/mourigenta/shopify-mcp-server/deployment/staging
./verify-deployment.sh
```

For static-only deployments:

```bash
cd /Users/mourigenta/shopify-mcp-server/deployment/staging/static
./deploy-static.sh
```

## Troubleshooting

If the deployment fails, check the following:

1. Docker container logs:
```bash
docker logs conea-backend-staging
docker logs conea-frontend-staging
```

2. Nginx configuration:
```bash
docker exec conea-nginx-staging nginx -t
```

3. Database connectivity:
```bash
docker exec conea-backend-staging python -c "import pymongo; print(pymongo.MongoClient('mongodb://mongo:27017/').admin.command('ping'))"
```

## Rollback Procedure

To rollback to a previous version:

1. Find the previous image tag:
```bash
docker images | grep conea
```

2. Update the docker-compose.yml file with the previous tag:
```bash
sed -i 's/conea\\/backend:staging/conea\\/backend:staging-previous/g' docker-compose.yml
```

3. Redeploy:
```bash
docker-compose down
docker-compose up -d
```

## Contact

For deployment issues, contact the DevOps team at dev-ops@conea.ai