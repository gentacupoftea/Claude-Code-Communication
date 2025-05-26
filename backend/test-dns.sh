#!/bin/bash

echo "🌐 DNS設定テスト用スクリプト"
echo "================================="

echo "1. DNS解決テスト:"
nslookup slack-api.conea.ai

echo -e "\n2. HTTPSエンドポイントテスト:"
curl -X POST https://slack-api.conea.ai:8000/slack/events \
  -H "Content-Type: application/json" \
  -d '{"type":"url_verification","challenge":"dns_test_challenge"}' \
  -w "\nHTTP Status: %{http_code}\nTotal Time: %{time_total}s\n"

echo -e "\n3. サーバーステータス確認:"
curl -s https://slack-api.conea.ai:8000/api/status | jq '.'

echo -e "\n4. Slack設定確認:"
curl -s https://slack-api.conea.ai:8000/api/slack/config | jq '.status'