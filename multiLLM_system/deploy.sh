#!/bin/bash

# MultiLLM System Deployment Script
# デプロイ環境: Staging/Production

set -e

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 環境変数チェック
check_env() {
    echo -e "${YELLOW}Checking environment variables...${NC}"
    
    REQUIRED_VARS=(
        "SLACK_BOT_TOKEN"
        "SLACK_SIGNING_SECRET"
        "SLACK_BOT_ID"
        "OPENAI_API_KEY"
        "ANTHROPIC_API_KEY"
        "GOOGLE_AI_API_KEY"
        "OPENMEMORY_URL"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}Error: $var is not set${NC}"
            exit 1
        fi
    done
    
    echo -e "${GREEN}✓ All required environment variables are set${NC}"
}

# 依存関係インストール
install_dependencies() {
    echo -e "${YELLOW}Installing dependencies...${NC}"
    
    # Python依存関係
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    fi
    
    # Node.js依存関係
    if [ -f "package.json" ]; then
        npm install
    fi
    
    echo -e "${GREEN}✓ Dependencies installed${NC}"
}

# 設定検証
validate_config() {
    echo -e "${YELLOW}Validating configuration...${NC}"
    
    python -c "
from config.config_validator import ConfigValidator
try:
    config = ConfigValidator.validate_and_load()
    print('Configuration valid')
except Exception as e:
    print(f'Configuration error: {e}')
    exit(1)
"
    
    echo -e "${GREEN}✓ Configuration validated${NC}"
}

# サービス起動
start_services() {
    echo -e "${YELLOW}Starting MultiLLM services...${NC}"
    
    # Orchestrator起動
    echo "Starting Orchestrator..."
    python orchestrator/orchestrator.py &
    ORCHESTRATOR_PID=$!
    
    # Worker起動（実際の実装では各Workerを起動）
    echo "Starting Workers..."
    # python workers/backend_worker.py &
    # python workers/frontend_worker.py &
    # python workers/review_worker.py &
    
    # Memory Sync Service起動
    echo "Starting Memory Sync Service..."
    python services/memory_sync.py &
    MEMORY_SYNC_PID=$!
    
    # Slack Integration起動
    echo "Starting Slack Integration..."
    node services/slackIntegration.js &
    SLACK_PID=$!
    
    echo -e "${GREEN}✓ All services started${NC}"
    echo "Orchestrator PID: $ORCHESTRATOR_PID"
    echo "Memory Sync PID: $MEMORY_SYNC_PID"
    echo "Slack PID: $SLACK_PID"
    
    # PIDをファイルに保存
    echo "$ORCHESTRATOR_PID" > .orchestrator.pid
    echo "$MEMORY_SYNC_PID" > .memory_sync.pid
    echo "$SLACK_PID" > .slack.pid
}

# ヘルスチェック
health_check() {
    echo -e "${YELLOW}Performing health check...${NC}"
    
    sleep 5  # サービス起動を待つ
    
    # 各サービスのヘルスチェック（実装は簡略化）
    if kill -0 $ORCHESTRATOR_PID 2>/dev/null; then
        echo -e "${GREEN}✓ Orchestrator is running${NC}"
    else
        echo -e "${RED}✗ Orchestrator is not running${NC}"
        exit 1
    fi
    
    if kill -0 $MEMORY_SYNC_PID 2>/dev/null; then
        echo -e "${GREEN}✓ Memory Sync is running${NC}"
    else
        echo -e "${RED}✗ Memory Sync is not running${NC}"
        exit 1
    fi
    
    if kill -0 $SLACK_PID 2>/dev/null; then
        echo -e "${GREEN}✓ Slack Integration is running${NC}"
    else
        echo -e "${RED}✗ Slack Integration is not running${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ All services are healthy${NC}"
}

# 停止スクリプト
create_stop_script() {
    cat > stop.sh << 'EOF'
#!/bin/bash

echo "Stopping MultiLLM services..."

if [ -f .orchestrator.pid ]; then
    kill $(cat .orchestrator.pid) 2>/dev/null
    rm .orchestrator.pid
fi

if [ -f .memory_sync.pid ]; then
    kill $(cat .memory_sync.pid) 2>/dev/null
    rm .memory_sync.pid
fi

if [ -f .slack.pid ]; then
    kill $(cat .slack.pid) 2>/dev/null
    rm .slack.pid
fi

echo "All services stopped"
EOF
    
    chmod +x stop.sh
    echo -e "${GREEN}✓ Stop script created${NC}"
}

# メイン処理
main() {
    echo -e "${GREEN}MultiLLM System Deployment${NC}"
    echo "=========================="
    
    # 環境引数チェック
    if [ "$1" != "staging" ] && [ "$1" != "production" ]; then
        echo "Usage: $0 [staging|production]"
        exit 1
    fi
    
    ENVIRONMENT=$1
    echo -e "Deploying to: ${YELLOW}$ENVIRONMENT${NC}"
    
    # デプロイ手順
    check_env
    install_dependencies
    validate_config
    start_services
    health_check
    create_stop_script
    
    echo -e "${GREEN}✅ MultiLLM System deployed successfully!${NC}"
    echo ""
    echo "To stop services, run: ./stop.sh"
    echo "To check status, run: ps aux | grep -E 'orchestrator|memory_sync|slack'"
    echo ""
    echo "Slack bot is now active. Mention @conea in Slack to interact."
}

# スクリプト実行
main "$@"