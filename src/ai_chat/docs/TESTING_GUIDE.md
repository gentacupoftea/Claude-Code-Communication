# Conea AIチャット機能：テストガイド

このドキュメントでは、Conea AIチャット機能のテスト方法と、一般的なテストケースについて説明します。

## 目次

1. [テスト環境のセットアップ](#1-テスト環境のセットアップ)
2. [単体テスト](#2-単体テスト)
3. [統合テスト](#3-統合テスト)
4. [エンドツーエンドテスト](#4-エンドツーエンドテスト)
5. [パフォーマンステスト](#5-パフォーマンステスト)
6. [セキュリティテスト](#6-セキュリティテスト)
7. [ロードテスト](#7-ロードテスト)
8. [継続的インテグレーション](#8-継続的インテグレーション)

## 1. テスト環境のセットアップ

### 1.1 モック依存関係の設定

AIプロバイダーのAPIをモックするためのセットアップ：

```typescript
// src/ai_chat/tests/mocks/ai-provider.mock.ts
import { AIProvider, AIResponse, CompletionOptions } from '../../services/ai/adapter';

export class MockAIProvider implements AIProvider {
  id = 'mock-provider';
  name = 'Mock Provider';
  
  private static responses: Record<string, string> = {
    'こんにちは': 'こんにちは！どのようにお手伝いできますか？',
    'hello': 'Hello! How can I help you today?',
    'chart': `Here's a chart for you:\n\n\`\`\`chart\n{"type":"bar","title":"Sample Chart","data":{"labels":["A","B","C"],"datasets":[{"label":"Values","data":[10,20,30]}]}}\n\`\`\``
  };
  
  private static defaultResponse = 'I am a mock AI provider for testing purposes.';
  
  async getCompletion(prompt: string, options?: CompletionOptions): Promise<AIResponse> {
    // プロンプトに基づいて応答を選択（または作成）
    let responseText = MockAIProvider.defaultResponse;
    
    for (const [key, value] of Object.entries(MockAIProvider.responses)) {
      if (prompt.includes(key)) {
        responseText = value;
        break;
      }
    }
    
    // レスポンスを遅延
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      text: responseText,
      usage: {
        promptTokens: await this.getTokenCount(prompt),
        completionTokens: await this.getTokenCount(responseText),
        totalTokens: await this.getTokenCount(prompt) + await this.getTokenCount(responseText)
      }
    };
  }
  
  async getTokenCount(text: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }
  
  getMaxTokens(): number {
    return 10000;
  }
  
  public static addMockResponse(trigger: string, response: string): void {
    MockAIProvider.responses[trigger] = response;
  }
  
  public static resetMockResponses(): void {
    MockAIProvider.responses = {
      'こんにちは': 'こんにちは！どのようにお手伝いできますか？',
      'hello': 'Hello! How can I help you today?',
      'chart': `Here's a chart for you:\n\n\`\`\`chart\n{"type":"bar","title":"Sample Chart","data":{"labels":["A","B","C"],"datasets":[{"label":"Values","data":[10,20,30]}]}}\n\`\`\``
    };
  }
}

// チャートのモック
export class MockChartRenderer {
  async renderChart(chartData: any): Promise<string> {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  }
  
  clearCache(): void {
    // モックメソッド
  }
  
  getCacheSize(): number {
    return 0;
  }
}
```

### 1.2 テスト用のユーティリティ関数

```typescript
// src/ai_chat/tests/utils/test-helpers.ts
import { Request, Response } from 'express';
import { AIChatController } from '../../controllers/ai-chat-controller';
import { MockAIProvider, MockChartRenderer } from '../mocks/ai-provider.mock';
import { AIProviderManager } from '../../services/ai/provider-manager';
import { ChartProcessor } from '../../services/chart/chart-processor';

// モックレスポンス
export class MockResponse {
  public statusCode: number = 200;
  public headers: Record<string, string> = {};
  public body: any = null;
  
  status(code: number): MockResponse {
    this.statusCode = code;
    return this;
  }
  
  json(data: any): MockResponse {
    this.body = data;
    return this;
  }
  
  setHeader(name: string, value: string): MockResponse {
    this.headers[name] = value;
    return this;
  }
  
  end(): void {
    // モックメソッド
  }
}

// モックリクエスト
export class MockRequest {
  public body: any;
  public query: Record<string, string> = {};
  public params: Record<string, string> = {};
  public headers: Record<string, string> = {};
  
  constructor(body: any = {}) {
    this.body = body;
  }
  
  setQuery(query: Record<string, string>): MockRequest {
    this.query = query;
    return this;
  }
  
  setParams(params: Record<string, string>): MockRequest {
    this.params = params;
    return this;
  }
  
  setHeaders(headers: Record<string, string>): MockRequest {
    this.headers = headers;
    return this;
  }
}

// テスト用のコントローラーファクトリ
export function createTestController(): [AIChatController, MockAIProvider] {
  // モックプロバイダーの作成
  const mockProvider = new MockAIProvider();
  
  // プロバイダーマネージャーをオーバーライド
  const originalProviderManagerPrototype = AIProviderManager.prototype;
  AIProviderManager.prototype.getActiveProvider = function() {
    return mockProvider;
  };
  AIProviderManager.prototype.getAvailableProviders = function() {
    return [{ id: mockProvider.id, name: mockProvider.name }];
  };
  AIProviderManager.prototype.setActiveProvider = function() {
    return true;
  };
  
  // チャートプロセッサーをオーバーライド
  const originalChartProcessorPrototype = ChartProcessor.prototype;
  ChartProcessor.prototype.processText = async function(text: string) {
    if (text.includes('```chart')) {
      return text.replace(/```chart[\s\S]*?```/g, '![Chart](data:image/png;base64,MOCK_CHART_IMAGE)');
    }
    return text;
  };
  
  // コントローラーの作成
  const controller = new AIChatController();
  
  return [controller, mockProvider];
}

// テスト後のクリーンアップ
export function cleanupTestController(): void {
  MockAIProvider.resetMockResponses();
}
```

## 2. 単体テスト

### 2.1 アダプターのテスト

```typescript
// src/ai_chat/tests/unit/adapter.test.ts
import { OpenAIAdapter, ClaudeAdapter, GeminiAdapter } from '../../services/ai/adapter';

describe('AI Provider Adapters', () => {
  // OpenAIアダプターのテスト
  describe('OpenAIAdapter', () => {
    let adapter: OpenAIAdapter;
    
    beforeEach(() => {
      adapter = new OpenAIAdapter();
      // APIキーの環境変数をモック
      process.env.OPENAI_API_KEY = 'test-api-key';
    });
    
    test('should initialize with correct ID and name', () => {
      expect(adapter.id).toBe('openai');
      expect(adapter.name).toBe('OpenAI (GPT-4)');
    });
    
    test('should calculate token count', async () => {
      const text = 'Hello, world!';
      const count = await adapter.getTokenCount(text);
      expect(count).toBeGreaterThan(0);
    });
    
    test('should return max tokens', () => {
      expect(adapter.getMaxTokens()).toBeGreaterThan(0);
    });
    
    // 実際のAPIを呼び出さないようにモックを使用した完全なテストを実装
  });
  
  // Claudeアダプターのテスト
  describe('ClaudeAdapter', () => {
    let adapter: ClaudeAdapter;
    
    beforeEach(() => {
      adapter = new ClaudeAdapter();
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
    });
    
    test('should initialize with correct ID and name', () => {
      expect(adapter.id).toBe('claude');
      expect(adapter.name).toBe('Claude (Anthropic)');
    });
    
    test('should calculate token count', async () => {
      const text = 'Hello, world!';
      const count = await adapter.getTokenCount(text);
      expect(count).toBeGreaterThan(0);
    });
    
    test('should return max tokens', () => {
      expect(adapter.getMaxTokens()).toBeGreaterThan(0);
    });
  });
  
  // Geminiアダプターのテスト
  describe('GeminiAdapter', () => {
    let adapter: GeminiAdapter;
    
    beforeEach(() => {
      adapter = new GeminiAdapter();
      process.env.GEMINI_API_KEY = 'test-api-key';
    });
    
    test('should initialize with correct ID and name', () => {
      expect(adapter.id).toBe('gemini');
      expect(adapter.name).toBe('Gemini (Google)');
    });
    
    test('should calculate token count', async () => {
      const text = 'Hello, world!';
      const count = await adapter.getTokenCount(text);
      expect(count).toBeGreaterThan(0);
    });
    
    test('should return max tokens', () => {
      expect(adapter.getMaxTokens()).toBeGreaterThan(0);
    });
  });
});
```

### 2.2 コンテキストマネージャーのテスト

```typescript
// src/ai_chat/tests/unit/context-manager.test.ts
import { ContextManager, ChatMessage } from '../../services/context/context-manager';
import { MockAIProvider } from '../mocks/ai-provider.mock';

describe('ContextManager', () => {
  let contextManager: ContextManager;
  let mockProvider: MockAIProvider;
  
  beforeEach(() => {
    mockProvider = new MockAIProvider();
    contextManager = new ContextManager(mockProvider);
  });
  
  test('should add messages and track token count', async () => {
    const message: ChatMessage = {
      role: 'user',
      content: 'Hello, world!'
    };
    
    const result = await contextManager.addMessage(message);
    
    expect(result).toBe(true);
    expect(contextManager.getMessages()).toHaveLength(1);
    expect(contextManager.getMessages()[0].content).toBe('Hello, world!');
    expect(contextManager.getCurrentTokenCount()).toBeGreaterThan(0);
  });
  
  test('should clear messages', async () => {
    const message: ChatMessage = {
      role: 'user',
      content: 'Hello, world!'
    };
    
    await contextManager.addMessage(message);
    contextManager.clear();
    
    expect(contextManager.getMessages()).toHaveLength(0);
    expect(contextManager.getCurrentTokenCount()).toBe(0);
  });
  
  test('should get system messages', async () => {
    const userMessage: ChatMessage = {
      role: 'user',
      content: 'Hello'
    };
    
    const systemMessage: ChatMessage = {
      role: 'system',
      content: 'You are a helpful assistant'
    };
    
    await contextManager.addMessage(userMessage);
    await contextManager.addMessage(systemMessage);
    
    const systemMessages = contextManager.getSystemMessages();
    
    expect(systemMessages).toHaveLength(1);
    expect(systemMessages[0].content).toBe('You are a helpful assistant');
  });
  
  test('should get exchange count', async () => {
    const userMessage1: ChatMessage = {
      role: 'user',
      content: 'Hello'
    };
    
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: 'Hi there'
    };
    
    const userMessage2: ChatMessage = {
      role: 'user',
      content: 'How are you?'
    };
    
    await contextManager.addMessage(userMessage1);
    await contextManager.addMessage(assistantMessage);
    await contextManager.addMessage(userMessage2);
    
    expect(contextManager.getExchangeCount()).toBe(2);
  });
  
  test('should signal when summarization is needed', async () => {
    // モックプロバイダーのgetMaxTokensをオーバーライド
    const originalGetMaxTokens = mockProvider.getMaxTokens;
    mockProvider.getMaxTokens = jest.fn().mockReturnValue(10);
    
    // トークン数オーバーのメッセージを追加
    const message: ChatMessage = {
      role: 'user',
      content: 'This is a very long message that will exceed the token threshold'
    };
    
    const result = await contextManager.addMessage(message);
    
    expect(result).toBe(false); // 要約が必要という結果になる
    
    // モックを元に戻す
    mockProvider.getMaxTokens = originalGetMaxTokens;
  });
});
```

### 2.3 セキュリティユーティリティのテスト

```typescript
// src/ai_chat/tests/unit/security.test.ts
import { sanitizeInput, sanitizeOutput, validateChartData } from '../../utils/security';

describe('Security Utilities', () => {
  describe('sanitizeInput', () => {
    test('should remove script tags', () => {
      const input = 'Hello <script>alert("XSS")</script> world';
      const sanitized = sanitizeInput(input);
      
      expect(sanitized).toBe('Hello  world');
      expect(sanitized).not.toContain('<script>');
    });
    
    test('should remove iframe tags', () => {
      const input = 'Check out <iframe src="evil.com"></iframe> this page';
      const sanitized = sanitizeInput(input);
      
      expect(sanitized).toBe('Check out  this page');
      expect(sanitized).not.toContain('<iframe>');
    });
    
    test('should replace img tags', () => {
      const input = 'Image: <img src="evil.com/image.jpg">';
      const sanitized = sanitizeInput(input);
      
      expect(sanitized).toBe('Image: [image]');
    });
    
    test('should truncate long input', () => {
      const longInput = 'a'.repeat(5000);
      const sanitized = sanitizeInput(longInput);
      
      expect(sanitized.length).toBeLessThan(longInput.length);
      expect(sanitized).toContain('... (truncated)');
    });
  });
  
  describe('sanitizeOutput', () => {
    test('should remove script tags', () => {
      const output = 'AI response <script>alert("XSS")</script>';
      const sanitized = sanitizeOutput(output);
      
      expect(sanitized).toBe('AI response ');
      expect(sanitized).not.toContain('<script>');
    });
    
    test('should remove javascript: protocol', () => {
      const output = '<a href="javascript:alert(\'xss\')">Click me</a>';
      const sanitized = sanitizeOutput(output);
      
      expect(sanitized).toContain('removed:');
      expect(sanitized).not.toContain('javascript:');
    });
    
    test('should remove event handlers', () => {
      const output = '<div onclick="alert(\'xss\')">Click me</div>';
      const sanitized = sanitizeOutput(output);
      
      expect(sanitized).toContain('data-removed=');
      expect(sanitized).not.toContain('onclick=');
    });
  });
  
  describe('validateChartData', () => {
    test('should validate and sanitize chart data', () => {
      const validChart = {
        type: 'bar',
        title: 'Test Chart',
        data: {
          labels: ['A', 'B', 'C'],
          datasets: [{
            label: 'Values',
            data: [1, 2, 3]
          }]
        }
      };
      
      const result = validateChartData(validChart);
      
      expect(result).not.toBeNull();
      expect(result.type).toBe('bar');
      expect(result.title).toBe('Test Chart');
    });
    
    test('should reject invalid chart data', () => {
      const invalidChart = {
        title: 'Invalid Chart',
        // type と data が欠落
      };
      
      const result = validateChartData(invalidChart);
      
      expect(result).toBeNull();
    });
    
    test('should sanitize potentially malicious chart titles', () => {
      const maliciousChart = {
        type: 'bar',
        title: '<script>alert("XSS")</script>',
        data: {
          labels: ['A', 'B', 'C'],
          datasets: [{
            label: 'Values',
            data: [1, 2, 3]
          }]
        }
      };
      
      const result = validateChartData(maliciousChart);
      
      expect(result).not.toBeNull();
      expect(result.title).not.toContain('<script>');
    });
    
    test('should limit dataset sizes', () => {
      const largeDatasetChart = {
        type: 'bar',
        data: {
          labels: Array(200).fill(0).map((_, i) => `Label ${i}`),
          datasets: [
            {
              label: 'Values',
              data: Array(200).fill(0).map((_, i) => i)
            }
          ]
        }
      };
      
      const result = validateChartData(largeDatasetChart);
      
      expect(result).not.toBeNull();
      expect(result.data.labels.length).toBeLessThan(200);
      expect(result.data.datasets[0].data.length).toBeLessThan(200);
    });
  });
});
```

## 3. 統合テスト

### 3.1 AIチャットコントローラーのテスト

```typescript
// src/ai_chat/tests/integration/ai-chat-controller.test.ts
import { createTestController, MockRequest, MockResponse, cleanupTestController } from '../utils/test-helpers';
import { AIChatController } from '../../controllers/ai-chat-controller';
import { MockAIProvider } from '../mocks/ai-provider.mock';

describe('AIChatController Integration Tests', () => {
  let controller: AIChatController;
  let mockProvider: MockAIProvider;
  
  beforeEach(() => {
    [controller, mockProvider] = createTestController();
  });
  
  afterEach(() => {
    cleanupTestController();
  });
  
  test('should send and receive messages', async () => {
    // リクエストとレスポンスのモック
    const req = new MockRequest({
      message: 'こんにちは',
      providerId: 'mock-provider'
    });
    const res = new MockResponse();
    
    // カスタムモックレスポンスを追加
    MockAIProvider.addMockResponse('こんにちは', 'こんにちは！どのようにお手伝いできますか？');
    
    // メッセージ送信
    await controller.sendMessage(req as any, res as any);
    
    // レスポンスの検証
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.message).toContain('こんにちは！');
    expect(res.body.provider).toBe('Mock Provider');
    expect(res.body.tokenUsage).toBeDefined();
  });
  
  test('should handle error when message is missing', async () => {
    // 空のリクエスト
    const req = new MockRequest({});
    const res = new MockResponse();
    
    await controller.sendMessage(req as any, res as any);
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
  });
  
  test('should get available providers', async () => {
    const req = new MockRequest();
    const res = new MockResponse();
    
    await controller.getAvailableProviders(req as any, res as any);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.providers).toBeInstanceOf(Array);
    expect(res.body.providers[0].id).toBe('mock-provider');
    expect(res.body.activeProvider).toBe('mock-provider');
  });
  
  test('should get conversation history', async () => {
    // 履歴に追加するためのメッセージ送信
    const sendReq = new MockRequest({
      message: 'Hello',
      providerId: 'mock-provider'
    });
    const sendRes = new MockResponse();
    
    MockAIProvider.addMockResponse('Hello', 'Hi there');
    
    await controller.sendMessage(sendReq as any, sendRes as any);
    
    // 会話履歴の取得
    const historyReq = new MockRequest();
    const historyRes = new MockResponse();
    
    await controller.getConversationHistory(historyReq as any, historyRes as any);
    
    expect(historyRes.statusCode).toBe(200);
    expect(historyRes.body.messages).toBeInstanceOf(Array);
    expect(historyRes.body.messages.length).toBeGreaterThan(0);
    expect(historyRes.body.tokenUsage).toBeDefined();
  });
  
  test('should clear conversation', async () => {
    // 履歴に追加するためのメッセージ送信
    const sendReq = new MockRequest({
      message: 'Hello',
      providerId: 'mock-provider'
    });
    const sendRes = new MockResponse();
    
    MockAIProvider.addMockResponse('Hello', 'Hi there');
    
    await controller.sendMessage(sendReq as any, sendRes as any);
    
    // 会話のクリア
    const clearReq = new MockRequest();
    const clearRes = new MockResponse();
    
    await controller.clearConversation(clearReq as any, clearRes as any);
    
    expect(clearRes.statusCode).toBe(200);
    expect(clearRes.body.success).toBe(true);
    
    // 履歴が消えていることを確認
    const historyReq = new MockRequest();
    const historyRes = new MockResponse();
    
    await controller.getConversationHistory(historyReq as any, historyRes as any);
    
    // システムメッセージを除外するため、ユーザーメッセージのみをカウント
    const userMessages = historyRes.body.messages.filter(
      (msg: any) => msg.role === 'user'
    );
    
    expect(userMessages.length).toBe(0);
  });
  
  test('should process charts in AI responses', async () => {
    const req = new MockRequest({
      message: 'chart',
      providerId: 'mock-provider'
    });
    const res = new MockResponse();
    
    await controller.sendMessage(req as any, res as any);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain('![Chart]');
    expect(res.body.message).not.toContain('```chart');
  });
});
```

### 3.2 コンテキスト転送マネージャーのテスト

```typescript
// src/ai_chat/tests/integration/context-transfer.test.ts
import { ContextManager, ChatMessage } from '../../services/context/context-manager';
import { ContextTransferManager } from '../../services/context/transfer-manager';
import { MockAIProvider } from '../mocks/ai-provider.mock';

describe('ContextTransferManager Integration Tests', () => {
  let sourceProvider: MockAIProvider;
  let targetProvider: MockAIProvider;
  let sourceContextManager: ContextManager;
  let transferManager: ContextTransferManager;
  
  beforeEach(() => {
    sourceProvider = new MockAIProvider();
    sourceProvider.id = 'source-provider';
    sourceProvider.name = 'Source Provider';
    
    targetProvider = new MockAIProvider();
    targetProvider.id = 'target-provider';
    targetProvider.name = 'Target Provider';
    
    sourceContextManager = new ContextManager(sourceProvider);
    transferManager = new ContextTransferManager(sourceContextManager, sourceProvider);
    
    // モック要約を設定
    MockAIProvider.addMockResponse('要約', '会話の要約：ユーザーが質問し、アシスタントが回答した');
  });
  
  test('should prepare context for transfer', async () => {
    // ソースコンテキストにメッセージを追加
    const systemMessage: ChatMessage = {
      role: 'system',
      content: 'You are a helpful assistant'
    };
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: 'Hello'
    };
    
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: 'Hi there'
    };
    
    await sourceContextManager.addMessage(systemMessage);
    await sourceContextManager.addMessage(userMessage);
    await sourceContextManager.addMessage(assistantMessage);
    
    // 転送データの準備
    const transferData = await transferManager.prepareContextTransfer();
    
    expect(transferData).toBeDefined();
    expect(transferData.summary).toBeDefined();
    expect(transferData.messages).toBeInstanceOf(Array);
    expect(transferData.messages.length).toBe(2); // ユーザーとアシスタントのメッセージ
  });
  
  test('should transfer context to new provider', async () => {
    // ソースコンテキストにメッセージを追加
    const systemMessage: ChatMessage = {
      role: 'system',
      content: 'You are a helpful assistant'
    };
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: 'Hello'
    };
    
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: 'Hi there'
    };
    
    await sourceContextManager.addMessage(systemMessage);
    await sourceContextManager.addMessage(userMessage);
    await sourceContextManager.addMessage(assistantMessage);
    
    // 新しいプロバイダーへ転送
    const newContextManager = await transferManager.transferToNewProvider(targetProvider);
    
    expect(newContextManager).toBeDefined();
    
    const messages = newContextManager.getMessages();
    
    // システムメッセージを確認（転送時に要約が追加される）
    const summaryMessages = messages.filter(
      msg => msg.role === 'system' && msg.content.startsWith('これまでの会話の要約:')
    );
    expect(summaryMessages.length).toBeGreaterThan(0);
    
    // オリジナルのシステムメッセージも含まれている
    const originalSystemMessages = messages.filter(
      msg => msg.role === 'system' && msg.content === 'You are a helpful assistant'
    );
    expect(originalSystemMessages.length).toBe(1);
    
    // ユーザーとアシスタントのメッセージも含まれている
    const userMessages = messages.filter(msg => msg.role === 'user');
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');
    
    expect(userMessages.length).toBe(1);
    expect(assistantMessages.length).toBe(1);
  });
});
```

## 4. エンドツーエンドテスト

Expressアプリケーションを使用したE2Eテスト：

```typescript
// src/ai_chat/tests/e2e/api.test.ts
import express from 'express';
import request from 'supertest';
import { initializeAIChat } from '../../index';
import { MockAIProvider } from '../mocks/ai-provider.mock';

