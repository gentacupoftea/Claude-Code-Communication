# Slack App セットアップガイド - Conea Bot

## 必要なSlack App設定

### 1. 基本的なApp設定

#### Slack API Portal での作成
1. **https://api.slack.com/apps** にアクセス
2. "Create New App" → "From scratch"
3. App名: `Conea AI Assistant`
4. ワークスペース選択

### 2. OAuth & Permissions 設定

#### Bot Token Scopes（必須）
```
app_mentions:read     # ボットへのメンションを読み取り
chat:write           # メッセージ送信
chat:write.public    # パブリックチャンネルへの書き込み
channels:history     # チャンネル履歴の読み取り（スレッド用）
```

#### User Token Scopes（オプション）
```
channels:read        # チャンネル情報の読み取り
users:read          # ユーザー情報の読み取り
```

### 3. Event Subscriptions 設定

#### Request URL
```
http://yourdomain.com:8000/slack/events
```
または
```
https://yourdomain.ngrok.io/slack/events
```

#### Subscribe to bot events（必須）
```
app_mention          # @botname でメンションされた時
message.channels     # パブリックチャンネルでのメッセージ（スレッド継続用）
```

#### Subscribe to events on behalf of users（オプション）
```
message.im           # DMメッセージ
```

### 4. Slash Commands 設定（実装済み）

#### /conea-status
- **Command**: `/conea-status`
- **Request URL**: `http://yourdomain.com:8000/slack/commands`
- **Short Description**: "Coneaシステムの状態確認"

#### /conea-memory
- **Command**: `/conea-memory`
- **Request URL**: `http://yourdomain.com:8000/slack/commands`
- **Short Description**: "メモリ検索・操作"

### 5. App Home 設定（オプション）

#### Home Tab
```
Show Tabs: Messages Tab, Home Tab
```

#### Messages Tab
```
Allow users to send Slash commands and messages from the messages tab: ✓
```

### 6. 必要なWebhook エンドポイント

#### 現在の実装で必要なエンドポイント

```javascript
// Event Subscriptionsで使用
app.post('/slack/events', (req, res) => {
  // Slackイベント処理
});

// Slash Commandsで使用
app.post('/slack/commands', (req, res) => {
  // スラッシュコマンド処理
});
```

### 7. ワークスペースインストール

#### Install App to Workspace
1. "Install to Workspace" ボタンをクリック
2. 権限を確認して承認
3. **Bot User OAuth Token** を取得（`xoxb-` で始まる）

### 8. 環境設定ファイルの更新

#### data/slack-config.json
```json
{
  "bot_token": "xoxb-your-actual-bot-token",
  "signing_secret": "your-signing-secret",
  "app_token": "xapp-your-app-token"
}
```

#### または環境変数で設定
```bash
export SLACK_BOT_TOKEN="xoxb-your-actual-bot-token"
export SLACK_SIGNING_SECRET="your-signing-secret"
export SLACK_APP_TOKEN="xapp-your-app-token"
```

### 9. Socket Mode設定（推奨）

#### Socket Mode有効化
1. **Socket Mode** → "Enable Socket Mode"
2. **App Token** を生成（`xapp-` で始まる）
3. Scopes: `connections:write`

#### Socket Modeのメリット
- 外部URL不要（ngrok等不要）
- ファイアウォール越えが簡単
- リアルタイム通信

### 10. 必須チャンネル設定

#### ボットをチャンネルに追加
```
/invite @conea-ai-assistant
```

#### 権限確認
- チャンネルでメッセージ送信可能
- メンション受信可能
- スレッド返信可能

## テスト手順

### 1. 基本メンション
```
@conea-ai-assistant Coneaプロジェクトについて教えて
```

### 2. スレッド継続（重要！）
1. 上記メンションでボットが応答
2. **スレッド内で**メンションなしに質問
```
進捗はどうですか？
```

### 3. スラッシュコマンド
```
/conea-status
/conea-memory search プロジェクト
```

## トラブルシューティング

### Event Subscriptions認証失敗
```
Request URL: Challenge failed
```
**解決**: サーバーでチャレンジレスポンスを実装

### メッセージが届かない
```
Missing scopes: app_mentions:read
```
**解決**: OAuth Scopesを再確認

### スレッド継続が動作しない
```
Event: message.channels が届かない
```
**解決**: Event Subscriptionsで`message.channels`を追加

## 現在の実装状況

### ✅ 実装済み
- `app_mention` イベント処理
- `message` イベント処理（スレッド継続）
- スラッシュコマンド（`/conea-status`, `/conea-memory`）
- メモリ統合とAI選択
- Socket Mode対応

### ❌ 実装が必要
- `/slack/events` エンドポイント（HTTPモード用）
- `/slack/commands` エンドポイント
- Challenge verification

---

## 緊急実装: HTTPモード用エンドポイント

現在Socket Mode用の実装になっているため、HTTPモードでも動作するようにエンドポイントを追加する必要があります。