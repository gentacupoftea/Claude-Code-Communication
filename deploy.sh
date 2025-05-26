#!/bin/bash

# Shopify MCP Server - Google Cloud Deployment Script
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Shopify MCP Server - Google Cloud Deployment${NC}"
echo "=================================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Load environment variables
if [ -f .env.staging ]; then
    echo -e "${YELLOW}📄 Loading staging environment variables...${NC}"
    source .env.staging
else
    echo -e "${RED}❌ .env.staging file not found${NC}"
    exit 1
fi

# Set default values if not provided
PROJECT_ID=${PROJECT_ID:-"conea-staging"}
REGION=${REGION:-"asia-northeast1"}
SERVICE_NAME=${SERVICE_NAME:-"shopify-mcp-server"}

echo -e "${BLUE}📋 Deployment Configuration:${NC}"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service Name: $SERVICE_NAME"
echo ""

# Set the project
echo -e "${YELLOW}🔧 Setting Google Cloud project...${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}🔌 Enabling required Google Cloud APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com

# Create secrets if they don't exist
echo -e "${YELLOW}🔐 Setting up secrets...${NC}"

# Create app secrets
if ! gcloud secrets describe app-secrets &>/dev/null; then
    echo "Creating app-secrets..."
    echo -n "$(openssl rand -base64 32)" | gcloud secrets create app-secrets --data-file=-
fi

# Create JWT secret
if ! gcloud secrets describe jwt-secret &>/dev/null; then
    echo "Creating jwt-secret..."
    echo -n "$(openssl rand -base64 32)" | gcloud secrets create jwt-secret --data-file=-
fi

# Create Shopify secrets if configured
if [[ -n "$SHOPIFY_API_KEY" && "$SHOPIFY_API_KEY" != "staging_shopify_api_key_placeholder" ]]; then
    if ! gcloud secrets describe shopify-api-key &>/dev/null; then
        echo "Creating shopify-api-key..."
        echo -n "$SHOPIFY_API_KEY" | gcloud secrets create shopify-api-key --data-file=-
    fi
fi

if [[ -n "$SHOPIFY_API_SECRET" && "$SHOPIFY_API_SECRET" != "staging_shopify_api_secret_placeholder" ]]; then
    if ! gcloud secrets describe shopify-api-secret &>/dev/null; then
        echo "Creating shopify-api-secret..."
        echo -n "$SHOPIFY_API_SECRET" | gcloud secrets create shopify-api-secret --data-file=-
    fi
fi

# Build and deploy using Cloud Build
echo -e "${YELLOW}🔨 Building and deploying to Cloud Run...${NC}"
gcloud builds submit --config=cloudbuild.yaml \
    --substitutions=_REGION=$REGION,_SERVICE_NAME=$SERVICE_NAME

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Service URL: $SERVICE_URL${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Test the API: curl $SERVICE_URL/health"
echo "2. Update frontend API_BASE_URL to: $SERVICE_URL"
echo "3. Configure Shopify webhooks to: $SERVICE_URL/api/v1/shopify/webhooks"
echo ""
echo -e "${YELLOW}📖 View logs with:${NC}"
echo "gcloud run logs tail $SERVICE_NAME --region=$REGION"