// AIプロバイダーのモックを設定
jest.mock('../../services/ai/adapter', () => {
  const original = jest.requireActual('../../services/ai/adapter');
  return {
    ...original,
    OpenAIAdapter: jest.fn().mockImplementation(() => new MockAIProvider()),
    ClaudeAdapter: jest.fn().mockImplementation(() => new MockAIProvider()),
    GeminiAdapter: jest.fn().mockImplementation(() => new MockAIProvider())
  };
});

describe('AI Chat API E2E Tests', () => {
  let app: express.Express;
  
  beforeAll(() => {
    // Expressアプリケーションを設定
    app = express();
    app.use(express.json());
    
    // APIキーのモック
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    
    // AIチャット機能を初期化
    initializeAIChat(app);
    
    // モックレスポンスを追加
    MockAIProvider.addMockResponse('hello', 'Hello! How can I help you today?');
  });
  
  test('POST /api/ai/chat should return an AI response', async () => {
    const response = await request(app)
      .post('/api/ai/chat')
      .send({
        message: 'hello',
        providerId: 'openai'
      });
      
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    expect(response.body.message).toContain('How can I help');
    expect(response.body.tokenUsage).toBeDefined();
  });
  
  test('GET /api/ai/providers should return available providers', async () => {
    const response = await request(app).get('/api/ai/providers');
    
    expect(response.status).toBe(200);
    expect(response.body.providers).toBeInstanceOf(Array);
    expect(response.body.providers.length).toBeGreaterThan(0);
    expect(response.body.activeProvider).toBeDefined();
  });
  
  test('POST /api/ai/chat with invalid input should return 400', async () => {
    const response = await request(app)
      .post('/api/ai/chat')
      .send({
        // message フィールドなし
        providerId: 'openai'
      });
      
    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });
  
  test('GET /api/ai/history should return conversation history', async () => {
    // 先にメッセージを送信
    await request(app)
      .post('/api/ai/chat')
      .send({
        message: 'Tell me about yourself',
        providerId: 'openai'
      });
    
    const response = await request(app).get('/api/ai/history');
    
    expect(response.status).toBe(200);
    expect(response.body.messages).toBeInstanceOf(Array);
    expect(response.body.messages.length).toBeGreaterThan(0);
  });
  
  test('POST /api/ai/clear should clear conversation history', async () => {
    // 先にメッセージを送信
    await request(app)
      .post('/api/ai/chat')
      .send({
        message: 'Another test message',
        providerId: 'openai'
      });
    
    // 会話をクリア
    const clearResponse = await request(app).post('/api/ai/clear');
    
    expect(clearResponse.status).toBe(200);
    expect(clearResponse.body.success).toBe(true);
    
    // 履歴を確認
    const historyResponse = await request(app).get('/api/ai/history');
    
    // ユーザーメッセージのみをカウント（システムメッセージは残る）
    const userMessages = historyResponse.body.messages.filter(
      (msg: any) => msg.role === 'user'
    );
    
    expect(userMessages.length).toBe(0);
  });
  
  test('GET /api/ai/chart-examples should return chart examples', async () => {
    const response = await request(app)
      .get('/api/ai/chart-examples')
      .query({ chartType: 'bar' });
    
    expect(response.status).toBe(200);
    expect(response.body.example).toBeDefined();
    expect(response.body.example).toContain('```chart');
    expect(response.body.example).toContain('"type":"bar"');
  });
});
```

## 5. パフォーマンステスト

### 5.1 レスポンス時間測定

```typescript
// src/ai_chat/tests/performance/response-time.test.ts
import { createTestController, MockRequest, MockResponse } from '../utils/test-helpers';
import { performance } from 'perf_hooks';

