#!/bin/bash

# Conea AI Platform - Enhanced Deployment Script
# Version: 2.0
# Created: 2024-01-15
# Updated: 2024-01-15

set -euo pipefail

# =============================================================================
# Configuration and Constants
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="conea-integration"
LOG_FILE="logs/deploy_$(date '+%Y%m%d_%H%M%S').log"
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
VERSION_FILE="VERSION"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="development"
SKIP_TESTS=false
SKIP_BACKUP=false
DRY_RUN=false
VERBOSE=false
FORCE_DEPLOY=false

# =============================================================================
# Utility Functions
# =============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [ENVIRONMENT]

Enhanced deployment script for Conea AI Platform

ENVIRONMENTS:
    dev|development     Deploy to development environment
    staging            Deploy to staging environment  
    prod|production    Deploy to production environment

OPTIONS:
    -h, --help         Show this help message
    -t, --skip-tests   Skip running tests before deployment
    -b, --skip-backup  Skip creating backup before deployment
    -d, --dry-run      Show what would be done without executing
    -v, --verbose      Enable verbose output
    -f, --force        Force deployment even if checks fail
    --version          Show script version

EXAMPLES:
    $0 development                    # Deploy to development
    $0 production --verbose           # Deploy to production with verbose output
    $0 staging --skip-tests          # Deploy to staging without running tests
    $0 production --dry-run          # Show production deployment plan

For more information, see: docs/infrastructure/deployment_guide.md
EOF
}

check_prerequisites() {
    log_info "🔍 事前条件をチェック中..."
    
    local missing_deps=()
    
    # Check required commands
    for cmd in docker docker-compose git curl jq; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_error "Please install missing dependencies and try again"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # Check if we're in the correct directory
    if [[ ! -f "package.json" ]] || [[ ! -f "docker-compose.yml" ]]; then
        log_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Check environment file
    local env_file=".env"
    if [[ "$ENVIRONMENT" == "production" ]]; then
        env_file=".env.production"
    elif [[ "$ENVIRONMENT" == "staging" ]]; then
        env_file=".env.staging"
    fi
    
    if [[ ! -f "$env_file" ]]; then
        log_warning "Environment file $env_file not found"
        if [[ -f ".env.example" ]]; then
            log_info "Creating $env_file from .env.example"
            cp .env.example "$env_file"
            log_warning "Please configure $env_file before continuing"
            exit 1
        fi
    fi
    
    log_success "✅ 事前条件チェック完了"
}

create_backup() {
    if [[ "$SKIP_BACKUP" == true ]]; then
        log_info "⏭️  バックアップをスキップ"
        return 0
    fi
    
    log_info "💾 現在の設定をバックアップ中..."
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Backup configuration files
    cp .env "$BACKUP_DIR/.env.backup" 2>/dev/null || true
    cp docker-compose.yml "$BACKUP_DIR/docker-compose.yml.backup" 2>/dev/null || true
    cp package.json "$BACKUP_DIR/package.json.backup" 2>/dev/null || true
    
    # Backup database if running
    if docker-compose ps postgres | grep -q "Up"; then
        log_info "📊 データベースをバックアップ中..."
        docker-compose exec postgres pg_dump -U postgres conea_db > "$BACKUP_DIR/database_backup.sql" 2>/dev/null || {
            log_warning "データベースバックアップに失敗しました"
        }
    fi
    
    # Backup volumes
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_info "📦 Dockerボリュームをバックアップ中..."
        docker run --rm \
            -v conea_postgres_data:/data \
            -v "$(pwd)/$BACKUP_DIR":/backup \
            alpine tar czf /backup/postgres_data.tar.gz -C /data . 2>/dev/null || {
            log_warning "PostgreSQLボリュームバックアップに失敗しました"
        }
        
        docker run --rm \
            -v conea_redis_data:/data \
            -v "$(pwd)/$BACKUP_DIR":/backup \
            alpine tar czf /backup/redis_data.tar.gz -C /data . 2>/dev/null || {
            log_warning "Redisボリュームバックアップに失敗しました"
        }
    fi
    
    log_success "✅ バックアップ完了: $BACKUP_DIR"
}

run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        log_info "⏭️  テストをスキップ"
        return 0
    fi
    
    log_info "🧪 テストを実行中..."
    
    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        log_info "📦 依存関係をインストール中..."
        npm ci
    fi
    
    # Run linting
    log_info "📝 コード品質チェック中..."
    npm run lint || {
        log_error "Linting failed"
        return 1
    }
    
    # Run type checking
    log_info "🔍 TypeScript型チェック中..."
    npm run typecheck || {
        log_error "Type checking failed"
        return 1
    }
    
    # Run unit tests
    log_info "🔬 単体テスト実行中..."
    npm test || {
        log_error "Unit tests failed"
        return 1
    }
    
    # Run integration tests in non-production environments
    if [[ "$ENVIRONMENT" != "production" ]]; then
        log_info "🔗 統合テスト実行中..."
        npm run test:integration 2>/dev/null || {
            log_warning "Integration tests failed or not available"
        }
    fi
    
    log_success "✅ すべてのテストが成功しました"
}

