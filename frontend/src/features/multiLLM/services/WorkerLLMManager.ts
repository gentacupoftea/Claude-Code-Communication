import { WorkerLLM, LLMRequest, LLMResponse, MultiLLMConfig } from '../types';
import { selectBestWorkers } from '../utils/workerSelector';
import { aggregateResponses } from '../utils/responseAggregator';
import { PromptTemplates } from '../utils/promptTemplates';
import { AggregatorLLMService } from './AggregatorLLMService';
import { LLMAPIService } from './LLMAPIService';
import { LLM_CONFIG } from '../config';

export class WorkerLLMManager {
  private config: MultiLLMConfig;
  private workers: Map<string, WorkerLLM>;
  private aggregatorService: AggregatorLLMService;
  private orchestratorAPIService: LLMAPIService;

  constructor(config: MultiLLMConfig) {
    this.config = config;
    this.workers = new Map(config.workers.map(w => [w.id, w]));
    this.aggregatorService = new AggregatorLLMService();
    this.orchestratorAPIService = new LLMAPIService({
      endpoint: LLM_CONFIG.openai.endpoint,
      apiKey: LLM_CONFIG.openai.apiKey,
      model: config.orchestrator.model,
      maxRetries: LLM_CONFIG.defaults.maxRetries
    });
  }

  async processRequest(request: LLMRequest): Promise<LLMResponse[]> {
    try {
      // 1. 最適なWorkerを選択
      const selectedWorkers = await this.selectWorkers(request);
      
      // 2. 各Workerに並列でリクエストを送信
      const workerResponses = await this.executeWorkers(selectedWorkers, request);
      
      // 3. Aggregator LLMを使用してレスポンスを統合
      const aggregationResult = await this.aggregatorService.aggregateResponses(
        request.query,
        workerResponses,
        selectedWorkers
      );
      
      // 4. 統合されたレスポンスを作成
      const aggregatedResponse: LLMResponse = {
        workerId: 'aggregated',
        content: aggregationResult.summary,
        data: aggregationResult.details,
        visualization: aggregationResult.visualizations,
        thinking: [
          `${aggregationResult.metadata.workersUsed.length}個のWorker LLMを使用`,
          `処理時間: ${aggregationResult.metadata.processingTime}ms`,
          ...aggregationResult.details.mainInsights
        ],
        confidence: aggregationResult.confidence,
        toolCalls: []
      };
      
      // 統合レスポンスを先頭に、個別のWorkerレスポンスを後に配置
      return [aggregatedResponse, ...workerResponses];
    } catch (error) {
      console.error('Error processing MultiLLM request:', error);
      throw error;
    }
  }

  private async selectWorkers(request: LLMRequest): Promise<WorkerLLM[]> {
    // オーケストレーターLLMを使用してWorkerを選択
    const orchestratorPrompt = PromptTemplates.getOrchestratorPrompt(
      request.query,
      Array.from(this.workers.values())
    );

    // TODO: 実際のLLM APIコール実装
    const selectedWorkerIds = await this.callOrchestratorLLM(orchestratorPrompt);
    
    return selectedWorkerIds.map(id => this.workers.get(id)!).filter(Boolean);
  }

  private async executeWorkers(
    workers: WorkerLLM[], 
    request: LLMRequest
  ): Promise<LLMResponse[]> {
    const promises = workers.map(worker => 
      this.executeWorker(worker, request)
    );

    // タイムアウト処理を追加
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Worker execution timeout')), this.config.timeout)
    );

    try {
      const results = await Promise.race([
        Promise.allSettled(promises),
        timeoutPromise
      ]) as PromiseSettledResult<LLMResponse>[];

      return results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<LLMResponse>).value);
    } catch (error) {
      console.error('Worker execution error:', error);
      throw error;
    }
  }

  private async executeWorker(
    worker: WorkerLLM, 
    request: LLMRequest
  ): Promise<LLMResponse> {
    const workerPrompt = PromptTemplates.getWorkerPrompt(worker, request);
    
    // TODO: 実際のLLM APIコール実装
    const response = await this.callWorkerLLM(worker, workerPrompt, request);
    
    return {
      workerId: worker.id,
      content: response.content,
      data: response.data,
      visualization: response.visualization,
      thinking: response.thinking,
      confidence: response.confidence || 0.8,
      toolCalls: response.toolCalls
    };
  }

  private async callOrchestratorLLM(prompt: string): Promise<string[]> {
    try {
      const response = await this.orchestratorAPIService.callLLM(prompt, {
        temperature: this.config.orchestrator.temperature,
        maxTokens: 1000
      });
      
      // レスポンスからWorker IDの配列を抽出
      const jsonMatch = response.match(/\[.*?\]/);
      if (jsonMatch) {
        const workerIds = JSON.parse(jsonMatch[0]);
        return workerIds.filter((id: any) => typeof id === 'string');
      }
      
      // フォールバック：キーワードベースの選択
      return selectBestWorkers(
        { query: prompt, tools: [] }, 
        Array.from(this.workers.values())
      ).map(w => w.id);
    } catch (error) {
      console.error('Orchestrator LLM error:', error);
      // エラー時はフォールバック
      return ['analyzer-1', 'general-1'];
    }
  }

  private async callWorkerLLM(
    worker: WorkerLLM, 
    prompt: string, 
    request: LLMRequest
  ): Promise<any> {
    try {
      // Worker用のAPIサービスを作成
      const workerAPIService = new LLMAPIService({
        endpoint: LLM_CONFIG.openai.endpoint,
        apiKey: LLM_CONFIG.openai.apiKey,
        model: worker.model,
        maxRetries: LLM_CONFIG.defaults.maxRetries
      });
      
      const response = await workerAPIService.callLLM(prompt, {
        temperature: worker.temperature || LLM_CONFIG.defaults.temperature[worker.type],
        maxTokens: worker.maxTokens || 1500
      });
      
      // レスポンスをパース
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedResponse = JSON.parse(jsonMatch[0]);
          return {
            content: parsedResponse.analysis || parsedResponse.summary || response,
            data: parsedResponse,
            thinking: parsedResponse.thinking || [`${worker.name}による分析を実行`],
            confidence: parsedResponse.confidence || 0.8
          };
        }
      } catch (parseError) {
        // JSONパース失敗時はプレーンテキストとして扱う
      }
      
      return {
        content: response,
        data: {},
        thinking: [`${worker.name}による処理を完了`],
        confidence: 0.7
      };
    } catch (error) {
      console.error(`Worker LLM error (${worker.id}):`, error);
      throw error;
    }
  }

}