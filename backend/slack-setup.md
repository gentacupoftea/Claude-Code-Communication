# 🤖 Conea MultiLLM Slack Bot設定ガイド

## Phase 1完了: Slack応答高度化システム実装済み ✅

### 🚀 実装済み機能

#### 1. インテリジェントAI選択
- **コード関連** → Claude 3.5 Sonnet
- **創造的タスク** → GPT-4
- **分析・事実確認** → Gemini Pro
- 自動判定による最適AI選択

#### 2. OpenMemory統合
- Slack会話の自動記録
- 過去の文脈を活用した応答
- メモリ検索機能

#### 3. 実装済みSlashコマンド
- `/conea-status` - システム状況確認
- `/conea-memory search [query]` - メモリ検索

#### 4. イベント処理
- アプリメンション検知
- スレッド応答
- エラーハンドリング

### 📋 Slack App設定要件

#### 必要な権限 (Scopes)
```
Bot Token Scopes:
- app_mentions:read
- chat:write
- chat:write.public
- commands
- im:history
- im:read
- im:write
- users:read

Event Subscriptions:
- app_mention
```

#### 環境変数設定
```bash
# .env ファイルに追加
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token (Socket Mode用)
SLACK_PORT=3000
```

### 🔧 次の設定手順

#### 1. Slack App作成
1. https://api.slack.com/apps にアクセス
2. "Create New App" → "From scratch"
3. App名: "Conea MultiLLM"
4. Workspace選択

#### 2. Bot設定
**OAuth & Permissions**:
- Bot Token Scopesを上記リストに従って設定
- Install to Workspaceでトークン取得

**Event Subscriptions**:
- Enable Events: ON
- Request URL: `https://your-domain.com/slack/events`
- Subscribe to bot events: `app_mention`

**Slash Commands**:
- `/conea-status`
  - Command: `/conea-status`
  - Request URL: `https://your-domain.com/slack/command`
  - Description: "Coneaシステム状況確認"

- `/conea-memory`
  - Command: `/conea-memory`
  - Request URL: `https://your-domain.com/slack/command`
  - Description: "OpenMemory検索・管理"

#### 3. Admin Dashboardでの設定
1. `http://localhost:4000` にアクセス
2. Settings → Slack Configuration
3. 取得したトークンを設定:
   - Bot Token
   - Signing Secret
   - App Token

### 🧪 テスト方法

#### 1. システム起動
```bash
cd /Users/mourigenta/shopify-mcp-server/backend
npm start
```

#### 2. 基本テスト
- Slackでアプリをメンション: `@Conea MultiLLM こんにちは`
- Slashコマンドテスト: `/conea-status`

#### 3. 高度テスト
- コード質問: `@Conea MultiLLM Pythonでファイル読み込みのコードを書いて`
- 分析質問: `@Conea MultiLLM 今月の売上データを分析して`
- 創造的質問: `@Conea MultiLLM 新商品のキャッチコピーを作成して`

### 📊 ログ確認
```bash
# バックエンドログでSlack活動確認
tail -f /Users/mourigenta/shopify-mcp-server/backend/logs/app.log

# OpenMemory記録確認
curl "http://localhost:8765/api/v1/memories/?user_id=YOUR_SLACK_USER_ID"
```

### 🔄 Phase 2準備: OpenMemory常時同期
次フェーズでは以下を実装予定:
- リアルタイム会話同期
- インテリジェント記憶管理
- 関連記憶の自動提案
- 定期サマリー生成

---
*実装完了日: 2025-05-22*
*担当: Claude Code Assistant*