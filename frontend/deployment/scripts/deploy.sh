#!/bin/bash

# Conea Frontend Deployment Script
# Usage: ./deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "🚀 Starting Conea Frontend deployment to $ENVIRONMENT..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate environment
case $ENVIRONMENT in
    development|staging|production)
        print_status "Deploying to $ENVIRONMENT environment"
        ;;
    *)
        print_error "Invalid environment: $ENVIRONMENT"
        print_error "Valid environments: development, staging, production"
        exit 1
        ;;
esac

# Check required tools
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is required but not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is required but not installed"
        exit 1
    fi
    
    print_success "All dependencies are available"
}

# Build the application
build_app() {
    print_status "Building React application..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies
    print_status "Installing dependencies..."
    npm ci
    
    # Run tests (if available)
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        print_status "Running tests..."
        npm test -- --coverage --watchAll=false || {
            print_warning "Tests failed, but continuing deployment"
        }
    fi
    
    # Build production bundle
    print_status "Building production bundle..."
    npm run build
    
    print_success "Application built successfully"
}

# Build Docker image
build_docker() {
    print_status "Building Docker image..."
    
    cd "$PROJECT_ROOT/deployment"
    
    # Build the image
    docker-compose build --no-cache frontend
    
    print_success "Docker image built successfully"
}

# Deploy the application
deploy_app() {
    print_status "Deploying application..."
    
    cd "$PROJECT_ROOT/deployment"
    
    # Stop existing containers
    print_status "Stopping existing containers..."
    docker-compose down || true
    
    # Start new containers
    print_status "Starting new containers..."
    docker-compose up -d
    
    # Wait for health check
    print_status "Waiting for application to be healthy..."
    sleep 30
    
    # Check health
    if curl -f http://localhost/health &> /dev/null; then
        print_success "Application is healthy and running"
    else
        print_error "Application health check failed"
        print_status "Checking container logs..."
        docker-compose logs frontend
        exit 1
    fi
}

# Cleanup old images
cleanup() {
    print_status "Cleaning up old Docker images..."
    docker image prune -f
    print_success "Cleanup completed"
}

# Show deployment info
show_info() {
    print_success "Deployment completed successfully!"
    echo ""
    echo "🌐 Application URLs:"
    echo "   Frontend: http://localhost"
    echo "   Health:   http://localhost/health"
    echo ""
    echo "🔧 Management Commands:"
    echo "   View logs:    docker-compose logs -f frontend"
    echo "   Stop app:     docker-compose down"
    echo "   Restart app:  docker-compose restart frontend"
    echo ""
    echo "📊 Resource Usage:"
    docker stats --no-stream conea-frontend || true
}

# Main deployment flow
main() {
    print_status "Starting Conea deployment process..."
    
    check_dependencies
    build_app
    build_docker
    deploy_app
    cleanup
    show_info
    
    print_success "🎉 Conea Frontend successfully deployed to $ENVIRONMENT!"
}

# Handle script interruption
trap 'print_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"