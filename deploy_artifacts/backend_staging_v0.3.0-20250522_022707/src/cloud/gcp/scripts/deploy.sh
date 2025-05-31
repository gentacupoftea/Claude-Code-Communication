#!/bin/bash

# Shopify MCP Server - GCP Deployment Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-"shopify-mcp-server"}
REGION=${GCP_REGION:-"asia-northeast1"}
ENVIRONMENT=${ENVIRONMENT:-"production"}
CLUSTER_NAME="shopify-mcp-cluster"
IMAGE_TAG=${IMAGE_TAG:-"latest"}

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        error "gcloud CLI is not installed. Please install it first."
    fi
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed. Please install it first."
    fi
    
    # Check if terraform is installed
    if ! command -v terraform &> /dev/null; then
        error "terraform is not installed. Please install it first."
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install it first."
    fi
    
    # Check if authenticated
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
        error "Not authenticated with gcloud. Run 'gcloud auth login'"
    fi
    
    log "Prerequisites check passed"
}

# Set up project
setup_project() {
    log "Setting up GCP project..."
    
    # Set project
    gcloud config set project $PROJECT_ID
    
    # Enable required APIs
    log "Enabling required APIs..."
    gcloud services enable \
        compute.googleapis.com \
        container.googleapis.com \
        cloudbuild.googleapis.com \
        cloudrun.googleapis.com \
        firestore.googleapis.com \
        bigquery.googleapis.com \
        storage.googleapis.com \
        pubsub.googleapis.com \
        cloudtasks.googleapis.com \
        secretmanager.googleapis.com \
        monitoring.googleapis.com \
        logging.googleapis.com \
        redis.googleapis.com
    
    log "Project setup completed"
}

# Build Docker images
build_images() {
    log "Building Docker images..."
    
    # Configure Docker for GCR
    gcloud auth configure-docker
    
    services=("auth" "shopify" "analytics" "export")
    
    for service in "${services[@]}"; do
        log "Building $service service..."
        docker build -t gcr.io/$PROJECT_ID/$service-service:$IMAGE_TAG \
            -f src/cloud/gcp/services/Dockerfile.$service \
            .
        
        log "Pushing $service service to GCR..."
        docker push gcr.io/$PROJECT_ID/$service-service:$IMAGE_TAG
    done
    
    log "Docker images built and pushed successfully"
}

# Deploy infrastructure with Terraform
deploy_infrastructure() {
    log "Deploying infrastructure with Terraform..."
    
    cd src/cloud/gcp/terraform
    
    # Initialize Terraform
    terraform init
    
    # Plan deployment
    terraform plan -var="project_id=$PROJECT_ID" -var="region=$REGION" -var="environment=$ENVIRONMENT"
    
    # Apply deployment
    terraform apply -var="project_id=$PROJECT_ID" -var="region=$REGION" -var="environment=$ENVIRONMENT" -auto-approve
    
    cd -
    
    log "Infrastructure deployed successfully"
}

# Deploy services to GKE
deploy_services() {
    log "Deploying services to GKE..."
    
    # Get GKE credentials
    gcloud container clusters get-credentials $CLUSTER_NAME --region $REGION
    
    # Create namespace
    kubectl create namespace shopify-mcp --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy services
    services=("auth" "shopify" "analytics" "export")
    
    for service in "${services[@]}"; do
        log "Deploying $service service..."
        
        # Create deployment manifest
        cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $service-service
  namespace: shopify-mcp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: $service-service
  template:
    metadata:
      labels:
        app: $service-service
    spec:
      serviceAccountName: shopify-mcp-runtime
      containers:
      - name: $service
        image: gcr.io/$PROJECT_ID/$service-service:$IMAGE_TAG
        ports:
        - containerPort: 3001
        env:
        - name: PROJECT_ID
          value: "$PROJECT_ID"
        - name: ENVIRONMENT
          value: "$ENVIRONMENT"
        - name: SERVICE_NAME
          value: "$service-service"
        resources:
          requests:
            cpu: 250m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 2Gi
---
apiVersion: v1
kind: Service
metadata:
  name: $service-service
  namespace: shopify-mcp
spec:
  selector:
    app: $service-service
  ports:
  - port: 80
    targetPort: 3001
  type: ClusterIP
EOF
    done
    
    log "Services deployed successfully"
}

