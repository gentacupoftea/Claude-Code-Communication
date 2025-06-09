# フロントエンド開発ガイド

Sprint 1 AI-5号機の成果物 - MultiLLM Chat Interface の開発ドキュメント

## 概要

このドキュメントは、MultiLLM Chat Interface のフロントエンド開発に関する包括的なガイドです。5つのAIチームが並行開発した成果物の統合と、今後の開発方針について説明します。

## アーキテクチャ

### 技術スタック

- **フレームワーク**: Next.js 15.3.2 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **状態管理**: Zustand
- **UI コンポーネント**: React 19
- **バックエンド連携**: REST API
- **開発ツール**: ESLint, Prettier

### ディレクトリ構造

```
frontend-v2/
├── app/                    # Next.js App Router pages
│   ├── chat/              # チャットページ
│   ├── dashboard/         # ダッシュボード
│   └── settings/          # 設定ページ
├── src/
│   ├── components/        # Reactコンポーネント
│   │   ├── common/        # 共通コンポーネント
│   │   ├── chat/          # チャット関連
│   │   └── dashboard/     # ダッシュボード関連
│   ├── store/             # Zustand状態管理
│   ├── lib/               # ユーティリティ・API
│   ├── types/             # TypeScript型定義
│   └── hooks/             # カスタムフック
└── docs/                  # ドキュメント
```

## Sprint 1 の成果物

### AI-1号機: APIクライアント & 状態管理

**作成ファイル:**
- `src/lib/backendApi.ts` - MultiLLM API クライアント
- `src/store/llmStore.ts` - Zustand ベース状態管理

**機能:**
- RESTful API 通信
- ワーカー/モデル管理
- チャット履歴管理
- エラーハンドリング
- ヘルスチェック

### AI-2号機: 共通UIコンポーネント

**作成ファイル:**
- `src/components/common/WorkerSelector.tsx` - LLMワーカー選択
- `src/components/common/ModelSelector.tsx` - AIモデル選択
- `src/components/common/LoadingSpinner.tsx` - ローディング表示
- `src/components/common/ErrorMessage.tsx` - エラー表示
- `src/components/common/index.ts` - エクスポート管理

**特徴:**
- 再利用可能なコンポーネント設計
- アクセシビリティ対応
- Tailwind CSS による一貫したデザイン
- TypeScript による型安全性

### AI-3号機: チャット機能

**作成ファイル:**
- `src/components/chat/ChatMessage.tsx` - メッセージ表示
- `src/components/chat/ChatHistory.tsx` - 履歴表示
- `src/components/chat/ChatInput.tsx` - メッセージ入力
- `src/components/chat/index.ts` - エクスポート管理

**機能:**
- リアルタイムチャット表示
- メッセージタイプ別スタイリング
- 自動スクロール
- キーボードショートカット
- ストリーミング対応

### AI-4号機: メインページ

**作成ファイル:**
- `app/chat/page.tsx` - チャットメインページ

**特徴:**
- レスポンシブデザイン
- サイドバー設定パネル
- リアルタイム接続ステータス
- ユーザーガイド統合

### AI-5号機: 型定義 & ドキュメント

**作成ファイル:**
- `src/types/llm.ts` - 包括的型定義
- `docs/FRONTEND_DEVELOPMENT.md` - 開発ドキュメント

**提供内容:**
- 完全な TypeScript 型システム
- API インターフェース定義
- エラータイプ & 型ガード
- 開発ガイドライン

## API 連携

### エンドポイント

```typescript
// ワーカー管理
GET /workers                    // 利用可能ワーカー一覧
GET /workers/{type}/models      // モデル一覧

// チャット
POST /generate                  // メッセージ生成
POST /chat/stream              // ストリーミングチャット

// システム
GET /health                    // ヘルスチェック
```

### レスポンス形式

```typescript
// ワーカー一覧レスポンス
{
  "workers": ["openai", "anthropic", "local_llm"]
}

// 生成レスポンス
{
  "success": true,
  "response": "AIからの回答",
  "worker_type": "openai",
  "model_id": "gpt-4"
}
```

## 状態管理

### Zustand Store 構造

```typescript
interface LLMStore {
  // 状態
  workers: string[];
  models: string[];
  selectedWorker: string;
  selectedModel: string;
  chatHistory: ChatMessage[];
  isLoading: boolean;
  isGenerating: boolean;
  
  // アクション
  loadWorkers: () => Promise<void>;
  selectWorkerAndLoadModels: (worker: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  checkHealth: () => Promise<void>;
}
```

### 使用例

```typescript
// コンポーネント内での使用
const { workers, loadWorkers } = useLLMStore();
const { sendMessage, chatHistory } = useChat();

// 初期化
useEffect(() => {
  loadWorkers();
}, []);
```

## コンポーネント設計原則

