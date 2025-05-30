import { LLMResponse } from '../types';

export function aggregateResponses(responses: LLMResponse[]): LLMResponse[] {
  if (responses.length === 0) return [];
  
  // 信頼度でソート
  const sortedResponses = responses.sort((a, b) => b.confidence - a.confidence);
  
  // 思考過程を統合
  const allThinking = responses.flatMap(r => r.thinking || []);
  
  // 可視化データを統合
  const allVisualizations = responses
    .filter(r => r.visualization)
    .map(r => r.visualization);
  
  // ツール呼び出しを統合
  const allToolCalls = responses.flatMap(r => r.toolCalls || []);
  
  // メインレスポンスを作成
  const mainResponse: LLMResponse = {
    workerId: 'aggregated',
    content: createAggregatedContent(responses),
    data: mergeData(responses),
    visualization: allVisualizations.length > 0 ? allVisualizations : undefined,
    thinking: allThinking,
    confidence: calculateAverageConfidence(responses),
    toolCalls: allToolCalls
  };
  
  // 個別のWorkerレスポンスも含める
  return [mainResponse, ...sortedResponses];
}

function createAggregatedContent(responses: LLMResponse[]): string {
  const contents = responses.map(r => r.content).filter(Boolean);
  
  if (contents.length === 1) return contents[0];
  
  // 複数の回答を統合
  let aggregated = '複数の分析結果を統合しました：\n\n';
  responses.forEach((response, index) => {
    aggregated += `### ${response.workerId}の分析:\n${response.content}\n\n`;
  });
  
  return aggregated;
}

function mergeData(responses: LLMResponse[]): any {
  const allData = responses
    .filter(r => r.data)
    .map(r => r.data);
  
  if (allData.length === 0) return {};
  if (allData.length === 1) return allData[0];
  
  // データをマージ
  return Object.assign({}, ...allData);
}

function calculateAverageConfidence(responses: LLMResponse[]): number {
  if (responses.length === 0) return 0;
  
  const sum = responses.reduce((acc, r) => acc + r.confidence, 0);
  return sum / responses.length;
}