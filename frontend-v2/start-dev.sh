#!/bin/bash

# Conea Staging Development Server Startup Script

echo "🚀 Starting Conea Staging Development Environment..."

# カラー設定
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# フロントエンドとバックエンドを並行起動
echo -e "${BLUE}📱 Starting Frontend (Next.js)...${NC}"
npm run dev &
FRONTEND_PID=$!

echo -e "${GREEN}🔧 Starting Backend API Server...${NC}"
cd backend && npm run dev &
BACKEND_PID=$!

echo -e "${YELLOW}✅ Both servers are starting...${NC}"
echo -e "${YELLOW}📊 Frontend: http://localhost:3000${NC}"
echo -e "${YELLOW}🔗 Backend API: http://localhost:8000${NC}"
echo -e "${YELLOW}🩺 Health Check: http://localhost:8000/api/health${NC}"

echo ""
echo -e "${GREEN}🔥 Development environment is ready!${NC}"
echo -e "${BLUE}Press Ctrl+C to stop all servers${NC}"

# Ctrl+C でのクリーンアップ
cleanup() {
    echo -e "\n${RED}🛑 Shutting down servers...${NC}"
    kill $FRONTEND_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    echo -e "${GREEN}✅ All servers stopped.${NC}"
    exit 0
}

trap cleanup SIGINT

# バックグラウンドプロセスを待機
wait