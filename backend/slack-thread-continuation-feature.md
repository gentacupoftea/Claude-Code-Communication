# Slack Bot スレッド内継続会話機能

## 機能概要

Slackボットが最初にメンションされたスレッドでは、その後のメッセージに対してメンションなしでも自動的に応答する機能を実装しました。

## 主要機能

### 1. アクティブスレッド追跡
- **初回メンション**: ボットがメンションされたスレッドを「アクティブ」として記録
- **継続会話**: そのスレッド内でのメンションなしメッセージにも応答
- **タイムアウト**: 30分間活動がないスレッドは自動的に非アクティブ化

### 2. インテリジェントな応答判定
```javascript
// 以下の条件で応答
- スレッド内のメッセージである (event.thread_ts が存在)
- アクティブなスレッドとして記録されている
- ボット自身のメッセージではない
- 新しいメンションを含まない
- 30分以内の活動がある
```

### 3. スレッド管理機能
- **ユーザー追跡**: スレッド内で発言したユーザーを記録
- **活動時間更新**: メッセージごとに最終活動時間を更新
- **自動クリーンアップ**: 5分ごとに期限切れスレッドを削除

## 実装詳細

### データ構造
```javascript
const activeThreads = new Map(); // thread_ts -> threadInfo

// threadInfo の構造
{
  channel: "チャンネルID",
  users: Set([ユーザーIDのセット]),
  lastActivity: Date,
  botMentioned: true
}
```

### タイムアウト設定
```javascript
const THREAD_TIMEOUT = 30 * 60 * 1000; // 30分
// クリーンアップ間隔: 5分
```

### イベントハンドラー

#### 1. app_mention イベント
```javascript
slackApp.event('app_mention', async ({ event, client, say }) => {
  // 通常のメンション処理 + スレッド追跡開始
  const threadTs = event.thread_ts || event.ts;
  activeThreads.set(threadTs, {
    channel: event.channel,
    users: new Set([event.user]),
    lastActivity: new Date(),
    botMentioned: true
  });
});
```

#### 2. message イベント
```javascript
slackApp.event('message', async ({ event, client, say }) => {
  // アクティブスレッド内のメッセージに応答
  if (event.thread_ts && activeThreads.has(event.thread_ts)) {
    // コンテキスト取得 + AI応答生成 + 返信
  }
});
```

## 使用方法

### ステップ1: スレッド開始
```
ユーザー: @conea AI Assistant Coneaプロジェクトについて教えて
ボット: [詳細な回答]
```
→ このスレッドがアクティブになります

### ステップ2: 継続会話
```
ユーザー: 進捗はどうですか？ (メンションなし)
ボット: [プロジェクト進捗について回答]

ユーザー: 次のステップは？ (メンションなし)  
ボット: [次のステップについて回答]
```
→ メンションなしでも継続して応答

### ステップ3: 自動終了
- 30分間活動がない場合、スレッドは自動的に非アクティブ化
- 新しいメンションで再度アクティブ化可能

## ログ出力例

### スレッド開始時
```
📱 Slack mention from U1234567: @conea AI Assistant Coneaプロジェクトについて教えて
🧵 Thread 1747952789.123456 is now active for continuous conversation
```

### 継続会話時
```
💬 Thread message from U1234567: 進捗はどうですか？
✅ Responded to thread message in 1747952789.123456
```

### クリーンアップ時
```
🧹 Cleaned up expired thread: 1747952789.123456
```

## メモリ統合

継続会話でも完全なメモリ機能が利用可能：
- **キーワード抽出**: 日本語質問から適切なキーワードを抽出
- **コンテキスト取得**: 過去の記憶から関連情報を取得
- **AI選択**: 質問内容に最適なAI（Claude/OpenAI/Gemini）を選択
- **記憶保存**: 会話内容を自動的にメモリに保存

## 設定パラメータ

### タイムアウト設定
```javascript
const THREAD_TIMEOUT = 30 * 60 * 1000; // 30分
```

### クリーンアップ間隔
```javascript
setInterval(cleanupThreads, 5 * 60 * 1000); // 5分ごと
```

## 注意事項

1. **プライバシー**: スレッド情報はメモリ内のみ（永続化なし）
2. **パフォーマンス**: 定期的なクリーンアップでメモリ使用量を制御
3. **競合回避**: メンション付きメッセージは通常のapp_mentionハンドラーが処理
4. **エラー処理**: スレッド処理エラー時はスパムを避けるため無応答

---
実装日: 2025-05-23  
機能状態: 実装完了・テスト待ち  
効果: Slackでの自然な継続会話が可能