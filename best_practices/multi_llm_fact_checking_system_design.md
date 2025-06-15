# Multi-LLMファクトチェックシステム 設計書 v2.0

## 1. 目的
本ドキュメントは、複数AI (Multi-LLM) を活用したファクトチェックシステムの設計思想とアーキテクチャを定義する。
主な目的は、CSVファイルなどに含まれる具体的なデータ（例：売上100万円）の真偽を、複数のAIの検証結果を統合することで、高い確度で判定する手法を確立することにある。

## 2. コア技術
本システムは、以下の3つのコア技術に基づいている。

### 2.1. 疑義の階層化 (Doubt Hierarchical Classification)
AIによる検証結果の不確実性を、単純な正誤ではなく、以下の4つの階層に分類して評価する。
- **計算的疑義 (COMPUTATIONAL)**: 数値計算に関するエラーの可能性。
- **論理的疑義 (LOGICAL)**: 推論過程における矛盾の可能性。
- **文脈的疑義 (CONTEXTUAL)**: 提供された文脈との不整合の可能性。
- **情報源疑義 (SOURCE)**: 参照した情報源の信頼性に関する問題。

```typescript
enum DoubtType {
  COMPUTATIONAL,
  LOGICAL,
  CONTEXTUAL,
  SOURCE
}
```

### 2.2. 証拠の三角測量 (Evidence Triangulation)
単一または複数のAIからの出力を、以下の3つの観点で立体的に分析し、結論の信頼性を高める。
- **主証拠 (primaryEvidence)**: 結論を直接支持する証拠。
- **補強証拠 (corroboratingEvidence)**: 結論を間接的に補強する証拠。
- **反対証拠 (contradictingEvidence)**: 結論と矛盾する証拠。

```typescript
interface EvidenceTriangulation {
  primaryEvidence: AIEvidencePoint[];
  corroboratingEvidence: AIEvidencePoint[];
  contradictingEvidence: AIEvidencePoint[];
  independentValidation: boolean; // 外部の独立した情報源による検証
}
```

### 2.3. 動的信頼度計算 (Dynamic Confidence Calculation)
固定的な閾値ではなく、証拠の質と量、文脈に応じて信頼度スコアを動的に算出する。
`最終スコア = (基本信頼度 × 重み付き平均) + 三角測量ボーナス - 疑義ペナルティ`

## 3. 信頼度レベル
検証結果の信頼度を7段階のレベルで定義し、判定結果に応じたアクションを定義する。

| レベル | スコア範囲 | 判定 | 推奨アクション |
|---|---|---|---|
| ABSOLUTE_CERTAINTY | 99.5-100% | 数学的確実性 | 自動承認 |
| CONVERGENT_CONSENSUS | 95-99% | 全AIで結果が収束 | 自動承認 |
| WEIGHTED_MAJORITY | 85-94% | 重み付き多数決で合意 | 軽微なレビューを推奨 |
| QUALIFIED_AGREEMENT | 70-84% | 条件付きで合意 | 標準的なレビューを推奨 |
| DISPUTED_TERRITORY | 50-69% | AI間で意見が分裂 | 詳細なレビューが必要 |
| INSUFFICIENT_DATA | 30-49% | 判断材料が不足 | 追加調査が必要 |
| HIGH_UNCERTAINTY | 0-29% | 高い不確実性 | 緊急レビューが必要 |

## 4. 主な機能

### 4.1. Multi-LLMクロスバリデーション
複数のLLMプロバイダー（例: Claude, GPT-4, Gemini）に同時に問い合わせ、結果を並列で検証する。
```typescript
const evidencePoints = await Promise.all([
  llmProvider.query('claude', prompt, context),
  llmProvider.query('gpt-4', prompt, context),
  llmProvider.query('gemini', prompt, context)
]);
```

### 4.2. ビジネスロジック統合検証
ドメイン固有のビジネスルールを検証プロセスに組み込む。
- 売上データが正の値であるか
- 前月比の成長率が妥当な範囲内か
- 業界のベンチマークと比較して異常値でないか
```typescript
const businessValidation = await this.validateBusinessLogic(csvData);
```

### 4.3. 人間によるレビュー要否判定
検証結果の信頼度に基づき、人間によるレビューが必要かどうかをインテリジェントに判断する。
- 緊急度を4段階で判定
- 確認すべき具体的な質問を自動生成
- レビュー担当者に適した専門家を推奨
- 推定レビュー時間を算出

## 5. ユースケース例

### 5.1. 正常な売上データの検証
- **入力**: 売上 `1,000,000円`, 前月売上 `950,000円`, 業種 `小売業`
- **結果**: 信頼度 `96%` (CONVERGENT_CONSENSUS)
- **アクション**: 自動承認

### 5.2. 異常な売上データの検証
- **入力**: 売上 `50,000,000円`, 前月売上 `800,000円`, 企業規模 `小規模`
- **結果**: 信頼度 `15%` (HIGH_UNCERTAINTY)
- **アクション**: 緊急レビュー
- **生成される質問**: "小規模小売業で月間5000万円の売上は業界平均を大幅に超えています。特別な要因（例：大型契約）はありましたか？"

## 6. アーキテクチャ上の特徴

### 6.1. メタ認知
AIが自身の判断プロセスと信頼性を自己評価する機能を備える。
```typescript
const metaCognition = await this.evaluateReasoningQuality(evidencePoints);
```

### 6.2. 継続的学習
検証結果をフィードバックとして学習し、検証モデルや閾値を自動で改善する。
```typescript
await this.learnFromVerification(verificationResult);
```

### 6.3. バイアス検出と緩和
複数のAIモデル間の回答傾向の偏り（バイアス）を検出し、その影響を緩和する。
```typescript
const biases = await this.identifyPotentialBiases(evidencePoints);
```

## 7. パフォーマンス目標

| 指標 | 目標値 |
|---|---|
| 精度 | 99.5%以上 |
| 平均検証時間 | 5秒未満 |
| 人間によるレビュー介入率 | 15%未満 |
| 誤検出率 | 0.5%未満 |

## 8. 実装上のベストプラクティス

- **段階的導入**: 低リスクなデータから適用を開始する。
- **閾値のチューニング**: 対象業務のリスク許容度に合わせて信頼度レベルの閾値を調整する。
- **専門家との連携**: ドメインエキスパートと協力し、ビジネスロジックを継続的に改善する。
- **パフォーマンス最適化**: バッチ処理、キャッシング、並列処理を適切に利用し、APIリソースを管理する。

## 9. 応用分野
- 財務データ監査
- 研究データの品質保証
- Eコマースの商品情報検証
- ニュースのファクトチェック
- 保険金の支払い査定