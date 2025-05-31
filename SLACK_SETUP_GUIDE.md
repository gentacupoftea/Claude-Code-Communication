# Conea Slack Bot セットアップガイド

## 概要

Conea Slack Botは、MultiLLM自律システムとSlackを統合し、開発、デザイン、プロジェクト管理をサポートするインテリジェントなボットです。

### 主な機能

- **インテリジェントなタスク判定**
  - `@conea` メンションだけで、内容から自動的に適切なLLMを選択
  - キーワードベースの自動カテゴリ分類
  - 最適なLLMエージェントの自動割り当て

- **自律デバッグシステム**
  - エラーの自動検出と分析
  - 解決策の自動生成と実行
  - パターン学習による改善

## セットアップ手順

### 1. Slack App の作成

1. [Slack API](https://api.slack.com/apps) にアクセス
2. "Create New App" → "From scratch" を選択
3. App Name: `Conea Bot`
4. Workspace を選択

### 2. Socket Mode の有効化

1. Settings → Socket Mode を開く
2. "Enable Socket Mode" をオン
3. Token Name: `conea-socket` として App Token を生成
4. トークンを `.env` に保存:
   ```
   SLACK_APP_TOKEN=xapp-1-...
   ```

### 3. OAuth & Permissions

1. OAuth & Permissions を開く
2. Bot Token Scopes に以下を追加:
   ```
   app_mentions:read
   channels:history
   channels:read
   chat:write
   commands
   groups:history
   groups:read
   im:history
   im:read
   im:write
   mpim:history
   mpim:read
   mpim:write
   users:read
   ```
3. "Install to Workspace" をクリック
4. Bot User OAuth Token を `.env` に保存:
   ```
   SLACK_BOT_TOKEN=xoxb-...
   ```

### 4. Event Subscriptions

1. Event Subscriptions を開く
2. "Enable Events" をオン
3. Subscribe to bot events:
   - `app_mention`
   - `message.channels`
   - `message.groups`
   - `message.im`
   - `message.mpim`

### 5. Slash Commands

1. Slash Commands を開く
2. "Create New Command" をクリック
3. Command: `/conea`
4. Request URL: (Socket Mode では不要)
5. Short Description: `Conea bot commands`

### 6. App Home

1. App Home を開く
2. "Allow users to send Slash commands and messages from the messages tab" をオン

## 環境変数設定

`.env` ファイルに以下を設定:

```env
# Slack設定
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# MultiLLM設定
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AIza...

# 自律デバッグ設定
AUTO_DEBUG_ENABLED=true
DEBUG_APPROVAL_LEVEL=3
```

## 起動方法

### 1. 依存関係のインストール

```bash
cd slack_integration
pip install -r requirements.txt
```

### 2. ボットの起動

```bash
python run_slack_bot.py
```

または、メインシステムから:

```bash
cd ..
python -m slack_integration.run_slack_bot
```

## 使用方法

### メンション コマンド（自動カテゴリ判定）

```
@conea バグ修正: ログイン処理のエラーハンドリング強化
→ 自動的に「開発」カテゴリと判定され、OpenAI/Claudeが対応

@conea ダッシュボードのUIプロトタイプ作成  
→ 自動的に「デザイン」カテゴリと判定され、Claude/Geminiが対応

@conea Phase 3の進捗状況レポート作成
→ 自動的に「管理」カテゴリと判定され、Claudeが対応

@conea システムアーキテクチャの分析をお願いします
→ 自動的に「分析」カテゴリと判定

@conea README.mdの更新
→ 自動的に「ドキュメント」カテゴリと判定
```

### 自動カテゴリ判定の仕組み

内容に含まれるキーワードから、以下のカテゴリを自動判定：

- **開発**: バグ、エラー、コード、実装、テスト、デバッグ、API、データベース
- **デザイン**: UI、UX、デザイン、レイアウト、スタイル、プロトタイプ、モックアップ
- **管理**: 進捗、スケジュール、タスク、プロジェクト、レポート、リスク、計画
- **分析**: 分析、調査、検討、評価、比較、データ、統計
- **ドキュメント**: ドキュメント、説明、README、マニュアル、ガイド、チュートリアル

### スラッシュ コマンド

```
/conea help - ヘルプを表示
/conea status - システムステータス確認
/conea debug - デバッグ情報表示
/conea stats - 使用統計表示
```

## 自律デバッグ機能

エラーが発生すると、自動的に以下の処理が実行されます：

1. **エラー分析**: エラータイプと原因を特定
2. **解決策生成**: パターンマッチングとLLMによる解決策提案
3. **自動修復**: 信頼度が高く、リスクが低い場合は自動実行
4. **結果報告**: Slackに修復結果を通知

### デバッグ設定

```python
# 自動修復のしきい値
AUTO_FIX_CONFIDENCE_THRESHOLD = 0.8  # 80%以上の信頼度で自動実行
APPROVAL_REQUIRED_RISK_LEVEL = 3     # リスクレベル3以上は承認必要
```

## トラブルシューティング

### 接続エラー

```bash
# Socket Mode接続の確認
python -c "from slack_bolt import App; app = App(token='YOUR_BOT_TOKEN'); print('OK')"
```

### 権限エラー

1. OAuth Scopesを再確認
2. ボットをチャンネルに招待: `/invite @conea-bot`

### デバッグモード

```bash
# デバッグログを有効化
export DEBUG=true
python run_slack_bot.py
```

## 統計情報

ボットは以下の統計を追跡します:

- 総リクエスト数
- 成功/失敗の応答数
- 使用されたトークン数とコスト
- エージェント別の使用状況
- 自動修復の成功率

統計を確認: `/conea stats`

## セキュリティ

- APIキーは環境変数で管理
- Slackトークンは暗号化して保存
- ユーザー権限の検証
- レート制限の実装

## 拡張方法

### 新しいコマンドの追加

```python
# slack_bot.py に追加
self.commands['conea-custom'] = {
    'agent': 'openai',
    'fallback': 'claude',
    'capabilities': ['カスタム機能'],
    'examples': ['カスタムタスク実行']
}
```

### デバッグパターンの追加

```python
# debug_system.py のpattern_dbに追加
ErrorType.CUSTOM_ERROR: [
    {
        "pattern": r"CustomError",
        "solution": "カスタムエラーの修正",
        "confidence": 0.9
    }
]
```