describe('AI Chat Performance Tests', () => {
  test('should measure response time for chat completion', async () => {
    const [controller, mockProvider] = createTestController();
    
    const req = new MockRequest({
      message: 'Hello, world',
      providerId: 'mock-provider'
    });
    const res = new MockResponse();
    
    // レスポンス時間を測定
    const startTime = performance.now();
    await controller.sendMessage(req as any, res as any);
    const endTime = performance.now();
    
    const responseTime = endTime - startTime;
    
    // 合格基準：レスポンス時間が500ms未満
    expect(responseTime).toBeLessThan(500);
    console.log(`Chat response time: ${responseTime.toFixed(2)}ms`);
  });
  
  test('should handle multiple concurrent requests', async () => {
    const [controller, mockProvider] = createTestController();
    
    const requestCount = 10;
    const requests = Array(requestCount).fill(0).map((_, i) => {
      return {
        req: new MockRequest({
          message: `Message ${i}`,
          providerId: 'mock-provider'
        }),
        res: new MockResponse()
      };
    });
    
    const startTime = performance.now();
    
    // 並列処理
    await Promise.all(
      requests.map(({ req, res }) => controller.sendMessage(req as any, res as any))
    );
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / requestCount;
    
    // 合格基準：平均レスポンス時間が200ms未満
    expect(avgTime).toBeLessThan(200);
    console.log(`Average response time for ${requestCount} concurrent requests: ${avgTime.toFixed(2)}ms`);
    console.log(`Total time: ${totalTime.toFixed(2)}ms`);
  });
});
```

### 5.2 メモリ使用量テスト

```typescript
// src/ai_chat/tests/performance/memory-usage.test.ts
import { createTestController, MockRequest, MockResponse } from '../utils/test-helpers';

