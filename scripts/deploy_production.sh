#!/bin/bash
# Conea v0.3.0 Production Deployment Script

set -e  # Stop on errors

# Colored output functions
info() { echo -e "\033[1;34m[INFO]\033[0m $1"; }
success() { echo -e "\033[1;32m[SUCCESS]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARNING]\033[0m $1"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $1"; }

# Display banner
echo "======================================================"
echo "              Conea v0.3.0 Deployment                "
echo "======================================================"
echo ""

# Check for --dry-run flag
DRY_RUN=false
for arg in "$@"; do
  if [ "$arg" == "--dry-run" ]; then
    DRY_RUN=true
    warn "Running in DRY RUN mode. No actual changes will be made."
  fi
done

# Load environment variables
if [ -f .env ]; then
  info "Loading environment variables..."
  source .env
fi

# Set environment variables (use defaults if not set)
PROJECT_ID="${PROJECT_ID:-conea-prod}"
REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="${SERVICE_NAME:-conea}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-conea-sa@${PROJECT_ID}.iam.gserviceaccount.com}"
MEMORY="${MEMORY:-2Gi}"
CPU="${CPU:-2}"
MIN_INSTANCES="${MIN_INSTANCES:-1}"
MAX_INSTANCES="${MAX_INSTANCES:-5}"
CONCURRENCY="${CONCURRENCY:-100}"
IMAGE_NAME="${IMAGE_NAME:-${REGION}-docker.pkg.dev/${PROJECT_ID}/conea-repo/conea}"
IMAGE_TAG="${IMAGE_TAG:-v0.3.0}"
VERSION="0.3.0"
BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
ENVIRONMENT="${ENVIRONMENT:-production}"
DOMAIN="${DOMAIN:-api.conea.example.com}"

# Display parameters and confirmation
echo "Deployment parameters:"
echo "- Project ID: ${PROJECT_ID}"
echo "- Region: ${REGION}"
echo "- Service name: ${SERVICE_NAME}"
echo "- Service account: ${SERVICE_ACCOUNT}"
echo "- Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "- Environment: ${ENVIRONMENT}"
echo "- Memory: ${MEMORY}"
echo "- CPU: ${CPU}"
echo "- Min instances: ${MIN_INSTANCES}"
echo "- Max instances: ${MAX_INSTANCES}"
echo "- Domain: ${DOMAIN}"
echo ""

if [ "$DRY_RUN" = false ]; then
  read -p "Continue with deployment using these settings? (y/n): " CONTINUE
  if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
    error "Deployment cancelled."
    exit 1
  fi
fi

# Create backup
info "Creating backup..."
BACKUP_TIME=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/${BACKUP_TIME}"

if [ "$DRY_RUN" = false ]; then
  mkdir -p ${BACKUP_DIR}
  if [ -f .env ]; then
    cp .env ${BACKUP_DIR}/.env.backup
  fi
  
  # Backup any database data if applicable
  if [ -d "./data" ]; then
    cp -r ./data ${BACKUP_DIR}/data
  fi
else
  info "Would create backup in ${BACKUP_DIR}"
fi

# Verify service account
info "Checking service account..."
if [ "$DRY_RUN" = false ]; then
  if ! gcloud iam service-accounts describe ${SERVICE_ACCOUNT} --project=${PROJECT_ID} &>/dev/null; then
    warn "Service account ${SERVICE_ACCOUNT} does not exist. Creating..."
    gcloud iam service-accounts create $(echo ${SERVICE_ACCOUNT} | cut -d '@' -f1) \
      --display-name="Shopify MCP Server Service Account" \
      --project=${PROJECT_ID}
    
    # Grant required permissions
    info "Granting permissions to service account..."
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
      --member="serviceAccount:${SERVICE_ACCOUNT}" \
      --role="roles/secretmanager.secretAccessor"
    
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
      --member="serviceAccount:${SERVICE_ACCOUNT}" \
      --role="roles/storage.objectViewer"
  fi
fi

# Check Artifact Registry
info "Checking Artifact Registry..."
if [ "$DRY_RUN" = false ]; then
  if ! gcloud artifacts repositories describe shopify-repo --location=${REGION} --project=${PROJECT_ID} &>/dev/null; then
    warn "Artifact Registry 'shopify-repo' does not exist. Creating..."
    gcloud artifacts repositories create shopify-repo \
      --repository-format=docker \
      --location=${REGION} \
      --project=${PROJECT_ID} \
      --description="Shopify MCP Server Docker Repository"
  fi
fi

# Build Docker image
info "Building Docker image..."
if [ "$DRY_RUN" = false ]; then
  docker build \
    --file Dockerfile \
    --tag ${IMAGE_NAME}:${IMAGE_TAG} \
    --build-arg BUILD_DATE="${BUILD_DATE}" \
    --build-arg VERSION="${VERSION}" \
    --build-arg ENVIRONMENT="${ENVIRONMENT}" \
    .

  # Also tag as latest
  docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest

  # Push Docker image
  info "Pushing Docker image..."
  docker push ${IMAGE_NAME}:${IMAGE_TAG}
  docker push ${IMAGE_NAME}:latest
else
  info "Would build and push Docker image ${IMAGE_NAME}:${IMAGE_TAG}"
fi

# Deploy to Cloud Run
info "Deploying to Cloud Run..."
if [ "$DRY_RUN" = false ]; then
  gcloud run deploy ${SERVICE_NAME} \
    --image=${IMAGE_NAME}:${IMAGE_TAG} \
    --region=${REGION} \
    --project=${PROJECT_ID} \
    --platform=managed \
    --service-account=${SERVICE_ACCOUNT} \
    --memory=${MEMORY} \
    --cpu=${CPU} \
    --min-instances=${MIN_INSTANCES} \
    --max-instances=${MAX_INSTANCES} \
    --concurrency=${CONCURRENCY} \
    --timeout=300s \
    --ingress=all \
    --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},ENVIRONMENT=${ENVIRONMENT},MCP_SERVER_NAME=${SERVICE_NAME},MCP_SERVER_VERSION=${VERSION}" \
    --set-secrets="SHOPIFY_API_KEY=SHOPIFY_API_KEY:latest,SHOPIFY_API_SECRET=SHOPIFY_API_SECRET:latest,SESSION_SECRET=SESSION_SECRET:latest" \
    --allow-unauthenticated

  # Get service URL
  SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --project=${PROJECT_ID} --format='value(status.url)')
