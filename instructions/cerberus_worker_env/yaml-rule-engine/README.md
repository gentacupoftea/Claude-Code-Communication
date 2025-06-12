# YAML Rule-Based LLM Decision Engine

革新的なYAMLルールベースLLM判断エンジン - Cerberus AI Platform

## 概要

このエンジンは、YAML形式で定義されたルールに基づいて、LLMを活用した高度な意思決定を行います。神経網型の並列評価、自己学習による最適化、予測的プリロードなどの革新的機能を搭載しています。

## 主要機能

### 1. YAMLルール定義システム
- 直感的なYAML形式でのルール記述
- 条件とアクションの柔軟な組み合わせ
- LLM評価とLLM生成アクションのサポート

### 2. LLMコンテキスト注入機構
- Claude、GPT-4などの複数LLMサポート
- セマンティックコンテキストの自動抽出
- プロンプトの事前コンパイルと最適化

### 3. 神経網型並列評価
- マルチスレッドによる高速並列処理
- 活性化パターンの学習と分析
- 層別パフォーマンスの追跡

### 4. 動的ルール更新
- APIによるリアルタイムルール更新
- バージョン管理とメタデータ追跡
- 自動的な神経網の再学習

### 5. AI駆動の異常検知
- パフォーマンス異常の自動検出
- 精度低下の早期発見
- 重要度別アラート生成

### 6. Grafanaダッシュボード統合
- LLM判断の可視化
- 神経網活性化パターンのヒートマップ
- システム進化速度の追跡
- 予測分析とトレンド表示

## クイックスタート

### インストール

```bash
cd yaml-rule-engine
npm install
```

### 環境設定

```bash
# .envファイルを作成
cat > .env << EOF
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
PORT=3456
EOF
```

### 起動

```bash
# 開発モード
npm run dev

# ビルド
npm run build

# プロダクション
node dist/index.js
```

## API エンドポイント

### ルール評価
```bash
POST /evaluate
Content-Type: application/json

{
  "request": {
    "path": "/admin/users",
    "headers": { "User-Agent": "..." }
  },
  "user": {
    "sessionData": { ... }
  }
}
```

### ルール更新
```bash
PUT /rules/:ruleId
Content-Type: application/json

{
  "priority": 85,
  "conditions": [ ... ]
}
```

### メトリクス取得
```bash
GET /metrics
# Prometheus形式のメトリクス

GET /grafana-data
# Grafanaダッシュボード用データ
```

## ルール定義例

```yaml
rules:
  - id: "security-check"
    name: "セキュリティチェック"
    priority: 100
    conditions:
      - type: "llm_evaluate"
        field: "request"
        llmPrompt: "このリクエストは安全ですか？"
    actions:
      - type: "llm_generate"
        target: "analysis"
        prompt: "セキュリティ分析を提供してください"
```

## Grafana設定

1. Prometheusデータソースを追加
2. `config/grafana-dashboard.json`をインポート
3. メトリクスURLを設定: `http://localhost:3456/metrics`

## アーキテクチャ

```
yaml-rule-engine/
├── src/
│   ├── core/
│   │   ├── rule-engine.ts        # メインエンジン
│   │   ├── llm-context-injector.ts # LLM統合
│   │   └── neural-evaluator.ts   # 神経網評価
│   ├── metrics/
│   │   └── metrics-collector.ts  # メトリクス収集
│   └── types/
│       └── rule.types.ts         # 型定義
├── config/
│   └── grafana-dashboard.json    # Grafana設定
└── examples/
    └── sample-rules.yaml         # サンプルルール
```

## パフォーマンス最適化

- 並列処理によるCPUコア数に応じたスケーリング
- LLMレスポンスのインテリジェントキャッシング
- 予測的ルールプリロードによる遅延削減
- 自己学習による継続的な最適化

## 統合例

```typescript
import { YAMLRuleEngine } from './yaml-rule-engine';

const engine = new YAMLRuleEngine();
await engine.loadRulesFromYAML(yamlContent);

// イベント駆動の統合
engine.on('anomalyDetected', (anomaly) => {
  // アラート送信など
});

// 評価実行
const results = await engine.evaluate(context);
```

## ライセンス

MIT License