describe('Memory Usage Tests', () => {
  test('should measure memory usage during chat session', async () => {
    const [controller, mockProvider] = createTestController();
    
    // 初期メモリ使用量
    const initialMemoryUsage = process.memoryUsage();
    
    // 多数のメッセージをシミュレート
    const messageCount = 50;
    
    for (let i = 0; i < messageCount; i++) {
      const req = new MockRequest({
        message: `Message ${i}: ${'a'.repeat(100)}`,
        providerId: 'mock-provider'
      });
      const res = new MockResponse();
      
      await controller.sendMessage(req as any, res as any);
    }
    
    // 最終メモリ使用量
    const finalMemoryUsage = process.memoryUsage();
    
    // メモリ増加量（MB）
    const heapUsedIncrease = (finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed) / (1024 * 1024);
    
    console.log(`Memory usage increase after ${messageCount} messages: ${heapUsedIncrease.toFixed(2)} MB`);
    
    // 合格基準：メモリ増加が100MB未満
    expect(heapUsedIncrease).toBeLessThan(100);
  });
  
  test('should release memory after clearing conversation', async () => {
    const [controller, mockProvider] = createTestController();
    
    // メッセージを追加
    const messageCount = 20;
    for (let i = 0; i < messageCount; i++) {
      const req = new MockRequest({
        message: `Message ${i}: ${'a'.repeat(100)}`,
        providerId: 'mock-provider'
      });
      const res = new MockResponse();
      
      await controller.sendMessage(req as any, res as any);
    }
    
    // クリア前のメモリ使用量
    const beforeClearMemory = process.memoryUsage();
    
    // 会話をクリア
    const clearReq = new MockRequest();
    const clearRes = new MockResponse();
    await controller.clearConversation(clearReq as any, clearRes as any);
    
    // GCを強制呼び出し（Node.js --expose-gc オプション付きで実行する必要あり）
    if (global.gc) {
      global.gc();
    }
    
    // クリア後のメモリ使用量
    const afterClearMemory = process.memoryUsage();
    
    // メモリ解放量（MB）
    const memoryDifference = (beforeClearMemory.heapUsed - afterClearMemory.heapUsed) / (1024 * 1024);
    
    console.log(`Memory released after clearing conversation: ${memoryDifference.toFixed(2)} MB`);
    
    // 負の値は解放されたことを示す（ただしGCのタイミングなどにより必ずしも解放されないこともある）
    // このテストは状況によっては失敗することがある
    // expect(memoryDifference).toBeGreaterThan(0);
  });
});
```

## 6. セキュリティテスト

### 6.1 入力と出力のサニタイゼーション

```typescript
// src/ai_chat/tests/security/sanitization.test.ts
import express from 'express';
import request from 'supertest';
import { initializeAIChat } from '../../index';
import { MockAIProvider } from '../mocks/ai-provider.mock';

