import { WorkerLLM, LLMRequest } from '../types';

export class PromptTemplates {
  static getOrchestratorPrompt(query: string, workers: WorkerLLM[]): string {
    const workerDescriptions = workers.map(w => 
      `- ${w.id}: ${w.name} (${w.type}) - Capabilities: ${w.capabilities.join(', ')}`
    ).join('\n');

    return `
あなたはMultiLLMシステムのオーケストレーターです。
ユーザーのクエリを分析し、最適なWorker LLMを選択してください。

## 利用可能なWorker LLM:
${workerDescriptions}

## ユーザークエリ:
${query}

## タスク:
1. クエリを分析し、必要な処理を特定
2. 最適なWorker LLMを1つ以上選択
3. 選択したWorker LLMのIDをJSON配列形式で返す

## 選択基準:
- クエリの内容とWorkerの能力の一致度
- 複数のWorkerが協調して作業する必要性
- データ分析が必要な場合は'analyzer'タイプを選択
- 可視化が必要な場合は'visualizer'タイプを選択

## 応答形式:
["worker-id-1", "worker-id-2"]
`;
  }

  static getWorkerPrompt(worker: WorkerLLM, request: LLMRequest): string {
    const basePrompt = `
あなたは${worker.name}という専門的なAIアシスタントです。
タイプ: ${worker.type}
能力: ${worker.capabilities.join(', ')}

## ユーザークエリ:
${request.query}
`;

    // Workerタイプに応じた専門的なプロンプトを追加
    switch (worker.type) {
      case 'analyzer':
        return basePrompt + `
## データ分析タスク:
1. 提供されたデータを詳細に分析
2. 主要な洞察とトレンドを特定
3. 統計的な観点から重要な発見を報告
4. 実用的な推奨事項を提供

## 出力形式:
{
  "analysis": "分析結果の詳細",
  "insights": ["洞察1", "洞察2"],
  "metrics": { "key": "value" },
  "recommendations": ["推奨1", "推奨2"]
}
`;

      case 'visualizer':
        return basePrompt + `
## 可視化タスク:
1. データを最も効果的に表現する可視化方法を選択
2. チャートタイプ、軸、凡例を適切に設定
3. インタラクティブ要素を考慮
4. アクセシビリティに配慮

## 出力形式:
{
  "chartType": "bar|line|pie|scatter|heatmap",
  "chartConfig": {
    "title": "チャートタイトル",
    "data": [],
    "options": {}
  },
  "description": "可視化の説明"
}
`;

      case 'planner':
        return basePrompt + `
## 計画策定タスク:
1. 目標を明確に定義
2. 実行可能なステップに分解
3. リソースとタイムラインを考慮
4. リスクと緩和策を特定

## 出力形式:
{
  "plan": {
    "goal": "目標",
    "steps": [
      {"step": 1, "action": "アクション", "duration": "期間"}
    ],
    "risks": ["リスク1", "リスク2"],
    "mitigation": ["対策1", "対策2"]
  }
}
`;

      default:
        return basePrompt + `
## 一般的なタスク:
質問に対して正確で有用な回答を提供してください。
必要に応じて、追加の質問や明確化を求めてください。
`;
    }
  }

  static getAggregatorPrompt(responses: any[]): string {
    return `
複数のAIアシスタントからの回答を統合し、包括的な最終回答を作成してください。

## 各アシスタントからの回答:
${JSON.stringify(responses, null, 2)}

## タスク:
1. 各回答の重要な要素を抽出
2. 矛盾する情報がある場合は調整
3. 統合された包括的な回答を作成
4. 可視化データがある場合は適切に組み込む

## 出力形式:
{
  "summary": "統合された要約",
  "details": {},
  "visualizations": [],
  "confidence": 0.0-1.0
}
`;
  }
}