# Conea AIチャット機能：アーキテクチャ設計

このドキュメントでは、Conea AIチャット機能のアーキテクチャ設計について詳細に説明します。

## アーキテクチャ概要

Conea AIチャット機能は、複数のAIプロバイダーを統一的なインターフェースで利用できるようにする設計になっています。主要なコンポーネントは次の通りです：

```
                           ┌─────────────────┐
                           │                 │
                           │     Client      │
                           │                 │
                           └─────────────────┘
                                   │
                                   ▼
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐│
│  │                 │    │                 │    │                 ││
│  │   AIController  │◄───┤    AI Routes    │◄───┤  Express App    ││
│  │                 │    │                 │    │                 ││
│  └─────────────────┘    └─────────────────┘    └─────────────────┘│
│           │                                                       │
│           ▼                                                       │
│  ┌─────────────────┐    ┌─────────────────┐                       │
│  │                 │    │                 │                       │
│  │ ProviderManager │───►│ ChartProcessor  │                       │
│  │                 │    │                 │                       │
│  └─────────────────┘    └─────────────────┘                       │
│           │                     │                                 │
│           ▼                     ▼                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐│
│  │                 │    │                 │    │                 ││
│  │   Adapters      │    │ChartDetector/   │    │ContextManager   ││
│  │                 │    │ChartRenderer    │    │                 ││
│  └─────────────────┘    └─────────────────┘    └─────────────────┘│
│           │                                            │          │
│           ▼                                            ▼          │
│  ┌─────────────────┐                         ┌─────────────────┐  │
│  │   OpenAI/       │                         │  Summarizer/    │  │
│  │   Claude/       │                         │  Transfer       │  │
│  │   Gemini        │                         │  Manager        │  │
│  └─────────────────┘                         └─────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## コンポーネント詳細

### 1. コントロールレイヤー

#### 1.1 AIChatController

AIチャット機能の中心となるコントローラーで、以下の機能を提供します：

- ユーザーからのチャットメッセージの受信と処理
- AIプロバイダー間の切り替え
- チャートコマンドの検出と処理
- コンテキスト管理（会話履歴のトラッキングと要約）

```typescript
export class AIChatController {
  // プロバイダー管理、コンテキスト管理、チャート処理を行う
  private providerManager: AIProviderManager;
  private contextManager: ContextManager;
  private chartProcessor: ChartProcessor;
  private transferManager: ContextTransferManager;
  
  // メッセージ送信処理
  async sendMessage(req: Request, res: Response) {
    // リクエスト処理、AI呼び出し、レスポンス作成
  }
  
  // その他のメソッド
  // - getAvailableProviders
  // - getConversationHistory
  // - clearConversation
  // - getChartExamples
}
```

#### 1.2 Routes

AIチャット機能のREST APIエンドポイントを定義します：

```typescript
// API ルート定義
const router = Router();
const controller = new AIChatController();

// メッセージ送信エンドポイント
router.post('/chat', controller.sendMessage.bind(controller));

// プロバイダー取得エンドポイント
router.get('/providers', controller.getAvailableProviders.bind(controller));

// 会話履歴取得エンドポイント
router.get('/history', controller.getConversationHistory.bind(controller));

// 会話クリアエンドポイント
router.post('/clear', controller.clearConversation.bind(controller));

// チャート例取得エンドポイント
router.get('/chart-examples', controller.getChartExamples.bind(controller));
```

### 2. アダプターレイヤー

#### 2.1 AIProviderManager

複数のAIプロバイダーを管理し、プロバイダー間の切り替えを処理します：

```typescript
export class AIProviderManager {
  // 利用可能なプロバイダーと現在アクティブなプロバイダーを管理
  private providers: Map<string, AIProvider> = new Map();
  private activeProvider: AIProvider;
  
  // プロバイダーの取得、設定、利用
  getAvailableProviders(): Array<{id: string, name: string}> {
    // 利用可能なプロバイダーのリストを返す
  }
  
  setActiveProvider(providerId: string): boolean {
    // アクティブなプロバイダーを設定
  }
  
  getCompletion(prompt: string, options?: CompletionOptions): Promise<AIResponse> {
    // アクティブなプロバイダーを使用して完了を取得
  }
}
```

#### 2.2 AIProvider インターフェースと実装

各AIプロバイダー（OpenAI、Claude、Gemini）に共通のインターフェースを提供します：

```typescript
// 共通インターフェース
export interface AIProvider {
  id: string;
  name: string;
  getCompletion(prompt: string, options?: CompletionOptions): Promise<AIResponse>;
  getTokenCount(text: string): Promise<number>;
  getMaxTokens(): number;
}

