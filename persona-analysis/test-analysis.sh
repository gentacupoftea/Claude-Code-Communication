#!/bin/bash

# Persona Analysis Service Test Script
# ペルソナ分析サービスのテストスクリプト

echo "🧪 Persona Analysis Service Test"
echo "================================"

# カラー出力の設定
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# サービスURLの設定
SERVICE_URL="${SERVICE_URL:-http://localhost:8002}"

# テストファイルのパス
TEST_VIDEO="./test-data/sample-video.mp4"
TEST_TRANSCRIPT="./test-data/sample-transcript.txt"
TEST_SURVEY="./test-data/sample-survey.json"
TEST_PURCHASE="./test-data/sample-purchase.csv"

echo -e "${YELLOW}Testing: ${SERVICE_URL}${NC}"
echo ""

# 1. ヘルスチェック
echo "1. Health Check"
echo "---------------"
curl -s "${SERVICE_URL}/health" | jq '.'
echo ""

# 2. Ready チェック
echo "2. Ready Check"
echo "--------------"
curl -s "${SERVICE_URL}/health/ready" | jq '.'
echo ""

# 3. 分析リクエスト（モックデータ）
echo "3. Create Analysis Request"
echo "--------------------------"

# テストデータが存在しない場合はモックリクエスト
if [ ! -f "$TEST_VIDEO" ]; then
    echo -e "${YELLOW}Test files not found. Creating mock request...${NC}"
    
    # モックデータでリクエスト
    RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer test-token" \
        -d '{
            "targetAudience": "20-30代の女性",
            "options": {
                "includeEmotionAnalysis": true,
                "includeSentimentAnalysis": true,
                "includePersonalityTraits": true,
                "includeBehaviorPatterns": true,
                "generateDetailedReport": true
            }
        }' \
        "${SERVICE_URL}/api/persona-analysis/analyze")
else
    # 実際のファイルでリクエスト
    RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer test-token" \
        -F "videos=@${TEST_VIDEO}" \
        -F "transcript=@${TEST_TRANSCRIPT}" \
        -F "survey=@${TEST_SURVEY}" \
        -F "purchase_data=@${TEST_PURCHASE}" \
        -F "targetAudience=20-30代の女性" \
        -F 'options={"includeEmotionAnalysis":true,"includeSentimentAnalysis":true,"includePersonalityTraits":true,"includeBehaviorPatterns":true,"generateDetailedReport":true}' \
        "${SERVICE_URL}/api/persona-analysis/analyze")
fi

echo "$RESPONSE" | jq '.'
ANALYSIS_ID=$(echo "$RESPONSE" | jq -r '.id')
echo ""

# 4. 分析リストの取得
echo "4. List Analyses"
echo "----------------"
curl -s -H "Authorization: Bearer test-token" \
    "${SERVICE_URL}/api/persona-analysis/analyses" | jq '.'
echo ""

# 5. 特定の分析の取得（IDが取得できた場合）
if [ ! -z "$ANALYSIS_ID" ] && [ "$ANALYSIS_ID" != "null" ]; then
    echo "5. Get Analysis Details"
    echo "-----------------------"
    curl -s -H "Authorization: Bearer test-token" \
        "${SERVICE_URL}/api/persona-analysis/analyses/${ANALYSIS_ID}" | jq '.'
    echo ""
    
    # 6. 分析ステータスの確認
    echo "6. Get Analysis Status"
    echo "----------------------"
    curl -s -H "Authorization: Bearer test-token" \
        "${SERVICE_URL}/api/persona-analysis/analyses/${ANALYSIS_ID}/status" | jq '.'
    echo ""
fi

echo -e "${GREEN}✅ Test completed!${NC}"
echo ""
echo "Note: For full integration test, ensure:"
echo "  1. Redis is running"
echo "  2. API keys are configured in .env"
echo "  3. Test data files exist in ./test-data/"