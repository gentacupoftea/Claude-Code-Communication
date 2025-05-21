# Conea AIチャット機能

## 概要

Conea AIチャット機能は、複数のAIプロバイダー（OpenAI、Claude、Gemini）に対応し、チャート生成と長い会話の自動要約機能を備えた高度なチャットシステムです。

## 主な機能

### 1. マルチAIプロバイダー対応
- OpenAI GPT-4
- Anthropic Claude 3
- Google Gemini Pro
- プロバイダー間でのシームレスな切り替え

### 2. データ可視化
- 自然言語からのチャート生成
- 複数のチャートタイプ対応（棒グラフ、線グラフ、円グラフなど）
- チャートデータの自動フォーマット

### 3. コンテキスト管理
- 長いチャットの自動要約
- プロバイダー切替時のコンテキスト転送
- トークン使用量のモニタリング

## 技術的特徴

- モジュラーな設計で新しいAIプロバイダーの追加が容易
- Chart.jsベースの強力なチャート生成機能
- 効率的なコンテキスト管理とメモリ最適化
- RESTful APIインターフェイス

## ファイル構造

```
src/ai_chat/
├── controllers/
│   └── ai-chat-controller.ts      # チャットAPIエンドポイント制御
├── routes/
│   └── ai-routes.ts               # APIルーティング定義
├── services/
│   ├── ai/
│   │   ├── adapter.ts             # AIプロバイダーアダプター
│   │   └── provider-manager.ts    # プロバイダー管理機能
│   ├── chart/
│   │   ├── chart-detector.ts      # チャートコマンド検出
│   │   ├── chart-processor.ts     # チャート処理ロジック
│   │   └── chart-renderer.ts      # チャート画像生成
│   ├── context/
│   │   ├── context-manager.ts     # チャット履歴管理
│   │   └── transfer-manager.ts    # プロバイダー切替時のコンテキスト転送
│   └── summary/
│       └── summarizer.ts          # チャット要約機能
├── models/                        # データモデル（今後拡張予定）
├── utils/                         # ユーティリティ関数（今後拡張予定）
├── index.ts                       # メインエントリーポイント
├── INTEGRATION_GUIDE.md           # 統合ガイド
└── README.md                      # このファイル
```

## API仕様

### エンドポイント

#### `POST /api/ai/chat`
メッセージをAIに送信し、応答を取得します。

リクエスト:
```json
{
  "message": "こんにちは",
  "providerId": "claude" // オプション、省略時は現在のプロバイダーを使用
}
```

レスポンス:
```json
{
  "message": "こんにちは！どのようにお手伝いできますか？",
  "provider": "Claude (Anthropic)",
  "tokenUsage": {
    "current": 127,
    "max": 200000,
    "percentage": 0.0635,
    "promptTokens": 65,
    "completionTokens": 62,
    "totalTokens": 127
  }
}
```

#### `GET /api/ai/providers`
利用可能なAIプロバイダーを取得します。

レスポンス:
```json
{
  "providers": [
    {"id": "openai", "name": "OpenAI (GPT-4)"},
    {"id": "claude", "name": "Claude (Anthropic)"},
    {"id": "gemini", "name": "Gemini (Google)"}
  ],
  "activeProvider": "claude"
}
```

#### `GET /api/ai/history`
会話履歴を取得します。

レスポンス:
```json
{
  "messages": [
    {"role": "user", "content": "こんにちは", "timestamp": 1621500000000},
    {"role": "assistant", "content": "こんにちは！どのようにお手伝いできますか？", "timestamp": 1621500001000}
  ],
  "tokenUsage": {
    "current": 127,
    "max": 200000,
    "percentage": 0.0635
  }
}
```

#### `POST /api/ai/clear`
会話履歴をクリアします。

レスポンス:
```json
{
  "success": true,
  "message": "Conversation cleared"
}
```

#### `GET /api/ai/chart-examples`
チャート例を取得します。

パラメータ:
- `chartType`: チャートタイプ (bar, line, pie, etc.)

レスポンス:
```json
{
  "example": "```chart\n{\n  \"type\": \"bar\",\n  \"title\": \"Monthly Sales\",\n  \"data\": {...}\n}\n```"
}
```

## 使用方法

### 環境変数の設定

以下の環境変数をセットアップします：

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

### アプリケーションへの統合

`index.ts` ファイルからAIチャット機能を初期化します：

```typescript
import express from 'express';
import { initializeAIChat } from './ai_chat';

const app = express();
app.use(express.json());

// AIチャット機能を初期化
initializeAIChat(app);

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

詳細な統合手順については、[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)を参照してください。

## 開発ロードマップ

- [ ] チャット履歴の永続化
- [ ] より高度なチャート機能（インタラクティブチャート、地図データビジュアライゼーション）
- [ ] データ分析向けの特殊コマンド
- [ ] ユーザー定義のプロンプトテンプレート
- [ ] チームでの会話共有機能
- [ ] API設定の管理UIの実装

## 貢献

貢献はいつでも歓迎します。ぜひプルリクエストを提出してください。

---

© 2025 Conea AIチャットチーム