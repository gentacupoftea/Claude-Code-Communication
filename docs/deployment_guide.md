# Conea Deployment Guide

This guide provides detailed instructions for deploying Conea v0.3.0 (formerly Shopify MCP Server) to production and staging environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Process Overview](#deployment-process-overview)
3. [Pre-deployment Preparation](#pre-deployment-preparation)
4. [Deployment Steps](#deployment-steps)
5. [Post-deployment Verification](#post-deployment-verification)
6. [Rollback Procedure](#rollback-procedure)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

Before beginning the deployment process, ensure you have the following:

### Required Access and Permissions

- Google Cloud Platform (GCP) project access with the following roles:
  - Cloud Run Admin
  - Service Account User
  - Storage Admin
  - Secret Manager Admin
  - Artifact Registry Admin
  - Monitoring Admin

### Required Tools

- gcloud CLI (version 420.0.0 or later)
- Docker (version 23.0.0 or later)
- git (version 2.30.0 or later)
- Python 3.9 or later

### Required Environment Setup

```bash
# Install required tools if needed
pip install -r requirements.txt

# Authenticate with Google Cloud
gcloud auth login
gcloud auth configure-docker asia-northeast1-docker.pkg.dev
```

### Required Configuration

- `.env` file with the following variables (see `.env.example` for template):
  - `PROJECT_ID`: GCP project ID
  - `REGION`: GCP region for deployment
  - `SERVICE_NAME`: Cloud Run service name
  - `DOMAIN`: Custom domain name (if applicable)
  - Additional environment-specific variables

## Deployment Process Overview

The deployment process follows these main stages:

1. **Pre-deployment preparation**: Code freeze, testing, and final checks
2. **Deployment execution**: Running the deployment script
3. **Post-deployment verification**: Testing the deployment
4. **Monitoring**: Ongoing observation of the live system

## Pre-deployment Preparation

### 1. Code Freeze and Version Update

```bash
# Ensure you're on the release branch
git checkout release/v0.3.0

# Verify version numbers
grep -r "0.3.0" --include="*.py" --include="*.md" .
```

### 2. Final Testing

```bash
# Run the full test suite
pytest

# Verify code coverage
pytest --cov=shopify_mcp_server --cov-report=html

# Run load tests
python tests/performance/test_api_response_time.py
```

### 3. Prepare Environment Configuration

```bash
# Create or update .env file
cp .env.example .env
nano .env

# Verify environment variables
python scripts/validate_env.py
```

### 4. Backup Current Production

```bash
# If upgrading an existing deployment, create a backup
./scripts/backup_production.sh
```

## Deployment Steps

### 1. Staging Deployment (Recommended First)

```bash
# Deploy to staging
./scripts/deploy_production.sh --environment=staging

# Verify staging deployment
./scripts/verify_deployment.sh --environment=staging
```

### 2. Production Deployment

```bash
# IMPORTANT: Ensure all staging tests pass before proceeding

# Deploy to production
./scripts/deploy_production.sh

# Verify production deployment
./scripts/verify_deployment.sh
```

### 3. Domain Configuration (If Needed)

After deployment, the script will output DNS configuration information:

```
IMPORTANT: Configure your DNS provider with the following:
NAME                    TYPE   DATA
mcp.shopify.example.com CNAME  ghs.googlehosted.com.
```

Add these DNS records at your DNS provider's management interface.

## Post-deployment Verification

### 1. Health Check

```bash
# Basic health check
curl https://api.conea.example.com/health

# Detailed health check
curl https://mcp.shopify.example.com/api/health/detailed
```

### 2. Functionality Verification

- Test MCP server discovery: `/mcp/tools`
- Test GraphQL queries: `/api/graphql`
- Verify REST API endpoints: `/api/v1/products`
- Check admin panel: `/admin` (if applicable)

### 3. Performance Verification

```bash
# Run post-deployment performance test
python scripts/verify_performance.py

# Check response times
curl -w "%{time_total}s\n" -o /dev/null -s https://api.conea.example.com/health
```

## Rollback Procedure

If critical issues are detected after deployment, follow these steps to roll back:

### Automatic Rollback

```bash
# For staging
./scripts/rollback_v0.3.0.sh --environment=staging

# For production
./scripts/rollback_v0.3.0.sh --environment=production
```

### Manual Rollback

If the automatic rollback script fails:

```bash
# 1. Update the Cloud Run service to use the previous image
gcloud run services update conea \
  --image=asia-northeast1-docker.pkg.dev/conea-prod/conea-repo/conea:v0.2.1 \
  --region=asia-northeast1 \
  --project=shopify-mcp-server-prod

# 2. Verify the rollback
curl https://api.conea.example.com/api/version
```

## Monitoring

### Logs

```bash
# View Cloud Run service logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=conea" \
  --project=shopify-mcp-server-prod \
  --limit=50
```

### Metrics and Alerts

The deployment script automatically sets up the following alerts:

1. **Error Rate Alert**: Triggers when 4xx/5xx error rate exceeds threshold
2. **Latency Alert**: Triggers when API response time exceeds threshold
3. **Custom Application Alerts**: Configured in the monitoring dashboard

Access the monitoring dashboard:
- GCP Console > Monitoring > Dashboards > "Conea"

## Troubleshooting

### Common Issues and Solutions

#### 1. Deployment Fails with Permission Errors

```
ERROR: Permission denied: service account does not have required permissions
```

**Solution**: Verify the service account has all required roles listed in Prerequisites.

#### 2. Container Fails to Start

```
Container failed to start. Failed to start and then listen on the port defined by the PORT environment variable.
```

**Solution**: Check the container logs for specific error messages.

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=shopify-mcp-server AND textPayload:error" \
  --project=shopify-mcp-server-prod \
  --limit=20
```

#### 3. API Rate Limit Errors

If you see rate limit errors in the logs:

```
Rate limit exceeded for API requests
```

**Solution**: Adjust the `RATE_LIMIT_ENABLED` and related parameters in your environment variables.

#### 4. High Memory Usage

If memory usage alerts trigger:

**Solution**: Increase the memory allocation in the deployment script:

```bash
# Modify the MEMORY parameter
MEMORY="4Gi"
```

## Additional Resources

- [GCP Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Docker Deployment Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Monitoring Guide](./monitoring-guide.md)
- [Security Guide](./security-guide.md)

## Contact Information

For assistance with deployment issues, contact:

- DevOps Team: devops@example.com
- Technical Lead: techlead@example.com
- Emergency Support: +1-888-555-1234