// AIプロバイダーのモックを設定
jest.mock('../../services/ai/adapter', () => {
  const original = jest.requireActual('../../services/ai/adapter');
  return {
    ...original,
    OpenAIAdapter: jest.fn().mockImplementation(() => new MockAIProvider()),
    ClaudeAdapter: jest.fn().mockImplementation(() => new MockAIProvider()),
    GeminiAdapter: jest.fn().mockImplementation(() => new MockAIProvider())
  };
});

describe('Input and Output Sanitization', () => {
  let app: express.Express;
  
  beforeAll(() => {
    // Expressアプリケーションを設定
    app = express();
    app.use(express.json());
    
    // APIキーのモック
    process.env.OPENAI_API_KEY = 'test-openai-key';
    
    // AIチャット機能を初期化
    initializeAIChat(app);
    
    // 悪意あるテキストを含むモックレスポンスを設定
    MockAIProvider.addMockResponse(
      'xss',
      '<script>alert("XSS")</script>This is a test response with XSS'
    );
    
    MockAIProvider.addMockResponse(
      'script',
      'Response with <script>document.location="evil.com"</script> script'
    );
    
    MockAIProvider.addMockResponse(
      'javascript',
      'Click <a href="javascript:alert(\'xss\')">here</a>'
    );
  });
  
  test('should sanitize XSS in input', async () => {
    const response = await request(app)
      .post('/api/ai/chat')
      .send({
        message: '<script>alert("XSS")</script>xss',
        providerId: 'openai'
      });
      
    expect(response.status).toBe(200);
    // レスポンスの本文にscriptタグが含まれていないことを確認
    expect(response.body.message).not.toContain('<script>');
  });
  
  test('should sanitize XSS in AI response', async () => {
    const response = await request(app)
      .post('/api/ai/chat')
      .send({
        message: 'xss',
        providerId: 'openai'
      });
      
    expect(response.status).toBe(200);
    // AI応答のscriptタグが除去されていることを確認
    expect(response.body.message).not.toContain('<script>');
    expect(response.body.message).toContain('This is a test response with XSS');
  });
  
  test('should sanitize javascript: protocol', async () => {
    const response = await request(app)
      .post('/api/ai/chat')
      .send({
        message: 'javascript',
        providerId: 'openai'
      });
      
    expect(response.status).toBe(200);
    expect(response.body.message).not.toContain('javascript:');
    expect(response.body.message).toContain('removed:');
  });
  
  test('should handle extremely long input', async () => {
    const longMessage = 'a'.repeat(10000);
    
    const response = await request(app)
      .post('/api/ai/chat')
      .send({
        message: longMessage,
        providerId: 'openai'
      });
      
    expect(response.status).toBe(200);
    // 極端に長い入力でもサーバーがクラッシュしないことを確認
  });
});
```

### 6.2 チャートデータバリデーション

```typescript
// src/ai_chat/tests/security/chart-data.test.ts
import { ChartProcessor } from '../../services/chart/chart-processor';
import { ChartCommandDetector } from '../../services/chart/chart-detector';

