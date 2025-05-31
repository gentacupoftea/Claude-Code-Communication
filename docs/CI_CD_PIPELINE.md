# CI/CD Pipeline Documentation

This document outlines the Continuous Integration (CI) and Continuous Deployment (CD) pipeline for the Shopify MCP Server project. The pipeline automates testing, building, and deploying the application to ensure code quality and streamline the release process.

## Overview

The CI/CD pipeline consists of two main workflows:

1. **Continuous Integration (CI)** - Runs on every push and pull request
2. **Continuous Deployment (CD)** - Runs on pushes to the main branch and when version tags are created

## Continuous Integration Workflow

The CI workflow is defined in `.github/workflows/ci.yml` and runs automatically on:
- Push events to `main` and `develop` branches
- Pull requests targeting the `main` branch

### CI Jobs

The CI workflow includes the following jobs:

1. **Test Matrix**
   - Runs tests across multiple operating systems and Python versions
   - Tests with different dependency levels (core, extended, full)
   - Verifies imports and runs adaptive tests
   - Generates test reports and uploads artifacts

2. **Network Resilience Validation**
   - Tests offline installation mode
   - Simulates network interruptions to validate error handling
   - Validates error messaging

## Continuous Deployment Workflow

The CD workflow is defined in `.github/workflows/cd.yml` and runs automatically on:
- Push events to the `main` branch
- Creation of version tags (e.g., `v1.0.0`)

### CD Jobs

The CD workflow includes the following jobs:

1. **Build**
   - Runs tests to ensure code quality
   - Builds the Docker image
   - Uploads the Docker image as an artifact

2. **Security Scan**
   - Scans the Docker image for vulnerabilities using Trivy
   - Uploads scan results in SARIF format

3. **Deploy to Staging**
   - Pushes the Docker image to Google Container Registry (GCR)
   - Deploys to the staging environment on Google Kubernetes Engine (GKE)
   - Runs integration tests against the staging environment
   - Sends deployment notifications via Slack

4. **Deploy to Production**
   - Only runs when a version tag is pushed
   - Pushes the Docker image to GCR with version and latest tags
   - Deploys to the production environment on GKE
   - Creates a GitHub release with release notes
   - Sends deployment notifications via Slack

5. **Rollback**
   - Automatically triggered if production deployment fails
   - Rolls back to the previous stable version
   - Sends rollback notifications via Slack

## Environment Configuration

The CD workflow uses GitHub Environments for `staging` and `production` to manage environment-specific secrets and protection rules. The following secrets are required:

- `GCP_SA_KEY` - Google Cloud Service Account key
- `GCP_PROJECT_ID` - Google Cloud project ID
- `GKE_CLUSTER` - Google Kubernetes Engine cluster name
- `GKE_ZONE` - Google Kubernetes Engine zone
- `SLACK_WEBHOOK` - Slack webhook URL for notifications

## Deployment Strategy

The deployment process follows these steps:

1. **Staging Deployment**
   - Every push to `main` is deployed to staging
   - Integration tests verify functionality
   - Provides an opportunity for manual testing

2. **Production Deployment**
   - Triggered by creating a version tag
   - Requires successful deployment to staging
   - Creates a GitHub release with release notes

3. **Rollback Strategy**
   - Automatic rollback on production deployment failure
   - Manual rollback possible by running the rollback workflow

## Monitoring and Notifications

- Slack notifications on deployment success/failure
- GitHub release creation for version tracking
- Error reports and logs for troubleshooting

## Best Practices

1. **Pull Request Workflow**
   - Create feature branches from `develop`
   - Submit pull requests to `develop` for integration
   - Merge `develop` to `main` for staging deployment
   - Create version tags on `main` for production deployment

2. **Versioning**
   - Follow semantic versioning (MAJOR.MINOR.PATCH)
   - Create version tags using the format `v1.0.0`

3. **Security**
   - All security scan results are stored as artifacts
   - Critical vulnerabilities block production deployment

## Troubleshooting

If a deployment fails:

1. Check the GitHub Actions logs for error messages
2. Verify that all required secrets are configured correctly
3. Ensure that the Kubernetes configuration is valid
4. Check the application logs in the deployed environment
5. If needed, trigger a manual rollback by running the rollback workflow

## Local Development

To test the CI/CD pipeline locally:

1. Install [act](https://github.com/nektos/act) to run GitHub Actions locally
2. Run `act push` to simulate a push event
3. Run `act pull_request` to simulate a pull request event

## Further Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Google Kubernetes Engine Documentation](https://cloud.google.com/kubernetes-engine/docs)
- [Docker Documentation](https://docs.docker.com/)