# Deploy ingress
deploy_ingress() {
    log "Deploying ingress..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shopify-mcp-ingress
  namespace: shopify-mcp
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - api.shopify-mcp.com
    secretName: shopify-mcp-tls
  rules:
  - host: api.shopify-mcp.com
    http:
      paths:
      - path: /auth
        pathType: Prefix
        backend:
          service:
            name: auth-service
            port:
              number: 80
      - path: /shopify
        pathType: Prefix
        backend:
          service:
            name: shopify-service
            port:
              number: 80
      - path: /analytics
        pathType: Prefix
        backend:
          service:
            name: analytics-service
            port:
              number: 80
      - path: /export
        pathType: Prefix
        backend:
          service:
            name: export-service
            port:
              number: 80
EOF
    
    log "Ingress deployed successfully"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Deploy Prometheus
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    
    # Add Prometheus Helm repository
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Install Prometheus
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
        --set grafana.adminPassword=admin
    
    log "Monitoring setup completed"
}

# Setup secrets
setup_secrets() {
    log "Setting up secrets..."
    
    # Create secrets
    kubectl create secret generic shopify-mcp-secrets \
        --namespace shopify-mcp \
        --from-literal=jwt-secret=$(openssl rand -base64 32) \
        --from-literal=shopify-api-key=$SHOPIFY_API_KEY \
        --from-literal=shopify-api-secret=$SHOPIFY_API_SECRET \
        --from-literal=database-password=$(openssl rand -base64 32) \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log "Secrets setup completed"
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Check pod status
    kubectl get pods -n shopify-mcp
    
    # Check service status
    kubectl get services -n shopify-mcp
    
    # Check ingress
    kubectl get ingress -n shopify-mcp
    
    # Get external IP
    EXTERNAL_IP=$(kubectl get ingress shopify-mcp-ingress -n shopify-mcp -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    
    if [ -z "$EXTERNAL_IP" ]; then
        warning "External IP not yet assigned. Please check again in a few minutes."
    else
        log "Application is available at: http://$EXTERNAL_IP"
        log "Configure your DNS to point api.shopify-mcp.com to $EXTERNAL_IP"
    fi
    
    log "Deployment verification completed"
}

# Clean up (optional)
cleanup() {
    log "Cleaning up resources..."
    
    # Delete GKE resources
    kubectl delete namespace shopify-mcp
    kubectl delete namespace monitoring
    
    # Destroy Terraform resources
    cd src/cloud/gcp/terraform
    terraform destroy -var="project_id=$PROJECT_ID" -var="region=$REGION" -var="environment=$ENVIRONMENT" -auto-approve
    cd -
    
    log "Cleanup completed"
}

# Main deployment flow
main() {
    log "Starting Shopify MCP Server deployment to GCP..."
    
    check_prerequisites
    setup_project
    
    if [ "$1" == "build" ] || [ "$1" == "all" ]; then
        build_images
    fi
    
    if [ "$1" == "infra" ] || [ "$1" == "all" ]; then
        deploy_infrastructure
    fi
    
    if [ "$1" == "deploy" ] || [ "$1" == "all" ]; then
        deploy_services
        deploy_ingress
        setup_monitoring
        setup_secrets
    fi
    
    if [ "$1" == "verify" ] || [ "$1" == "all" ]; then
        verify_deployment
    fi
    
    if [ "$1" == "cleanup" ]; then
        cleanup
    fi
    
    log "Deployment completed successfully!"
}

# Script entry point
case "$1" in
    build|infra|deploy|verify|all|cleanup)
        main $1
        ;;
    *)
        echo "Usage: $0 {build|infra|deploy|verify|all|cleanup}"
        echo "  build   - Build and push Docker images"
        echo "  infra   - Deploy infrastructure with Terraform"
        echo "  deploy  - Deploy services to GKE"
        echo "  verify  - Verify deployment"
        echo "  all     - Run all deployment steps"
        echo "  cleanup - Clean up all resources"
        exit 1
        ;;
esac