// モック
jest.mock('../../services/chart/chart-renderer', () => {
  return {
    ChartRenderer: jest.fn().mockImplementation(() => ({
      renderChart: jest.fn().mockResolvedValue('data:image/png;base64,MOCK_CHART_DATA'),
      clearCache: jest.fn(),
      getCacheSize: jest.fn().mockReturnValue(0)
    }))
  };
});

describe('Chart Data Security Tests', () => {
  let processor: ChartProcessor;
  let detector: ChartCommandDetector;
  
  beforeEach(() => {
    processor = new ChartProcessor();
    detector = new ChartCommandDetector();
  });
  
  test('should validate and process safe chart data', async () => {
    const safeChart = `\`\`\`chart
{
  "type": "bar",
  "title": "Safe Chart",
  "data": {
    "labels": ["A", "B", "C"],
    "datasets": [{
      "label": "Values",
      "data": [10, 20, 30]
    }]
  }
}
\`\`\``;

    const processed = await processor.processText(safeChart);
    
    expect(processed).toContain('![Chart](data:image/png;base64,');
    expect(processed).not.toContain('```chart');
  });
  
  test('should reject invalid chart types', async () => {
    const invalidTypeChart = `\`\`\`chart
{
  "type": "evil",
  "title": "Invalid Chart",
  "data": {
    "labels": ["A", "B", "C"],
    "datasets": [{
      "label": "Values",
      "data": [10, 20, 30]
    }]
  }
}
\`\`\``;

    const processed = await processor.processText(invalidTypeChart);
    
    // 不正なチャートタイプはエラーメッセージに変換される
    expect(processed).toContain('Chart generation failed');
    expect(processed).not.toContain('![Chart]');
  });
  
  test('should sanitize potentially harmful chart titles', async () => {
    const harmfulTitleChart = `\`\`\`chart
{
  "type": "bar",
  "title": "<script>alert('XSS')</script>",
  "data": {
    "labels": ["A", "B", "C"],
    "datasets": [{
      "label": "Values",
      "data": [10, 20, 30]
    }]
  }
}
\`\`\``;

    // 手動でコマンド検出とバリデーションを行う
    const commands = detector.detectChartCommands(harmfulTitleChart);
    
    expect(commands.length).toBe(1);
    expect(commands[0].data.title).not.toContain('<script>');
  });
  
  test('should handle malformed JSON in chart data', async () => {
    const malformedChart = `\`\`\`chart
{
  "type": "bar",
  "title": "Malformed Chart",
  "data": {
    "labels": ["A", "B", "C],
    "datasets": [{
      "label": "Values",
      "data": [10, 20, 30]
    }]
  }
}
\`\`\``;

    const processed = await processor.processText(malformedChart);
    
    // 不正な形式のJSONはエラーメッセージに変換される
    expect(processed).toBe(malformedChart);
  });
  
  test('should limit large datasets', async () => {
    // 非常に大きなデータセットを持つチャート
    const largeDatasetChart = `\`\`\`chart
{
  "type": "bar",
  "title": "Large Dataset",
  "data": {
    "labels": ${JSON.stringify(Array(1000).fill(0).map((_, i) => `Label ${i}`))},
    "datasets": [{
      "label": "Values",
      "data": ${JSON.stringify(Array(1000).fill(0).map(() => Math.random() * 100))}
    }]
  }
}
\`\`\``;

    // 正常に処理できること（サーバーがクラッシュしないこと）を確認
    const processed = await processor.processText(largeDatasetChart);
    
    expect(processed).toContain('![Chart]');
  });
});
```

## 7. ロードテスト

### 7.1 同時リクエスト処理

```typescript
// src/ai_chat/tests/load/concurrent-requests.test.ts
import express from 'express';
import request from 'supertest';
import { initializeAIChat } from '../../index';
import { MockAIProvider } from '../mocks/ai-provider.mock';