### 1. 単一責任の原則
各コンポーネントは一つの明確な責任を持つ

```typescript
// ✅ 良い例: 単一責任
const WorkerSelector = () => { ... };
const ModelSelector = () => { ... };

// ❌ 悪い例: 複数責任
const WorkerModelSelector = () => { ... };
```

### 2. Props インターフェース

```typescript
interface ComponentProps {
  className?: string;        // スタイルカスタマイズ
  disabled?: boolean;        // 無効化状態
  onEvent?: () => void;      // イベントハンドラ
}
```

### 3. エラーハンドリング

```typescript
// エラー境界とユーザーフレンドリーなメッセージ
{error && (
  <ErrorMessage
    message={error}
    onClose={clearError}
    closable={true}
  />
)}
```

## スタイリングガイドライン

### Tailwind CSS クラス

```typescript
// 基本レイアウト
const containerClasses = "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8";
const cardClasses = "bg-white rounded-lg shadow p-6";

// 状態別スタイル
const buttonClasses = `
  px-4 py-2 rounded-lg transition-colors duration-200
  ${disabled 
    ? 'bg-gray-300 cursor-not-allowed' 
    : 'bg-blue-600 hover:bg-blue-700 text-white'
  }
`;
```

### レスポンシブデザイン

```typescript
// モバイルファースト
const responsiveClasses = "
  grid grid-cols-1 gap-4
  sm:grid-cols-2 
  lg:grid-cols-4 
  xl:gap-6
";
```

## パフォーマンス最適化

### 1. React.memo の使用

```typescript
export const ChatMessage = React.memo<ChatMessageProps>(({ message }) => {
  // レンダリング最適化
});
```

### 2. 仮想化（長いリスト）

```typescript
// チャット履歴が長い場合の仮想化実装
const VirtualizedChatHistory = () => {
  // react-window or react-virtualized 使用
};
```

### 3. 遅延読み込み

```typescript
// コンポーネントの遅延読み込み
const ChatPage = lazy(() => import('./ChatPage'));
```

## テスト戦略

### 単体テスト

```typescript
// コンポーネントテスト
describe('WorkerSelector', () => {
  test('should display available workers', () => {
    render(<WorkerSelector />);
    expect(screen.getByText('openai')).toBeInTheDocument();
  });
});

// Store テスト
describe('LLMStore', () => {
  test('should load workers', async () => {
    const store = useLLMStore.getState();
    await store.loadWorkers();
    expect(store.workers.length).toBeGreaterThan(0);
  });
});
```

### 統合テスト

```typescript
// API 統合テスト
describe('Chat Integration', () => {
  test('should send message and receive response', async () => {
    // E2E テストシナリオ
  });
});
```

## セキュリティ考慮事項

### 1. XSS 防止

```typescript
// HTML エスケープ
const SafeContent = ({ content }: { content: string }) => (
  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
);
```

### 2. API キー保護

```typescript
// 環境変数使用
const API_URL = process.env.NEXT_PUBLIC_API_URL;
// 秘密鍵は NEXT_PUBLIC_ プレフィックスを使用しない
```

## デプロイメント

### 本番ビルド

```bash
# 最適化ビルド
npm run build

# 本番サーバー起動
npm run start
```

### 環境変数

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_WS_URL=wss://api.example.com
```

## 今後の開発計画

### フェーズ 2: 高度な機能

1. **ストリーミングレスポンス**
   - リアルタイム応答表示
   - WebSocket 実装

2. **マルチモーダル対応**
   - 画像アップロード
   - ファイル処理

3. **カスタマイゼーション**
   - テーマシステム
   - ユーザー設定

### フェーズ 3: エンタープライズ機能

1. **認証・認可**
   - ユーザー管理
   - ロールベースアクセス

2. **分析・監視**
   - 使用量追跡
   - パフォーマンス監視

3. **拡張性**
   - プラグインシステム
   - カスタムワーカー

## トラブルシューティング

### よくある問題

1. **API 接続エラー**
   ```typescript
   // ヘルスチェック実行
   const { checkHealth } = useLLMStore();
   await checkHealth();
   ```

2. **状態同期問題**
   ```typescript
   // Store リセット
   const { resetStore } = useLLMStore();
   resetStore();
   ```

3. **レンダリング問題**
   ```typescript
   // React DevTools で状態確認
   console.log(useLLMStore.getState());
   ```

## 参考資料

- [Next.js 公式ドキュメント](https://nextjs.org/docs)
- [Zustand ドキュメント](https://github.com/pmndrs/zustand)
- [Tailwind CSS ガイド](https://tailwindcss.com/docs)
- [TypeScript ハンドブック](https://www.typescriptlang.org/docs)

---

このドキュメントは、Sprint 1 で構築された基盤の上に、継続的な改善と拡張を行うためのガイドとして活用してください。