// OpenAI実装
export class OpenAIAdapter implements AIProvider {
  // OpenAI APIクライアントを使用した実装
}

// Claude実装
export class ClaudeAdapter implements AIProvider {
  // Anthropic APIクライアントを使用した実装
}

// Gemini実装
export class GeminiAdapter implements AIProvider {
  // Google Generative AI APIクライアントを使用した実装
}
```

### 3. チャート機能レイヤー

#### 3.1 ChartProcessor

AIが生成したチャートコマンドを検出し、チャート画像に変換します：

```typescript
export class ChartProcessor {
  // チャートコマンド検出とレンダリング
  private detector: ChartCommandDetector;
  private renderer: ChartRenderer;
  
  // テキスト内のチャートコマンドを処理
  async processText(text: string): Promise<string> {
    // チャートコマンドを検出して画像に置き換え
  }
  
  // サンプルチャートコードの生成
  generateExampleChartCode(chartType: string): string {
    // チャートタイプに基づいてサンプルコードを生成
  }
}
```

#### 3.2 ChartCommandDetector と ChartRenderer

チャートコマンドの検出とレンダリングを行います：

```typescript
// チャートコマンド検出
export class ChartCommandDetector {
  // チャートコマンドの正規表現
  private readonly CHART_COMMAND_REGEX = /```chart\s*\n([\s\S]*?)```/g;
  
  // チャートコマンドの検出とデータ抽出
  detectChartCommands(text: string): ChartCommand[] {
    // テキスト内のチャートコマンドを検出
  }
  
  // チャートデータの検証
  validateChartData(chartData: any): boolean {
    // チャートデータの構造とタイプを検証
  }
}

// チャートレンダリング
export class ChartRenderer {
  // Chart.jsを使用したレンダリングとキャッシュ
  private readonly chartJSNodeCanvas: ChartJSNodeCanvas;
  private readonly chartCache: Map<string, string>;
  
  // チャートのレンダリング
  async renderChart(chartData: any): Promise<string> {
    // チャートデータからChart.js設定を作成し、画像をレンダリング
  }
}
```

### 4. コンテキスト管理レイヤー

#### 4.1 ContextManager

会話コンテキストとトークン使用量を管理します：

```typescript
export class ContextManager {
  // メッセージとトークンカウントの管理
  private messages: ChatMessage[] = [];
  private tokenCount: number = 0;
  private activeProvider: AIProvider;
  
  // メッセージの追加（要約が必要かどうかを返す）
  async addMessage(message: ChatMessage): Promise<boolean> {
    // メッセージを追加し、トークン数を更新
  }
  
  // コンテキスト管理のその他の機能
  // - getMessages
  // - getCurrentTokenCount
  // - clear
  // - getTokenUsagePercentage
}
```

#### 4.2 ContextTransferManager と ConversationSummarizer

プロバイダー変更時のコンテキスト転送と長い会話の要約：

```typescript
// コンテキスト転送
export class ContextTransferManager {
  // コンテキストとAIプロバイダーの管理
  private contextManager: ContextManager;
  private summarizer: ConversationSummarizer;
  
  // プロバイダー変更時のコンテキスト転送
  async transferToNewProvider(
    newProvider: AIProvider,
    newContextManager?: ContextManager
  ): Promise<ContextManager> {
    // コンテキストを要約し、新しいプロバイダーに転送
  }
}

// 会話要約
export class ConversationSummarizer {
  // AIプロバイダーと要約プロンプト
  constructor(private aiProvider: AIProvider) {}
  
  // 会話の要約
  async summarizeConversation(messages: ChatMessage[]): Promise<string> {
    // メッセージを要約
  }
  
  // より簡潔な要約（プロバイダー切替用）
  async generateConciseSummary(messages: ChatMessage[]): Promise<string> {
    // 簡潔な要約を生成
  }
}
```

### 5. セキュリティレイヤー

#### 5.1 セキュリティユーティリティ

入出力のサニタイズとチャートデータのバリデーションを行います：

```typescript
// 入力サニタイズ
export function sanitizeInput(input: string): string {
  // 潜在的に危険なHTMLや過度に長い入力を除去
}

// 出力サニタイズ
export function sanitizeOutput(output: string): string {
  // 潜在的に危険なHTML要素やJavaScriptを除去
}