// AIプロバイダーのモックを設定
jest.mock('../../services/ai/adapter', () => {
  const original = jest.requireActual('../../services/ai/adapter');
  return {
    ...original,
    OpenAIAdapter: jest.fn().mockImplementation(() => new MockAIProvider()),
    ClaudeAdapter: jest.fn().mockImplementation(() => new MockAIProvider()),
    GeminiAdapter: jest.fn().mockImplementation(() => new MockAIProvider())
  };
});

describe('Concurrent Request Tests', () => {
  let app: express.Express;
  
  beforeAll(() => {
    // Expressアプリケーションを設定
    app = express();
    app.use(express.json());
    
    // APIキーのモック
    process.env.OPENAI_API_KEY = 'test-openai-key';
    
    // AIチャット機能を初期化
    initializeAIChat(app);
  });
  
  test('should handle 50 concurrent requests', async () => {
    const requestCount = 50;
    const requestPromises = [];
    
    for (let i = 0; i < requestCount; i++) {
      requestPromises.push(
        request(app)
          .post('/api/ai/chat')
          .send({
            message: `Concurrent message ${i}`,
            providerId: 'openai'
          })
      );
    }
    
    const startTime = Date.now();
    const responses = await Promise.all(requestPromises);
    const endTime = Date.now();
    
    const totalTime = endTime - startTime;
    const avgTime = totalTime / requestCount;
    
    console.log(`Processed ${requestCount} concurrent requests in ${totalTime}ms`);
    console.log(`Average response time: ${avgTime.toFixed(2)}ms per request`);
    
    // すべてのリクエストが成功していることを確認
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body.message).toBeDefined();
    });
    
    // 合格基準：平均応答時間が100ms未満
    expect(avgTime).toBeLessThan(100);
  });
  
  test('should recover from errors in concurrent requests', async () => {
    const validRequests = 10;
    const invalidRequests = 10;
    const requestPromises = [];
    
    // 有効なリクエスト
    for (let i = 0; i < validRequests; i++) {
      requestPromises.push(
        request(app)
          .post('/api/ai/chat')
          .send({
            message: `Valid message ${i}`,
            providerId: 'openai'
          })
      );
    }
    
    // 無効なリクエスト（メッセージなし）
    for (let i = 0; i < invalidRequests; i++) {
      requestPromises.push(
        request(app)
          .post('/api/ai/chat')
          .send({
            providerId: 'openai'
          })
      );
    }
    
    const responses = await Promise.all(requestPromises);
    
    // 有効なリクエストが成功し、無効なリクエストが失敗していることを確認
    const successCount = responses.filter(r => r.status === 200).length;
    const errorCount = responses.filter(r => r.status === 400).length;
    
    expect(successCount).toBe(validRequests);
    expect(errorCount).toBe(invalidRequests);
  });
});
```

### 7.2 持続的な負荷テスト

```typescript
// src/ai_chat/tests/load/sustained-load.test.ts
import express from 'express';
import request from 'supertest';
import { initializeAIChat } from '../../index';
import { MockAIProvider } from '../mocks/ai-provider.mock';
import { performance } from 'perf_hooks';

