# LLMサービス仕様

## 概要

Shopify MCPサーバーのLLM統合機能は、複数の最新LLMプロバイダーをサポートし、タスクに応じて最適なモデルを選択できます。

## サポートモデル（2025年5月現在）

### Anthropic Claude
- **Claude 4** (仮定) - 最新の推論能力
- **Claude 3.5 Sonnet** - 高速で高品質、日本語対応優秀
- **Claude 3 Opus** - 最高の推論能力、複雑なタスク向け
- **Claude 3 Sonnet** - バランス型
- **Claude 3 Haiku** - 高速・低コスト

### OpenAI GPT
- **GPT-4o (Omni)** - マルチモーダル対応、高速
- **GPT-4o mini** - 軽量版、高速処理
- **GPT-4 Turbo** - 高品質、長文対応
- **GPT-4 Vision** - 画像認識対応

### Google Gemini
- **Gemini 1.5 Pro** - 100万トークンコンテキスト
- **Gemini 1.5 Flash** - 高速処理
- **Gemini Ultra** - 最高性能（利用可能時）

## 主な機能

### 1. 商品管理
- **商品説明の自動生成**: SEO最適化された魅力的な説明文
- **カテゴリ分類**: 商品の自動カテゴライズ
- **タグ生成**: 関連タグの自動提案

### 2. カスタマーサポート
- **問い合わせ分類**: 自動カテゴリ分けと優先度判定
- **回答案生成**: 文脈に応じた返答の提案
- **レビュー要約**: 大量レビューからの洞察抽出

### 3. マーケティング
- **コピーライティング**: プラットフォーム別最適化
- **A/Bテスト案**: バリエーション生成
- **トレンドレポート**: データの自然言語化

### 4. SEO最適化
- **メタデータ生成**: title, description, OGタグ
- **構造化データ**: JSON-LD提案
- **キーワード最適化**: 自然な文章への組み込み

## 使用方法

```typescript
import { LLMService } from './ai/llm/LLMService';
import { ModelSelector } from './ai/llm/ModelSelector';

// 1. タスクに応じた最適モデルの選択
const recommendation = ModelSelector.recommendModel({
  type: 'generation',
  complexity: 'medium',
  contextLength: 'medium',
  speed: 'balanced',
  language: 'ja',
  budget: 'medium'
});

// 2. LLMサービスの初期化
const llm = new LLMService({
  provider: recommendation.provider,
  apiKey: process.env[`${recommendation.provider.toUpperCase()}_API_KEY`],
  model: recommendation.model,
  temperature: 0.7,
  maxTokens: 1000
});

// 3. 商品説明の生成
const description = await llm.generateProductDescription({
  title: 'オーガニックコットンTシャツ',
  category: 'アパレル',
  features: ['100%オーガニック', '日本製', 'ユニセックス'],
  targetAudience: '環境意識の高い20-40代',
  price: 5800
});
```

## コスト最適化

### モデル選択の指針

1. **高品質重視**
   - Claude 3 Opus / GPT-4 Turbo
   - 複雑な分析、重要な文書生成

2. **バランス型**
   - Claude 3.5 Sonnet / GPT-4o
   - 日常的なタスク、商品説明

3. **スピード重視**
   - Claude 3 Haiku / GPT-4o mini
   - 大量処理、リアルタイム応答

4. **超長文処理**
   - Gemini 1.5 Pro
   - 文書分析、大規模データ処理

### コスト目安（1000トークンあたり）

| モデル | 入力 | 出力 |
|--------|------|------|
| Claude 3.5 Sonnet | $0.003 | $0.015 |
| Claude 3 Opus | $0.015 | $0.075 |
| GPT-4o | $0.005 | $0.015 |
| Gemini 1.5 Pro | $0.00035 | $0.00105 |

## ベストプラクティス

1. **プロンプトエンジニアリング**
   - 明確な指示と期待する出力形式の指定
   - 例示を含める（Few-shot learning）
   - 制約条件の明示

2. **エラーハンドリング**
   - レート制限への対応
   - フォールバックモデルの設定
   - リトライロジック

3. **品質管理**
   - 出力の検証とフィルタリング
   - 人間によるレビュープロセス
   - A/Bテストによる継続的改善

4. **セキュリティ**
   - APIキーの安全な管理
   - PII（個人情報）のフィルタリング
   - 出力内容の適切性チェック

## 今後の拡張

1. **ファインチューニング**
   - ドメイン特化モデルの作成
   - 商品カタログでの追加学習

2. **マルチモーダル対応**
   - 商品画像からの説明生成
   - 動画コンテンツの分析

3. **リアルタイム対話**
   - チャットボット統合
   - 音声アシスタント対応

4. **多言語展開**
   - 自動翻訳と文化適応
   - グローバルマーケット対応