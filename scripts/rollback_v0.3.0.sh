#!/bin/bash
# Conea v0.3.0 Rollback Script

set -e  # Stop on errors

# Colored output functions
info() { echo -e "\033[1;34m[INFO]\033[0m $1"; }
success() { echo -e "\033[1;32m[SUCCESS]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARNING]\033[0m $1"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $1"; }

# Display banner
echo "======================================================"
echo "          Conea v0.3.0 Rollback Script                "
echo "======================================================"
echo ""

# Check for --dry-run flag
DRY_RUN=false
ENVIRONMENT="staging"
for arg in "$@"; do
  if [ "$arg" == "--dry-run" ]; then
    DRY_RUN=true
    warn "Running in DRY RUN mode. No actual changes will be made."
  fi
  if [[ "$arg" == "--environment="* ]]; then
    ENVIRONMENT="${arg#*=}"
  fi
done

info "Target environment: ${ENVIRONMENT}"

# Load environment variables
if [ -f .env ]; then
  info "Loading environment variables..."
  source .env
else
  warn "No .env file found, using default values."
fi

# Set environment variables based on environment
if [ "$ENVIRONMENT" == "production" ]; then
  PROJECT_ID="${PROJECT_ID:-conea-prod}"
  SERVICE_NAME="${SERVICE_NAME:-conea}"
  PREVIOUS_VERSION="${PREVIOUS_VERSION:-v0.2.1}"
elif [ "$ENVIRONMENT" == "staging" ]; then
  PROJECT_ID="${PROJECT_ID:-conea-staging}"
  SERVICE_NAME="${SERVICE_NAME:-conea-staging}"
  PREVIOUS_VERSION="${PREVIOUS_VERSION:-v0.2.1}"
else
  error "Invalid environment: ${ENVIRONMENT}. Must be 'staging' or 'production'."
  exit 1
fi

REGION="${REGION:-asia-northeast1}"
IMAGE_NAME="${IMAGE_NAME:-${REGION}-docker.pkg.dev/${PROJECT_ID}/conea-repo/conea}"

# Display rollback parameters
echo "Rollback parameters:"
echo "- Environment: ${ENVIRONMENT}"
echo "- Project ID: ${PROJECT_ID}"
echo "- Region: ${REGION}"
echo "- Service name: ${SERVICE_NAME}"
echo "- Rolling back to version: ${PREVIOUS_VERSION}"
echo ""

if [ "$DRY_RUN" = false ]; then
  read -p "Continue with rollback to version ${PREVIOUS_VERSION}? (y/n): " CONTINUE
  if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
    error "Rollback cancelled."
    exit 1
  fi
fi

# Check for maintenance mode capability
if [ "$DRY_RUN" = false ]; then
  info "Checking if maintenance mode is supported..."
  MAINTENANCE_SUPPORTED=false
  if curl -s "${SERVICE_NAME}.${REGION}.run.app/api/admin/maintenance" > /dev/null; then
    MAINTENANCE_SUPPORTED=true
    info "Maintenance mode is supported. Enabling maintenance mode..."
    curl -X POST "${SERVICE_NAME}.${REGION}.run.app/api/admin/maintenance/enable" \
      -H "Authorization: Bearer $(gcloud auth print-identity-token)"
  else
    warn "Maintenance mode is not supported. Proceeding with rollback directly."
  fi
else
  info "Would check for maintenance mode support and enable if available"
  MAINTENANCE_SUPPORTED=false
fi

# Verify previous version image exists
info "Verifying previous version image exists..."
if [ "$DRY_RUN" = false ]; then
  if ! gcloud container images describe ${IMAGE_NAME}:${PREVIOUS_VERSION} --project=${PROJECT_ID} &>/dev/null; then
    error "Previous version image ${IMAGE_NAME}:${PREVIOUS_VERSION} does not exist."
    exit 1
  fi
fi

# Find and restore backup
info "Looking for backup..."
BACKUP_DIR=$(find ./backups -maxdepth 1 -type d -name "2*" | sort -r | head -n 1)

if [ -z "$BACKUP_DIR" ]; then
  warn "No backup directory found."
else
  info "Found backup directory: ${BACKUP_DIR}"
  
  if [ "$DRY_RUN" = false ]; then
    # Restore .env file if exists
    if [ -f "${BACKUP_DIR}/.env.backup" ]; then
      info "Restoring .env file..."
      cp "${BACKUP_DIR}/.env.backup" ./.env.rollback
      info "Restored as .env.rollback (please review before using)"
    fi
    
    # Restore data directory if exists
    if [ -d "${BACKUP_DIR}/data" ]; then
      info "Restoring data backup..."
      cp -r "${BACKUP_DIR}/data" ./data.rollback
      info "Restored data as data.rollback (please review before using)"
    fi
  else
    info "Would restore backup files from ${BACKUP_DIR}"
  fi
fi

# Roll back to previous version
info "Rolling back to previous version ${PREVIOUS_VERSION}..."
if [ "$DRY_RUN" = false ]; then
  gcloud run services update ${SERVICE_NAME} \
    --image=${IMAGE_NAME}:${PREVIOUS_VERSION} \
    --region=${REGION} \
    --project=${PROJECT_ID} \
    --set-env-vars="MCP_SERVER_VERSION=${PREVIOUS_VERSION}"
else
  info "Would update service to use image ${IMAGE_NAME}:${PREVIOUS_VERSION}"
fi

# Wait for deployment to complete
if [ "$DRY_RUN" = false ]; then
  info "Waiting for rollback deployment to complete..."
  sleep 20  # Wait for initial deployment to start
  
  REVISION_READY=false
  RETRIES=0
  MAX_RETRIES=15
  
  while [ "$REVISION_READY" = false ] && [ $RETRIES -lt $MAX_RETRIES ]; do
    if gcloud run services describe ${SERVICE_NAME} \
        --region=${REGION} \
        --project=${PROJECT_ID} \
        --format="value(status.conditions.status)" | grep -q "True"; then
      REVISION_READY=true
    else
      RETRIES=$((RETRIES+1))
      info "Waiting for deployment... (${RETRIES}/${MAX_RETRIES})"
      sleep 10
    fi
  done
  
  if [ "$REVISION_READY" = true ]; then
    success "Rollback deployment completed!"
  else
    error "Rollback deployment did not complete within expected time. Please check status manually."
  fi
fi

# Verify rollback
info "Verifying rollback..."
if [ "$DRY_RUN" = false ]; then
  SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --project=${PROJECT_ID} --format='value(status.url)')
  
  # Test basic health endpoint
  if curl -sSf "${SERVICE_URL}/health" > /dev/null; then
    success "Health check passed!"
  else
    error "Health check failed!"
  fi
  
  # Test version endpoint
  VERSION_OUTPUT=$(curl -sSf "${SERVICE_URL}/api/version" 2>/dev/null || echo '{"version":"unknown"}')
  DEPLOYED_VERSION=$(echo $VERSION_OUTPUT | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
  
  if [ "$DEPLOYED_VERSION" = "$PREVIOUS_VERSION" ] || [ "$DEPLOYED_VERSION" = "${PREVIOUS_VERSION#v}" ]; then
    success "Version check passed! Deployed version: ${DEPLOYED_VERSION}"
  else
    warn "Version mismatch. Expected: ${PREVIOUS_VERSION}, Got: ${DEPLOYED_VERSION}"
  fi
else
  info "Would verify rollback with health and version checks"
fi

# Disable maintenance mode if it was enabled
if [ "$DRY_RUN" = false ] && [ "$MAINTENANCE_SUPPORTED" = true ]; then
  info "Disabling maintenance mode..."
  curl -X POST "${SERVICE_URL}/api/admin/maintenance/disable" \
    -H "Authorization: Bearer $(gcloud auth print-identity-token)"
fi

# Completion message
success "Rollback completed!"
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "You can check logs with:"
echo "gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE_NAME}\" --project=${PROJECT_ID} --limit=20"
echo ""
echo "Please verify the application is functioning correctly."
echo "If you restored backup files, please review them before applying:"
echo "- .env.rollback"
echo "- data.rollback/"

exit 0