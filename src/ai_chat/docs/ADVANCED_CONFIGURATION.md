# Conea AIチャット機能：高度な設定ガイド

このドキュメントでは、Conea AIチャット機能の高度な設定とカスタマイズ方法について説明します。

## 目次

1. [APIキー設定と管理](#1-apiキー設定と管理)
2. [トークナイザーの設定](#2-トークナイザーの設定)
3. [チャートレンダリングのカスタマイズ](#3-チャートレンダリングのカスタマイズ)
4. [コンテキスト管理の調整](#4-コンテキスト管理の調整)
5. [セキュリティ設定](#5-セキュリティ設定)
6. [パフォーマンスチューニング](#6-パフォーマンスチューニング)
7. [国際化対応](#7-国際化対応)
8. [Docker環境での設定](#8-docker環境での設定)

## 1. APIキー設定と管理

### 1.1 APIキーのローテーション

セキュリティを高めるため、APIキーを定期的にローテーションすることをお勧めします。以下の方法で実装できます：

```typescript
// src/ai_chat/services/ai/key-manager.ts
export class APIKeyManager {
  private keys: Map<string, string[]> = new Map();
  private currentKeyIndex: Map<string, number> = new Map();
  
  constructor() {
    // 環境変数から複数のAPIキーを読み込む
    this.loadKeys('openai', process.env.OPENAI_API_KEYS?.split(',') || [process.env.OPENAI_API_KEY || '']);
    this.loadKeys('claude', process.env.ANTHROPIC_API_KEYS?.split(',') || [process.env.ANTHROPIC_API_KEY || '']);
    this.loadKeys('gemini', process.env.GEMINI_API_KEYS?.split(',') || [process.env.GEMINI_API_KEY || '']);
  }
  
  private loadKeys(provider: string, keys: string[]) {
    this.keys.set(provider, keys.filter(k => k.trim() !== ''));
    this.currentKeyIndex.set(provider, 0);
  }
  
  public getKey(provider: string): string {
    const keys = this.keys.get(provider) || [];
    if (keys.length === 0) {
      throw new Error(`No API keys available for ${provider}`);
    }
    
    const index = this.currentKeyIndex.get(provider) || 0;
    const key = keys[index];
    
    // 次のキーインデックスを設定（ローテーション）
    this.currentKeyIndex.set(provider, (index + 1) % keys.length);
    
    return key;
  }
}
```

### 1.2 APIキー使用状況のモニタリング

APIキーの使用状況をモニタリングするためのユーティリティを追加します：

```typescript
// src/ai_chat/utils/api-usage-monitor.ts
export class APIUsageMonitor {
  private usageMap: Map<string, { tokens: number, requests: number }> = new Map();
  
  public trackUsage(provider: string, tokens: number) {
    const current = this.usageMap.get(provider) || { tokens: 0, requests: 0 };
    this.usageMap.set(provider, {
      tokens: current.tokens + tokens,
      requests: current.requests + 1
    });
  }
  
  public getUsageReport(): Record<string, { tokens: number, requests: number }> {
    const report: Record<string, { tokens: number, requests: number }> = {};
    this.usageMap.forEach((value, key) => {
      report[key] = value;
    });
    return report;
  }
  
  public resetUsage() {
    this.usageMap.clear();
  }
}
```

## 2. トークナイザーの設定

### 2.1 TikTokenの詳細設定

OpenAIのトークナイザーをより詳細に設定する方法：

```typescript
// src/ai_chat/utils/tokenizers.ts
import { encoding_for_model, get_encoding } from 'tiktoken';

export async function countTokensForModel(text: string, model: string): Promise<number> {
  try {
    let encoder;
    
    // モデル名からエンコーダーを取得
    try {
      encoder = encoding_for_model(model);
    } catch (e) {
      // モデルが見つからない場合はデフォルトのエンコーダーを使用
      encoder = get_encoding('cl100k_base');
    }
    
    const tokens = encoder.encode(text);
    const count = tokens.length;
    
    encoder.free();
    return count;
  } catch (error) {
    console.warn('Failed to count tokens with tiktoken:', error);
    // フォールバック: 文字数ベースの近似
    return Math.ceil(text.length / 4);
  }
}
```

### 2.2 キャッシュによるトークン計算の最適化

頻繁に使用されるテキストのトークン数をキャッシュし、計算を効率化します：

```typescript
// src/ai_chat/utils/token-cache.ts
export class TokenCountCache {
  private cache: Map<string, number> = new Map();
  private readonly CACHE_SIZE_LIMIT = 1000;
  
  public async getTokenCount(
    text: string,
    countFn: (text: string) => Promise<number>
  ): Promise<number> {
    // テキストのハッシュを計算
    const key = this.hashText(text);
    
    // キャッシュにあればそれを返す
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    // なければ計算してキャッシュに保存
    const count = await countFn(text);
    
    // キャッシュサイズ制限チェック
    if (this.cache.size >= this.CACHE_SIZE_LIMIT) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, count);
    return count;
  }
  
  private hashText(text: string): string {
    // 単純なハッシュ関数（実際の実装ではより堅牢なものを使用）
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0; // 32bit整数に変換
    }
    return String(hash);
  }
  
  public clearCache(): void {
    this.cache.clear();
  }
}
```

## 3. チャートレンダリングのカスタマイズ

### 3.1 新しいチャートテーマの追加

チャートテーマをカスタマイズするための設定：

```typescript
// src/ai_chat/services/chart/chart-themes.ts
import { ChartConfiguration } from 'chart.js';

export interface ChartTheme {
  colors: string[];
  fontFamily: string;
  backgroundColor: string;
  gridColor: string;
  titleColor: string;
  legendTextColor: string;
}

export const themes: Record<string, ChartTheme> = {
  light: {
    colors: [
      'rgba(54, 162, 235, 0.7)',
      'rgba(255, 99, 132, 0.7)',
      'rgba(255, 206, 86, 0.7)',
      'rgba(75, 192, 192, 0.7)',
      'rgba(153, 102, 255, 0.7)',
      'rgba(255, 159, 64, 0.7)'
    ],
    fontFamily: 'Arial, sans-serif',
    backgroundColor: 'white',
    gridColor: 'rgba(0, 0, 0, 0.1)',
    titleColor: '#333',
    legendTextColor: '#666'
  },
  dark: {
    colors: [
      'rgba(54, 162, 235, 0.8)',
      'rgba(255, 99, 132, 0.8)',
      'rgba(255, 206, 86, 0.8)',
      'rgba(75, 192, 192, 0.8)',
      'rgba(153, 102, 255, 0.8)',
      'rgba(255, 159, 64, 0.8)'
    ],
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#333',
    gridColor: 'rgba(255, 255, 255, 0.1)',
    titleColor: '#fff',
    legendTextColor: '#ccc'
  },
  conea: {
    colors: [
      'rgba(0, 120, 212, 0.7)',
      'rgba(232, 17, 35, 0.7)',
      'rgba(14, 131, 136, 0.7)',
      'rgba(135, 100, 184, 0.7)',
      'rgba(0, 153, 93, 0.7)',
      'rgba(255, 140, 0, 0.7)'
    ],
    fontFamily: '"Noto Sans JP", "Segoe UI", sans-serif',
    backgroundColor: 'white',
    gridColor: 'rgba(0, 0, 0, 0.08)',
    titleColor: '#0078D4',
    legendTextColor: '#333'
  }
};

export function applyThemeToConfig(config: ChartConfiguration, themeName: string = 'conea'): ChartConfiguration {
  const theme = themes[themeName] || themes.conea;
  
  // カラーパレットの適用
  if (config.data.datasets) {
    config.data.datasets.forEach((dataset, index) => {
      const color = theme.colors[index % theme.colors.length];
      
      if (!dataset.backgroundColor) {
        dataset.backgroundColor = color;
      }
      
      if (!dataset.borderColor && config.type !== 'pie' && config.type !== 'doughnut') {
        dataset.borderColor = color.replace(/[^,]+(?=\))/, '1');
      }
    });
  }
  
  // フォントとカラーの適用
  if (!config.options) config.options = {};
  if (!config.options.plugins) config.options.plugins = {};
  if (!config.options.scales) config.options.scales = {};
  
  // タイトル設定
  if (!config.options.plugins.title) config.options.plugins.title = {};
  config.options.plugins.title.color = theme.titleColor;
  config.options.plugins.title.font = {
    ...config.options.plugins.title.font,
    family: theme.fontFamily
  };
  
  // 凡例設定
  if (!config.options.plugins.legend) config.options.plugins.legend = {};
  if (!config.options.plugins.legend.labels) config.options.plugins.legend.labels = {};
  config.options.plugins.legend.labels.color = theme.legendTextColor;
  config.options.plugins.legend.labels.font = {
    ...config.options.plugins.legend.labels.font,
    family: theme.fontFamily
  };
  
  // スケール設定
  if (!config.options.scales.x) config.options.scales.x = {};
  if (!config.options.scales.y) config.options.scales.y = {};
  
  config.options.scales.x.grid = {
    ...config.options.scales.x.grid,
    color: theme.gridColor
  };
  config.options.scales.y.grid = {
    ...config.options.scales.y.grid,
    color: theme.gridColor
  };
  
  return config;
}
```

### 3.2 アクセシビリティの向上

チャートのアクセシビリティを向上させる設定：

```typescript
// src/ai_chat/utils/chart-accessibility.ts
import { ChartConfiguration } from 'chart.js';

export function enhanceChartAccessibility(config: ChartConfiguration): ChartConfiguration {
  if (!config.options) config.options = {};
  if (!config.options.plugins) config.options.plugins = {};
  
  // フォントサイズの調整
  const fontSizeBase = 14;
  
  // タイトルのフォントサイズを大きくする
  if (!config.options.plugins.title) config.options.plugins.title = {};
  config.options.plugins.title.font = {
    ...config.options.plugins.title.font,
    size: fontSizeBase * 1.5
  };
  
  // 高コントラストモードパターンの追加
  if (config.data.datasets) {
    const patterns = [
      'line',
      'dash',
      'dot',
      'dashdot',
      'zigzag',
      'crosshatch'
    ];
    
    config.data.datasets.forEach((dataset, index) => {
      // パターンを交互に適用
      const pattern = patterns[index % patterns.length];
      
      // パターンの追加（Chart.js Pattern 対応）
      if (config.type !== 'line') {
        dataset.pattern = pattern;
      }
      
      // 点線や破線のスタイル（線グラフ用）
      if (config.type === 'line' && dataset.borderDash === undefined) {
        switch (pattern) {
          case 'dash':
            dataset.borderDash = [10, 5];
            break;
          case 'dot':
            dataset.borderDash = [2, 2];
            break;
          case 'dashdot':
            dataset.borderDash = [10, 5, 2, 5];
            break;
        }
      }
      
      // 点のサイズを大きくする
      if (dataset.pointRadius === undefined) {
        dataset.pointRadius = 5;
      }
      
      // 線の太さを太くする
      if (dataset.borderWidth === undefined && config.type === 'line') {
        dataset.borderWidth = 3;
      }
    });
  }
  
  return config;
}
```

## 4. コンテキスト管理の調整

### 4.1 カスタムコンテキスト管理ポリシー

コンテキスト管理をより詳細に制御するための設定：

```typescript
// src/ai_chat/services/context/context-policy.ts
import { ChatMessage } from './context-manager';

export interface ContextPolicy {
  tokenThreshold: number;
  maxUserMessages: number;
  summarizationInterval: number;
  maxSystemMessages: number;
  prioritizeRecentMessages: boolean;
}

export const DEFAULT_POLICY: ContextPolicy = {
  tokenThreshold: 0.8,      // 最大トークン数の80%で要約開始
  maxUserMessages: 50,      // 最大ユーザーメッセージ数
  summarizationInterval: 10, // 10ユーザーメッセージごとに要約
  maxSystemMessages: 5,     // 最大システムメッセージ数
  prioritizeRecentMessages: true // 最近のメッセージを優先
};

export class ContextPolicyManager {
  private policy: ContextPolicy;
  
  constructor(customPolicy?: Partial<ContextPolicy>) {
    this.policy = { ...DEFAULT_POLICY, ...customPolicy };
  }
  
  public shouldSummarize(
    currentTokenCount: number,
    maxTokens: number,
    messageCount: number
  ): boolean {
    // トークン数がしきい値を超える場合
    if (currentTokenCount > maxTokens * this.policy.tokenThreshold) {
      return true;
    }
    
    // メッセージ数が一定間隔を超える場合
    if (messageCount > 0 && messageCount % this.policy.summarizationInterval === 0) {
      return true;
    }
    
    // メッセージ数が上限を超える場合
    if (messageCount >= this.policy.maxUserMessages) {
      return true;
    }
    
    return false;
  }
  
  public filterSystemMessages(systemMessages: ChatMessage[]): ChatMessage[] {
    if (systemMessages.length <= this.policy.maxSystemMessages) {
      return systemMessages;
    }
    
    // 優先度の高いシステムメッセージのみを残す
    const summaryMessages = systemMessages
      .filter(msg => msg.content.startsWith('これまでの会話の要約:'));
    
    const initialMessages = systemMessages
      .filter(msg => !msg.content.startsWith('これまでの会話の要約:'));
    
    // 最新の要約を含める
    const latestSummary = summaryMessages.slice(-1);
    
    // 制限までの初期メッセージを含める
    const remainingLimit = this.policy.maxSystemMessages - latestSummary.length;
    const filteredInitial = initialMessages.slice(0, remainingLimit);
    
    return [...filteredInitial, ...latestSummary];
  }
  
  public getPolicy(): ContextPolicy {
    return this.policy;
  }
  
  public updatePolicy(updates: Partial<ContextPolicy>): void {
    this.policy = { ...this.policy, ...updates };
  }
}
```

### 4.2 会話のシリアライズと永続化

会話の保存と復元のための機能：

```typescript
// src/ai_chat/services/context/context-persistence.ts
import { ChatMessage } from './context-manager';
import { readFile, writeFile } from 'fs/promises';
import { createHash } from 'crypto';

export interface SerializedContext {
  id: string;
  messages: ChatMessage[];
  tokenCount: number;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

export class ContextPersistenceManager {
  private saveDirectory: string;
  
  constructor(saveDirectory: string = './conversation-history') {
    this.saveDirectory = saveDirectory;
  }
  
  public async saveContext(
    userId: string,
    messages: ChatMessage[],
    tokenCount: number,
    providerId: string
  ): Promise<string> {
    // 会話IDを生成
    const conversationId = this.generateConversationId(userId);
    
    const contextData: SerializedContext = {
      id: conversationId,
      messages,
      tokenCount,
      provider: providerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // ディレクトリが存在することを確認
    await this.ensureDirectoryExists();
    
    // ファイルに保存
    const filePath = `${this.saveDirectory}/${conversationId}.json`;
    await writeFile(filePath, JSON.stringify(contextData, null, 2), 'utf8');
    
    return conversationId;
  }
  
  public async loadContext(conversationId: string): Promise<SerializedContext> {
    const filePath = `${this.saveDirectory}/${conversationId}.json`;
    
    try {
      const fileContent = await readFile(filePath, 'utf8');
      return JSON.parse(fileContent) as SerializedContext;
    } catch (error) {
      throw new Error(`Failed to load conversation: ${error.message}`);
    }
  }
  
  public async updateContext(
    conversationId: string,
    messages: ChatMessage[],
    tokenCount: number
  ): Promise<void> {
    try {
      // 既存データを読み込み
      const context = await this.loadContext(conversationId);
      
      // データを更新
      context.messages = messages;
      context.tokenCount = tokenCount;
      context.updatedAt = new Date().toISOString();
      
      // 保存
      const filePath = `${this.saveDirectory}/${conversationId}.json`;
      await writeFile(filePath, JSON.stringify(context, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
  }
  
  private generateConversationId(userId: string): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const hash = createHash('sha256')
      .update(`${userId}-${timestamp}-${randomStr}`)
      .digest('hex')
      .substring(0, 12);
    
    return `conv-${hash}`;
  }
  
  private async ensureDirectoryExists(): Promise<void> {
    const fs = await import('fs/promises');
    try {
      await fs.access(this.saveDirectory);
    } catch (error) {
      // ディレクトリが存在しない場合は作成
      await fs.mkdir(this.saveDirectory, { recursive: true });
    }
  }
}
```

## 5. セキュリティ設定

### 5.1 コンテンツフィルタリング

不適切なコンテンツをフィルタリングする機能：

```typescript
// src/ai_chat/utils/content-filter.ts
export interface ContentFilterOptions {
  enableProfanityFilter: boolean;
  enablePIIFilter: boolean;
  strictMode: boolean;
}

export class ContentFilter {
  private options: ContentFilterOptions;
  
  // 簡易的な不適切単語リスト（実際の実装ではより包括的なリストや外部APIを使用）
  private profanityList: string[] = [
    // NGワードリスト
  ];
  
  // PII（個人を特定できる情報）の正規表現パターン
  private piiPatterns: Record<string, RegExp> = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(\+\d{1,3}[\s-])?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    creditCard: /\b(?:\d{4}[ -]?){3}\d{4}\b/g,
    // その他のPIIパターン
  };
  
  constructor(options: Partial<ContentFilterOptions> = {}) {
    this.options = {
      enableProfanityFilter: true,
      enablePIIFilter: true,
      strictMode: false,
      ...options
    };
  }
  
  public filterContent(text: string): string {
    let filtered = text;
    
    // 不適切な言葉のフィルタリング
    if (this.options.enableProfanityFilter) {
      filtered = this.filterProfanity(filtered);
    }
    
    // 個人情報のフィルタリング
    if (this.options.enablePIIFilter) {
      filtered = this.filterPII(filtered);
    }
    
    return filtered;
  }
  
  public detectSensitiveContent(text: string): {
    hasProfanity: boolean,
    hasPII: boolean,
    detectedPatterns: string[]
  } {
    const result = {
      hasProfanity: false,
      hasPII: false,
      detectedPatterns: []
    };
    
    // 不適切な言葉の検出
    if (this.options.enableProfanityFilter) {
      for (const word of this.profanityList) {
        if (new RegExp(`\\b${word}\\b`, 'i').test(text)) {
          result.hasProfanity = true;
          result.detectedPatterns.push('profanity');
          break;
        }
      }
    }
    
    // 個人情報の検出
    if (this.options.enablePIIFilter) {
      for (const [patternName, pattern] of Object.entries(this.piiPatterns)) {
        if (pattern.test(text)) {
          result.hasPII = true;
          result.detectedPatterns.push(patternName);
        }
      }
    }
    
    return result;
  }
  
  private filterProfanity(text: string): string {
    let result = text;
    
    for (const word of this.profanityList) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      result = result.replace(regex, '****');
    }
    
    return result;
  }
  
  private filterPII(text: string): string {
    let result = text;
    
    // 各PII正規表現に対して置換を実行
    for (const pattern of Object.values(this.piiPatterns)) {
      result = result.replace(pattern, '[REDACTED]');
    }
    
    return result;
  }
}
```

### 5.2 レート制限

APIリクエスト制限を実装：

```typescript
// src/ai_chat/utils/rate-limiter.ts
interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerDay: number;
}

interface RateLimitCounter {
  requestsTimestamp: number[];
  tokensUsed: number;
  tokensResetTimestamp: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitConfig> = new Map();
  private counters: Map<string, RateLimitCounter> = new Map();
  
  constructor() {
    // デフォルト制限を設定
    this.setLimit('default', { requestsPerMinute: 20, tokensPerDay: 100000 });
  }
  
  public setLimit(userId: string, config: RateLimitConfig): void {
    this.limits.set(userId, config);
  }
  
  public checkLimit(userId: string, tokenCount: number = 0): {
    allowed: boolean,
    reason?: string,
    resetIn?: number
  } {
    const limit = this.limits.get(userId) || this.limits.get('default')!;
    let counter = this.counters.get(userId);
    
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    // カウンターが存在しない場合は初期化
    if (!counter) {
      counter = {
        requestsTimestamp: [],
        tokensUsed: 0,
        tokensResetTimestamp: now + 24 * 60 * 60 * 1000 // 24時間後
      };
      this.counters.set(userId, counter);
    }
    
    // 古い時間のリクエスト記録を削除
    counter.requestsTimestamp = counter.requestsTimestamp.filter(t => t > oneMinuteAgo);
    
    // トークン使用量のリセット（24時間ごと）
    if (counter.tokensResetTimestamp < now) {
      counter.tokensUsed = 0;
      counter.tokensResetTimestamp = now + 24 * 60 * 60 * 1000;
    }
    
    // 分間リクエスト数のチェック
    if (counter.requestsTimestamp.length >= limit.requestsPerMinute) {
      const oldestRequest = Math.min(...counter.requestsTimestamp);
      const resetIn = 60 - Math.floor((now - oldestRequest) / 1000);
      
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        resetIn
      };
    }
    
    // 1日あたりのトークン使用量チェック
    if (counter.tokensUsed + tokenCount > limit.tokensPerDay) {
      const resetIn = Math.floor((counter.tokensResetTimestamp - now) / 1000);
      
      return {
        allowed: false,
        reason: 'token_limit_exceeded',
        resetIn
      };
    }
    
    // 制限をクリアしたので、カウンターを更新
    counter.requestsTimestamp.push(now);
    counter.tokensUsed += tokenCount;
    
    return { allowed: true };
  }
  
  public recordUsage(userId: string, tokenCount: number): void {
    let counter = this.counters.get(userId);
    if (!counter) {
      counter = {
        requestsTimestamp: [],
        tokensUsed: 0,
        tokensResetTimestamp: Date.now() + 24 * 60 * 60 * 1000
      };
      this.counters.set(userId, counter);
    }
    
    counter.tokensUsed += tokenCount;
  }
}
```

## 6. パフォーマンスチューニング

### 6.1 メモリ使用量の最適化

メモリ使用量を最適化するためのヘルパー関数：

```typescript
// src/ai_chat/utils/memory-optimizer.ts
import { ChartRenderer } from '../services/chart/chart-renderer';
import { TokenCountCache } from './token-cache';

export class MemoryOptimizer {
  private chartRenderer: ChartRenderer;
  private tokenCache: TokenCountCache;
  private lastOptimizationTime: number = 0;
  private readonly OPTIMIZATION_INTERVAL = 10 * 60 * 1000; // 10分間隔
  
  constructor(chartRenderer: ChartRenderer, tokenCache: TokenCountCache) {
    this.chartRenderer = chartRenderer;
    this.tokenCache = tokenCache;
  }
  
  public async optimize(): Promise<void> {
    const now = Date.now();
    
    // 前回の最適化から一定時間経っていない場合はスキップ
    if (now - this.lastOptimizationTime < this.OPTIMIZATION_INTERVAL) {
      return;
    }
    
    this.lastOptimizationTime = now;
    
    // チャートキャッシュをクリア
    this.chartRenderer.clearCache();
    
    // トークンカウントキャッシュをクリア
    this.tokenCache.clearCache();
    
    // 明示的にガベージコレクションを促す（Node.js環境の場合）
    if (global.gc) {
      try {
        global.gc();
      } catch (error) {
        console.warn('Failed to run garbage collection:', error);
      }
    }
    
    console.log('Memory optimization completed');
  }
  
  public getMemoryUsage(): { rss: number, heapTotal: number, heapUsed: number, external: number } {
    // Node.js環境の場合
    if (process && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        rss: usage.rss / (1024 * 1024),       // RSS（常駐セットサイズ）MB
        heapTotal: usage.heapTotal / (1024 * 1024), // ヒープ合計 MB
        heapUsed: usage.heapUsed / (1024 * 1024),  // ヒープ使用量 MB
        external: usage.external / (1024 * 1024)   // 外部 MB
      };
    }
    
    // 非Node.js環境の場合
    return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 };
  }
}
```

### 6.2 応答時間最適化

応答時間を最適化するためのストリーミング応答の実装例：

```typescript
// src/ai_chat/services/streaming/streaming-response.ts
import { Request, Response } from 'express';
import { AIProvider } from '../ai/adapter';

export class StreamingResponseManager {
  private provider: AIProvider;
  
  constructor(provider: AIProvider) {
    this.provider = provider;
  }
  
  public async streamResponse(req: Request, res: Response, prompt: string): Promise<void> {
    // SSE（Server-Sent Events）ヘッダーを設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      // 非同期的に応答を取得してクライアントにストリーミング
      const aiResponse = await this.provider.getCompletion(prompt, {
        stream: true,
        onChunk: (chunk) => {
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
          res.flush(); // 即時送信（利用可能な場合）
        }
      });
      
      // 使用量情報を送信
      res.write(`data: ${JSON.stringify({ 
        done: true, 
        usage: aiResponse.usage 
      })}\n\n`);
      
      res.end();
    } catch (error) {
      // エラーをストリーミングで送信
      res.write(`data: ${JSON.stringify({ 
        error: true, 
        message: error.message 
      })}\n\n`);
      
      res.end();
    }
  }
}
```

## 7. 国際化対応

### 7.1 多言語対応の設定

多言語要約とメッセージのサポート：

```typescript
// src/ai_chat/services/i18n/language-manager.ts
interface Translations {
  systemMessages: Record<string, string>;
  summaryPrompts: Record<string, string>;
  errors: Record<string, string>;
}

export class LanguageManager {
  private supportedLanguages = ['ja', 'en', 'zh', 'ko', 'fr', 'es', 'de'];
  private translations: Record<string, Translations> = {
    ja: {
      systemMessages: {
        welcome: 'Coneaへようこそ。どのようにお手伝いしましょうか？',
        contextReset: 'コンテキストをリセットしました。',
        providerSwitched: '{provider}に切り替えました。'
      },
      summaryPrompts: {
        generic: '以下の会話を簡潔に要約してください。重要なポイント、質問、結論を含めてください。',
        concise: '以下の会話を非常に簡潔に要約してください。会話の本質と主要なトピックのみを含めてください。'
      },
      errors: {
        apiKeyMissing: 'APIキーが設定されていません。',
        invalidProvider: '無効なプロバイダーIDです。',
        requestFailed: 'リクエストに失敗しました：{message}'
      }
    },
    en: {
      systemMessages: {
        welcome: 'Welcome to Conea. How can I help you today?',
        contextReset: 'Context has been reset.',
        providerSwitched: 'Switched to {provider}.'
      },
      summaryPrompts: {
        generic: 'Summarize the following conversation concisely. Include important points, questions, and conclusions.',
        concise: 'Provide a very brief summary of the following conversation. Include only the essence and main topics of the conversation.'
      },
      errors: {
        apiKeyMissing: 'API key is not configured.',
        invalidProvider: 'Invalid provider ID.',
        requestFailed: 'Request failed: {message}'
      }
    },
    // 他の言語...
  };
  
  // デフォルト言語
  private currentLanguage: string = 'ja';
  
  constructor(language?: string) {
    if (language && this.isLanguageSupported(language)) {
      this.currentLanguage = language;
    }
  }
  
  public setLanguage(language: string): boolean {
    if (this.isLanguageSupported(language)) {
      this.currentLanguage = language;
      return true;
    }
    return false;
  }
  
  public getTranslation(category: keyof Translations, key: string, params?: Record<string, string>): string {
    const lang = this.currentLanguage;
    const fallbackLang = 'en';
    
    let translation = this.translations[lang]?.[category]?.[key] 
      || this.translations[fallbackLang]?.[category]?.[key] 
      || `{${category}.${key}}`;
    
    // パラメータ置換
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        translation = translation.replace(`{${param}}`, value);
      });
    }
    
    return translation;
  }
  
  public getSupportedLanguages(): string[] {
    return [...this.supportedLanguages];
  }
  
  public getCurrentLanguage(): string {
    return this.currentLanguage;
  }
  
  public detectLanguage(text: string): string {
    // 実際の実装では言語検出ライブラリを使用
    // この例では簡易的な実装
    const jaCharRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;
    const zhCharRegex = /[\u4e00-\u9fff]/;
    const koCharRegex = /[\uac00-\ud7af]/;
    
    if (jaCharRegex.test(text)) return 'ja';
    if (zhCharRegex.test(text)) return 'zh';
    if (koCharRegex.test(text)) return 'ko';
    
    // デフォルトは英語
    return 'en';
  }
  
  private isLanguageSupported(language: string): boolean {
    return this.supportedLanguages.includes(language);
  }
}
```

## 8. Docker環境での設定

### 8.1 Docker環境での最適化

Docker環境での実行最適化のためのガイド：

```dockerfile
# Dockerfile.ai-chat
FROM node:18-slim

# 必要なシステムライブラリをインストール
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# アプリケーションディレクトリを作成
WORKDIR /app

# 依存関係ファイルをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# アプリケーションソースをコピー
COPY . .

# 環境変数を設定
ENV NODE_ENV=production
ENV PORT=3000

# メモリ最適化のための環境変数
ENV NODE_OPTIONS="--max-old-space-size=4096"

# TikTokenをインストール（Python版）
RUN pip3 install tiktoken

# サービスを実行するポートを公開
EXPOSE ${PORT}

# アプリケーションを起動
CMD ["node", "dist/server.js"]
```

Docker Composeの設定例：

```yaml
# docker-compose.ai-chat.yml
version: '3.8'

services:
  ai-chat:
    build:
      context: .
      dockerfile: Dockerfile.ai-chat
    image: conea/ai-chat:latest
    container_name: conea-ai-chat
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes:
      - ./logs:/app/logs
      - ./conversation-history:/app/conversation-history
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

---

## まとめ

このガイドでは、Conea AIチャット機能の高度な設定とカスタマイズ方法について説明しました。APIキーの管理、トークナイザーの設定、チャートのカスタマイズ、コンテキスト管理、セキュリティ、パフォーマンス最適化、国際化対応、Docker環境での設定など、様々な側面から機能を拡張する方法を紹介しています。

これらの設定とカスタマイズにより、特定のニーズに合わせてAIチャット機能を調整し、より堅牢で使いやすいシステムを構築することができます。

質問や問題がある場合は、開発チームにお問い合わせください。