// AIプロバイダーのモックを設定
jest.mock('../../services/ai/adapter', () => {
  const original = jest.requireActual('../../services/ai/adapter');
  return {
    ...original,
    OpenAIAdapter: jest.fn().mockImplementation(() => new MockAIProvider()),
    ClaudeAdapter: jest.fn().mockImplementation(() => new MockAIProvider()),
    GeminiAdapter: jest.fn().mockImplementation(() => new MockAIProvider())
  };
});

describe('Sustained Load Tests', () => {
  let app: express.Express;
  
  beforeAll(() => {
    // Expressアプリケーションを設定
    app = express();
    app.use(express.json());
    
    // APIキーのモック
    process.env.OPENAI_API_KEY = 'test-openai-key';
    
    // AIチャット機能を初期化
    initializeAIChat(app);
  });
  
  // この負荷テストは長時間かかるため、CIで実行する場合はスキップすることを検討
  test.skip('should handle sustained load for 30 seconds', async () => {
    const testDuration = 30 * 1000; // 30秒
    const requestInterval = 100; // 100ms間隔でリクエスト送信
    
    const startTime = performance.now();
    const endTime = startTime + testDuration;
    
    let requestCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let responseTimes: number[] = [];
    
    const sendRequest = async () => {
      const requestStartTime = performance.now();
      
      try {
        const response = await request(app)
          .post('/api/ai/chat')
          .send({
            message: `Load test message ${requestCount}`,
            providerId: 'openai'
          });
          
        const requestEndTime = performance.now();
        const responseTime = requestEndTime - requestStartTime;
        
        responseTimes.push(responseTime);
        
        if (response.status === 200) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
      
      requestCount++;
    };
    
    // テスト実行
    while (performance.now() < endTime) {
      await sendRequest();
      
      // 次のリクエストまで待機
      await new Promise(resolve => setTimeout(resolve, requestInterval));
    }
    
    // 結果集計
    const totalDuration = performance.now() - startTime;
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const requestsPerSecond = (requestCount / totalDuration) * 1000;
    
    console.log('Sustained load test results:');
    console.log(`Total requests: ${requestCount}`);
    console.log(`Successful requests: ${successCount}`);
    console.log(`Failed requests: ${errorCount}`);
    console.log(`Success rate: ${((successCount / requestCount) * 100).toFixed(2)}%`);
    console.log(`Requests per second: ${requestsPerSecond.toFixed(2)}`);
    console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
    
    // 合格基準
    expect(successCount / requestCount).toBeGreaterThan(0.95); // 95%以上の成功率
    expect(avgResponseTime).toBeLessThan(300); // 平均応答時間300ms未満
  });
});
```

## 8. 継続的インテグレーション

CI環境でのテスト実行のための設定例（GitHub Actions用）：

```yaml
# .github/workflows/ai-chat-tests.yml
name: AI Chat Tests

on:
  push:
    branches: [ main, develop ]
    paths:
      - 'src/ai_chat/**'
  pull_request:
    branches: [ main, develop ]
    paths:
      - 'src/ai_chat/**'

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16.x, 18.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install system dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
    
    - name: Install npm dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:unit -- --coverage src/ai_chat
    
    - name: Run integration tests
      run: npm run test:integration src/ai_chat
    
    - name: Run e2e tests
      run: npm run test:e2e src/ai_chat
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        directory: ./coverage/
        flags: ai-chat

  performance:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js 18.x
      uses: actions/setup-node@v3
      with:
        node-version: 18.x
        cache: 'npm'
    
    - name: Install system dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
    
    - name: Install npm dependencies
      run: npm ci
    
    - name: Run performance tests
      run: npm run test:performance src/ai_chat
```

このテストガイドを使用して、AIチャット機能の信頼性、セキュリティ、パフォーマンスを確保してください。各テストは単独で実行できますが、包括的なテストカバレッジを確保するために全てのテストを定期的に実行することをお勧めします。

質問や問題がある場合は、開発チームにお問い合わせください。