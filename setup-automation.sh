#!/bin/bash

echo "🚀 Claude Code & Claude Desktop 自動化セットアップ"
echo "================================================"

# 環境変数の確認
echo ""
echo "📋 環境変数の設定を確認してください:"
echo "1. GITHUB_TOKEN - GitHub Personal Access Token"
echo "2. SLACK_WEBHOOK_URL - Slack Webhook URL (オプション)"
echo ""

# Claude Desktop設定ファイルのパス
CLAUDE_CONFIG_PATH="$HOME/.config/claude/claude_desktop_config.json"
CLAUDE_MAC_CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

# OSを検出
if [[ "$OSTYPE" == "darwin"* ]]; then
    CONFIG_PATH="$CLAUDE_MAC_CONFIG_PATH"
else
    CONFIG_PATH="$CLAUDE_CONFIG_PATH"
fi

echo "🔧 Claude Desktop設定ファイルを更新中..."

# 設定ディレクトリを作成
mkdir -p "$(dirname "$CONFIG_PATH")"

# 設定ファイルをコピー
cp claude-desktop-config.json "$CONFIG_PATH"

echo "✅ Claude Desktop設定ファイルを更新しました: $CONFIG_PATH"
echo ""

# テストコマンド
echo "🧪 MCPサーバーのテスト方法:"
echo ""
echo "1. Shopify MCPサーバーのテスト:"
echo "   ./test_mcp.sh"
echo ""
echo "2. Claude Code Automationのテスト:"
echo "   node claude-code-automation/claude-code-mcp-server.js"
echo ""

# GitHub Actionsのセットアップ
echo "📝 GitHub Actionsの設定:"
echo "1. リポジトリのSettings > Secrets and variablesで以下を設定:"
echo "   - FIREBASE_TOKEN"
echo "   - DEPLOY_TOKEN"
echo "   - CLAUDE_WEBHOOK"
echo "   - SLACK_WEBHOOK_URL"
echo ""

echo "🎉 セットアップ完了!"
echo ""
echo "次のステップ:"
echo "1. 環境変数を設定してください"
echo "2. Claude Desktopを再起動してください"
echo "3. 'Claude Code を使って...' と指示してタスクを自動化できます"