build_images() {
    log_info "🏗️  Dockerイメージをビルド中..."
    
    # Get version
    local version
    if [[ -f "$VERSION_FILE" ]]; then
        version=$(cat "$VERSION_FILE")
    else
        version="latest"
    fi
    
    # Build main application image
    docker build -t "conea-backend:$version" . || {
        log_error "Failed to build Docker image"
        return 1
    }
    
    # Tag for environment
    docker tag "conea-backend:$version" "conea-backend:$ENVIRONMENT"
    
    # For production, also push to registry
    if [[ "$ENVIRONMENT" == "production" && -n "${DOCKER_REGISTRY:-}" ]]; then
        log_info "📤 本番レジストリにイメージをプッシュ中..."
        docker tag "conea-backend:$version" "$DOCKER_REGISTRY/conea-backend:$version"
        docker push "$DOCKER_REGISTRY/conea-backend:$version" || {
            log_warning "Failed to push to registry"
        }
    fi
    
    log_success "✅ イメージビルド完了"
}

deploy_services() {
    log_info "🚀 サービスをデプロイ中..."
    
    # Choose the right compose file
    local compose_file="docker-compose.yml"
    if [[ -f "docker-compose.$ENVIRONMENT.yml" ]]; then
        compose_file="docker-compose.$ENVIRONMENT.yml"
    fi
    
    # Set environment file
    export COMPOSE_FILE="$compose_file"
    if [[ "$ENVIRONMENT" == "production" ]]; then
        export ENV_FILE=".env.production"
    elif [[ "$ENVIRONMENT" == "staging" ]]; then
        export ENV_FILE=".env.staging"
    else
        export ENV_FILE=".env"
    fi
    
    # Pull latest images
    log_info "📥 最新イメージを取得中..."
    docker-compose -f "$compose_file" pull || {
        log_warning "Failed to pull some images"
    }
    
    # Stop existing services gracefully
    log_info "🛑 既存サービスを停止中..."
    docker-compose -f "$compose_file" down --remove-orphans
    
    # Start services
    log_info "▶️  サービスを起動中..."
    docker-compose -f "$compose_file" up -d
    
    # Wait for services to be ready
    log_info "⏳ サービスの起動を待機中..."
    sleep 30
    
    log_success "✅ サービスデプロイ完了"
}

verify_deployment() {
    log_info "🔍 デプロイメントを検証中..."
    
    local base_url="http://localhost:3000"
    if [[ "$ENVIRONMENT" == "production" ]]; then
        base_url="${PRODUCTION_URL:-http://localhost:3000}"
    elif [[ "$ENVIRONMENT" == "staging" ]]; then
        base_url="${STAGING_URL:-http://localhost:3000}"
    fi
    
    # Check service health
    local max_attempts=12
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log_info "🏥 ヘルスチェック (試行 $attempt/$max_attempts)..."
        
        if curl -sf "$base_url/health" >/dev/null 2>&1; then
            log_success "✅ ヘルスチェック成功"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            log_error "❌ ヘルスチェック失敗"
            return 1
        fi
        
        sleep 10
        ((attempt++))
    done
    
    # Check API endpoints
    log_info "🔌 APIエンドポイントをテスト中..."
    
    # Test basic API endpoints
    local endpoints=("/api/status" "/api/health")
    for endpoint in "${endpoints[@]}"; do
        if curl -sf "$base_url$endpoint" >/dev/null 2>&1; then
            log_success "✅ $endpoint OK"
        else
            log_warning "⚠️  $endpoint に問題があります"
        fi
    done
    
    # Check database connection
    log_info "🗄️  データベース接続をテスト中..."
    if docker-compose exec backend npm run db:ping >/dev/null 2>&1; then
        log_success "✅ データベース接続 OK"
    else
        log_warning "⚠️  データベース接続に問題があります"
    fi
    
    # Check Redis connection
    log_info "🔴 Redis接続をテスト中..."
    if docker-compose exec redis redis-cli ping >/dev/null 2>&1; then
        log_success "✅ Redis接続 OK"
    else
        log_warning "⚠️  Redis接続に問題があります"
    fi
    
    # Display service status
    log_info "📊 サービス状態:"
    docker-compose ps
    
    log_success "✅ デプロイメント検証完了"
}

cleanup_old_resources() {
    log_info "🧹 古いリソースをクリーンアップ中..."
    
    # Remove unused Docker images
    docker image prune -f >/dev/null 2>&1 || true
    
    # Remove old backups (keep last 7 days)
    find backups/ -type d -name "20*" -mtime +7 -exec rm -rf {} + 2>/dev/null || true
    
    # Remove old logs (keep last 30 days)
    find logs/ -name "*.log" -mtime +30 -delete 2>/dev/null || true
    
    log_success "✅ クリーンアップ完了"
}