// チャートデータ検証
export function validateChartData(jsonData: any): any | null {
  // チャートデータの検証と安全な加工
}
```

## データフロー

1. **メッセージ送信フロー**
   - クライアントが `/api/ai/chat` にメッセージをPOST
   - `AIChatController.sendMessage()` がリクエストを処理
   - メッセージがサニタイズされ、コンテキストに追加
   - 必要に応じて会話が要約される
   - `AIProviderManager` がアクティブなプロバイダーを使用して応答を取得
   - `ChartProcessor` が応答内のチャートコマンドを処理
   - 処理された応答がクライアントに返される

2. **プロバイダー切替フロー**
   - クライアントが異なるプロバイダーIDを指定してメッセージを送信
   - `AIChatController` が新しいプロバイダーIDを検出
   - `AIProviderManager.setActiveProvider()` が呼び出される
   - `ContextTransferManager` が現在のコンテキストを要約
   - 要約とその他の重要なメッセージが新しいプロバイダーのコンテキストに転送
   - 会話が新しいプロバイダーで続行

3. **チャート生成フロー**
   - AIがチャートコマンドを含む応答を生成
   - `ChartProcessor.processText()` がテキスト内のチャートコマンドを検出
   - `ChartCommandDetector` がコマンドを抽出し、データを検証
   - `ChartRenderer` がチャートデータからChart.js設定を作成
   - チャート画像がレンダリングされ、Base64エンコードされる
   - チャートコマンドがMarkdownの画像参照に置き換えられる

## 拡張性と保守性

### プロバイダーの追加

新しいAIプロバイダーを追加するには、`AIProvider`インターフェースを実装する新しいアダプタークラスを作成し、`AIProviderManager`に登録するだけです：

```typescript
// 新しいAIプロバイダーアダプター
export class NewProviderAdapter implements AIProvider {
  id = 'new-provider';
  name = 'New Provider';
  
  // インターフェースメソッドの実装
  async getCompletion(prompt: string, options?: CompletionOptions): Promise<AIResponse> {
    // 新しいプロバイダーAPIを使用した実装
  }
  
  async getTokenCount(text: string): Promise<number> {
    // トークン数計算の実装
  }
  
  getMaxTokens(): number {
    // 最大トークン数を返す
  }
}

// プロバイダーマネージャーへの登録
const newProvider = new NewProviderAdapter();
providerManager.providers.set(newProvider.id, newProvider);
```

### チャートタイプの追加

新しいチャートタイプを追加するには、`ChartCommandDetector.validateChartData()`を更新して新しいタイプを許可し、`ChartProcessor.generateExampleChartCode()`に例を追加します：

```typescript
// チャートタイプの追加
// 1. validateChartData() を更新
const validChartTypes = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', 'scatter', 'bubble', 'new-type'];

// 2. generateExampleChartCode() にサンプルを追加
examples['new-type'] = `\`\`\`chart
{
  "type": "new-type",
  "title": "New Chart Type Example",
  "data": {
    "labels": ["A", "B", "C"],
    "datasets": [{
      "label": "Values",
      "data": [10, 20, 30]
    }]
  }
}
\`\`\``;
```

## セキュリティ考慮事項

1. **入力検証と出力サニタイズ**
   - すべてのユーザー入力に対して `sanitizeInput()` を適用
   - すべてのAI応答に対して `sanitizeOutput()` を適用
   - チャートデータに対して厳格なバリデーションを実施

2. **APIキー管理**
   - すべてのAIプロバイダーのAPIキーは環境変数として管理
   - キーローテーションのためのユーティリティを提供

3. **トークン使用量の制限**
   - コンテキストサイズとトークン使用量の監視
   - 長い会話の自動要約

## パフォーマンス最適化

1. **チャートキャッシュ**
   - 生成したチャート画像をキャッシュして再生成を回避
   - LRU（Least Recently Used）アルゴリズムを使用して古いキャッシュエントリを削除

2. **トークン計算の最適化**
   - 公式トークナイザーを使用して正確なトークン数を計算
   - キャッシュを使用して頻繁に計算されるテキストを最適化

3. **メモリ使用量の監視と最適化**
   - 定期的なメモリ最適化
   - 長期稼働時のメモリリーク防止

## まとめ

この設計は、拡張性、保守性、セキュリティ、およびパフォーマンスを重視しています。アダプターパターンを使用して異なるAIプロバイダーを統一的に扱い、責任の分離を明確にすることで、将来の拡張や変更を容易にしています。また、セキュリティとパフォーマンスの考慮事項が組み込まれており、本番環境での堅牢性を確保しています。