else
  info "Would deploy to Cloud Run"
  SERVICE_URL="https://example-service-url.a.run.app"
fi

# Set up domain mapping if not already mapped
info "Setting up domain mapping..."
if [ "$DRY_RUN" = false ]; then
  if ! gcloud beta run domain-mappings describe --domain=${DOMAIN} --project=${PROJECT_ID} --region=${REGION} &>/dev/null; then
    warn "Domain mapping for ${DOMAIN} does not exist. Creating..."
    gcloud beta run domain-mappings create \
      --service=${SERVICE_NAME} \
      --domain=${DOMAIN} \
      --project=${PROJECT_ID} \
      --region=${REGION}
    
    echo "------------------------------------------------------"
    echo "IMPORTANT: Configure your DNS provider with the following:"
    gcloud beta run domain-mappings describe --domain=${DOMAIN} --project=${PROJECT_ID} --region=${REGION} --format='value(resourceRecords)'
    echo "------------------------------------------------------"
  fi
fi

# Set up monitoring
info "Setting up monitoring..."
if [ "$DRY_RUN" = false ]; then
  # Error rate alert
  gcloud alpha monitoring policies create \
    --project=${PROJECT_ID} \
    --display-name="MCP Server Error Rate" \
    --condition-filter="metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${SERVICE_NAME}\" metric.labels.response_code_class=\"4xx\" OR metric.labels.response_code_class=\"5xx\"" \
    --condition-threshold-value=10 \
    --aggregation-alignment-period=300s \
    --notification-channels="email:admin@example.com"

  # Latency alert
  gcloud alpha monitoring policies create \
    --project=${PROJECT_ID} \
    --display-name="MCP Server High Latency" \
    --condition-filter="metric.type=\"run.googleapis.com/request_latencies\" resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${SERVICE_NAME}\"" \
    --condition-threshold-value=2000 \
    --aggregation-per-series-aligner=ALIGN_PERCENTILE_95
fi

# Verify deployment
info "Verifying deployment..."
if [ "$DRY_RUN" = false ]; then
  # Test basic health endpoint
  if curl -sSf "${SERVICE_URL}/health" > /dev/null; then
    success "Health check passed!"
  else
    error "Health check failed!"
    exit 1
  fi
  
  # Test MCP tools discovery endpoint
  if curl -sSf "${SERVICE_URL}/mcp/tools" > /dev/null; then
    success "MCP tools check passed!"
  else
    error "MCP tools check failed!"
    exit 1
  fi
else
  info "Would verify deployment with health checks"
fi

# Completion message
success "Deployment completed!"
echo "Service URL: ${SERVICE_URL}"
echo "Domain: https://${DOMAIN} (once DNS is configured)"
echo ""
echo "You can check logs with:"
echo "gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE_NAME}\" --project=${PROJECT_ID} --limit=20"
echo ""
echo "To trigger a rollback, run:"
echo "./scripts/rollback_v0.3.0.sh"

exit 0