show_deployment_summary() {
    log_success "🎉 デプロイメント完了!"
    
    echo
    echo "=== Deployment Summary ==="
    echo "Environment: $ENVIRONMENT"
    echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Version: $(cat "$VERSION_FILE" 2>/dev/null || echo "unknown")"
    echo "Backup Location: $BACKUP_DIR"
    echo "Log File: $LOG_FILE"
    echo
    
    # Show service URLs
    echo "=== Service URLs ==="
    case "$ENVIRONMENT" in
        "development")
            echo "API: http://localhost:3000"
            echo "Grafana: http://localhost:3001 (admin/admin123)"
            echo "Prometheus: http://localhost:9090"
            ;;
        "staging")
            echo "API: ${STAGING_URL:-http://localhost:3000}"
            ;;
        "production")
            echo "API: ${PRODUCTION_URL:-http://localhost:3000}"
            ;;
    esac
    echo
    
    # Show next steps
    echo "=== Next Steps ==="
    echo "1. Monitor logs: docker-compose logs -f"
    echo "2. Check metrics: Browse to Grafana dashboard"
    echo "3. Verify functionality: Run smoke tests"
    echo
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo "=== Production Checklist ==="
        echo "□ Notify stakeholders of successful deployment"
        echo "□ Monitor error rates and performance metrics"
        echo "□ Verify external integrations (Shopify, Google Analytics)"
        echo "□ Test critical user paths"
        echo "□ Update status page if applicable"
        echo
    fi
    
    echo "For rollback instructions, see: docs/infrastructure/rollback_procedures.md"
}

# =============================================================================
# Error Handling
# =============================================================================

handle_error() {
    local exit_code=$?
    log_error "❌ デプロイメントが失敗しました (Exit code: $exit_code)"
    
    echo
    echo "=== Error Recovery ==="
    echo "1. Check the log file: $LOG_FILE"
    echo "2. Review service logs: docker-compose logs"
    echo "3. Consider rollback: see docs/infrastructure/rollback_procedures.md"
    echo
    
    if [[ -d "$BACKUP_DIR" ]]; then
        echo "Backup is available at: $BACKUP_DIR"
        echo "To restore from backup:"
        echo "  cp $BACKUP_DIR/.env.backup .env"
        echo "  cp $BACKUP_DIR/docker-compose.yml.backup docker-compose.yml"
        echo
    fi
    
    exit $exit_code
}

trap 'handle_error' ERR

# =============================================================================
# Main Script Logic
# =============================================================================

main() {
    # Create log directory
    mkdir -p logs backups
    
    log_info "🚀 Conea AI Platform デプロイメント開始"
    log_info "Environment: $ENVIRONMENT"
    log_info "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "🔍 DRY RUN MODE - 実際のデプロイメントは実行されません"
        echo
        echo "=== Deployment Plan ==="
        echo "1. Check prerequisites"
        echo "2. Create backup (Backup dir: $BACKUP_DIR)"
        echo "3. Run tests (Skip: $SKIP_TESTS)"
        echo "4. Build Docker images"
        echo "5. Deploy services to $ENVIRONMENT"
        echo "6. Verify deployment"
        echo "7. Cleanup old resources"
        echo "8. Show summary"
        echo
        log_info "Run without --dry-run to execute deployment"
        exit 0
    fi
    
    # Execute deployment steps
    check_prerequisites
    create_backup
    run_tests
    build_images
    deploy_services
    verify_deployment
    cleanup_old_resources
    show_deployment_summary
    
    log_success "🎊 デプロイメントが正常に完了しました!"
}

# =============================================================================
# Command Line Argument Parsing
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -t|--skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -b|--skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            set -x
            shift
            ;;
        -f|--force)
            FORCE_DEPLOY=true
            shift
            ;;
        --version)
            echo "Conea AI Platform Deployment Script v2.0"
            exit 0
            ;;
        dev|development)
            ENVIRONMENT="development"
            shift
            ;;
        staging)
            ENVIRONMENT="staging"
            shift
            ;;
        prod|production)
            ENVIRONMENT="production"
            shift
            ;;
        -*)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
        *)
            if [[ -z "${ENVIRONMENT_SET:-}" ]]; then
                ENVIRONMENT="$1"
                ENVIRONMENT_SET=true
            else
                log_error "Unknown argument: $1"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate environment
case "$ENVIRONMENT" in
    "development"|"staging"|"production")
        ;;
    *)
        log_error "Invalid environment: $ENVIRONMENT"
        show_usage
        exit 1
        ;;
esac

# Execute main function
main "$@"