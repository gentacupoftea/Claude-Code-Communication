# Shopify MCP Server - Google Cloud Platform Infrastructure

This directory contains the complete Google Cloud Platform (GCP) infrastructure implementation for the Shopify MCP Server project.

## 🏗️ Architecture Overview

The infrastructure consists of several key components:

### Core Infrastructure
- **GCPInfraManager**: Manages all GCP resources and infrastructure provisioning
- **ServiceGateway**: API gateway for routing requests to microservices
- **MicroserviceManager**: Handles deployment and management of microservices
- **DataLayerClient**: Unified data access layer for all storage services
- **EventBroker**: Event-driven messaging system using Pub/Sub
- **MonitoringService**: Comprehensive monitoring and alerting
- **ConfigManager**: Centralized configuration management

### Microservices
- **AuthService**: Authentication and authorization
- **ShopifyService**: Shopify API integration
- **AnalyticsService**: Analytics and reporting
- **ExportService**: Data export functionality

### Data Layer
- **Firestore**: NoSQL database for real-time data
- **BigQuery**: Data warehouse for analytics
- **Cloud Storage**: Object storage for files and backups
- **Memorystore (Redis)**: Caching layer

### Infrastructure as Code
- **Terraform**: Complete infrastructure definition
- **Docker**: Containerization for all services
- **Kubernetes**: Orchestration using GKE

## 📋 Prerequisites

- Google Cloud SDK (`gcloud`)
- Terraform >= 1.0
- Docker
- kubectl
- Node.js >= 18

## 🚀 Quick Start

### 1. Set up your environment

```bash
# Set environment variables
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="asia-northeast1"
export ENVIRONMENT="production"

# Authenticate with GCP
gcloud auth login
gcloud config set project $GCP_PROJECT_ID
```

### 2. Deploy the infrastructure

```bash
# Make the deployment script executable
chmod +x src/cloud/gcp/scripts/deploy.sh

# Deploy everything
./src/cloud/gcp/scripts/deploy.sh all
```

This will:
1. Build Docker images for all services
2. Deploy infrastructure using Terraform
3. Deploy services to GKE
4. Set up monitoring and logging
5. Configure networking and security

### 3. Verify the deployment

```bash
# Check deployment status
./src/cloud/gcp/scripts/deploy.sh verify

# Get the external IP
kubectl get ingress -n shopify-mcp
```

## 🛠️ Development Setup

For local development, use Docker Compose:

```bash
# Start all services locally
docker-compose -f src/cloud/gcp/docker-compose.yml up

# Access services at:
# - Auth: http://localhost:3001
# - Shopify: http://localhost:3002
# - Analytics: http://localhost:3006
# - Export: http://localhost:3007
# - Gateway: http://localhost:8080
```

## 📁 Directory Structure

```
src/cloud/gcp/
├── core/               # Core infrastructure components
├── services/           # Microservices implementation
├── config/             # Configuration files
├── terraform/          # Infrastructure as Code
├── scripts/            # Deployment and utility scripts
├── docker-compose.yml  # Local development setup
└── README.md          # This file
```

## 🔐 Security

### Service Accounts
- `shopify-mcp-runtime`: Runtime service account with necessary permissions
- `shopify-mcp-deployer`: Deployment service account for CI/CD
- `shopify-mcp-function`: Cloud Function service account

### Network Security
- VPC with private subnets
- Firewall rules for controlled access
- Cloud NAT for egress traffic
- Private GKE cluster

### Secrets Management
- Google Secret Manager for sensitive data
- Kubernetes secrets for runtime configuration
- Encrypted environment variables

## 📊 Monitoring and Logging

### Metrics
- Application metrics using Cloud Monitoring
- Custom metrics for business KPIs
- Performance tracking

### Logging
- Structured logging with Cloud Logging
- Log aggregation and analysis
- Error tracking and alerting

### Dashboards
- Grafana dashboards for visualization
- Custom dashboards in Cloud Console
- Real-time monitoring

## 🌍 Multi-Region Support

The infrastructure is designed for multi-region deployment:

### Primary Region: asia-northeast1 (Tokyo)
- Main deployment region
- Optimized for Japanese market

### Additional Regions
- us-central1 (USA)
- europe-west1 (Belgium)

### Global Resources
- Cloud CDN for static assets
- Global load balancing
- Multi-region data replication

## 💰 Cost Optimization

### Resource Management
- Auto-scaling for dynamic workloads
- Preemptible nodes for batch jobs
- Resource quotas and limits

### Storage Optimization
- Lifecycle policies for data archival
- Nearline storage for backups
- Data compression

### Monitoring
- Cost alerts and budgets
- Resource utilization tracking
- Rightsizing recommendations

## 🔄 CI/CD Pipeline

### GitHub Actions
- Automated testing
- Docker image building
- Terraform validation

### Cloud Build
- Automated deployments
- Security scanning
- Integration testing

### Deployment Strategy
- Blue-green deployments
- Canary releases
- Rollback capabilities

## 🆘 Troubleshooting

### Common Issues

1. **Deployment fails**
   ```bash
   # Check logs
   gcloud logging read --limit 50
   
   # Check pod status
   kubectl get pods -n shopify-mcp
   ```

2. **Service not accessible**
   ```bash
   # Check ingress status
   kubectl describe ingress -n shopify-mcp
   
   # Check service endpoints
   kubectl get endpoints -n shopify-mcp
   ```

3. **Database connection issues**
   ```bash
   # Check Firestore status
   gcloud firestore operations list
   
   # Check Redis connectivity
   gcloud redis instances describe shopify-mcp-cache
   ```

## 📚 Documentation

- [API Documentation](./docs/api.md)
- [Architecture Guide](./docs/architecture.md)
- [Deployment Guide](./docs/deployment.md)
- [Security Guide](./docs/security.md)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test locally using Docker Compose
4. Submit a pull request

## 📄 License

Copyright (c) 2024 Shopify MCP Server. All rights reserved.

---

Built with ❤️ for the Shopify ecosystem