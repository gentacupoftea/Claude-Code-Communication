/**
 * MultiLLM Core API サービス
 */

export interface TaskExecutionRequest {
  taskType: 'text_generation' | 'translation' | 'summarization' | 'classification' | 'custom';
  input: string | any;
  model?: string;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    [key: string]: any;
  };
  options?: {
    timeout?: number;
    priority?: 'low' | 'normal' | 'high';
    [key: string]: any;
  };
}

export interface TaskExecutionResponse {
  taskId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  executionTime?: number;
  metadata?: {
    model: string;
    tokensUsed?: number;
    cost?: number;
  };
}

export interface WorkflowExecutionRequest {
  workflowId: string;
  inputs: Record<string, any>;
  options?: {
    parallel?: boolean;
    continueOnError?: boolean;
    timeout?: number;
  };
}

export interface WorkflowExecutionResponse {
  executionId: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  steps?: Array<{
    stepId: string;
    name: string;
    status: string;
    result?: any;
    error?: string;
  }>;
  outputs?: Record<string, any>;
  startedAt: string;
  completedAt?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  inputs: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
  outputs: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  steps: Array<{
    id: string;
    name: string;
    type: string;
    config: any;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerStatus {
  workerId: string;
  status: 'idle' | 'busy' | 'offline';
  currentTask?: string;
  tasksCompleted: number;
  uptime: number;
  resources: {
    cpu: number;
    memory: number;
    gpu?: number;
  };
}

export interface CSVAnalysisOptions {
  analysisType: 'statistical' | 'predictive' | 'exploratory' | 'all';
  includeVisualization?: boolean;
  targetColumn?: string;
  features?: string[];
  confidenceLevel?: number;
}

export interface CSVAnalysisResult {
  id: string;
  summary: {
    rows: number;
    columns: number;
    missingValues: number;
    dataTypes: Record<string, string>;
  };
  statistics?: Record<string, any>;
  insights?: string[];
  predictions?: any[];
  visualizations?: Array<{
    type: string;
    data: any;
    config: any;
  }>;
}

export interface MarketResearchRequest {
  topic: string;
  region?: string;
  timeframe?: string;
  competitors?: string[];
  dataPoints?: string[];
  depth?: 'basic' | 'detailed' | 'comprehensive';
}

export interface MarketResearchResult {
  id: string;
  topic: string;
  executiveSummary: string;
  marketSize: {
    current: number;
    projected: number;
    growthRate: number;
  };
  trends: string[];
  opportunities: string[];
  threats: string[];
  competitors?: Array<{
    name: string;
    marketShare: number;
    strengths: string[];
    weaknesses: string[];
  }>;
  recommendations: string[];
  sources: string[];
}

export interface CodeExecutionRequest {
  language: 'python' | 'javascript' | 'typescript' | 'java' | 'cpp' | 'go' | 'rust';
  code: string;
  input?: string;
  timeout?: number;
  memoryLimit?: number;
}

export interface CodeExecutionResult {
  id: string;
  status: 'success' | 'error' | 'timeout';
  output?: string;
  error?: string;
  executionTime: number;
  memoryUsed: number;
}

export interface ProviderStatus {
  openai: {
    enabled: boolean;
    configured: boolean;
    available: boolean;
    models: string[];
  };
  anthropic: {
    enabled: boolean;
    configured: boolean;
    available: boolean;
    models: string[];
  };
  google: {
    enabled: boolean;
    configured: boolean;
    available: boolean;
    models: string[];
  };
}

export interface ModelsResponse {
  models: string[];
  availableProviders: string[];
  providerStatus: ProviderStatus;
  providers: {
    openai: string[];
    anthropic: string[];
    google: string[];
  };
}

class MultiLLMAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_MULTILLM_API_URL || 'http://localhost:8000';
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * タスク実行
   */
  async executeTask(request: TaskExecutionRequest): Promise<TaskExecutionResponse> {
    return this.request('/api/v2/multillm/execute', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * ワークフロー実行
   */
  async executeWorkflow(request: WorkflowExecutionRequest): Promise<WorkflowExecutionResponse> {
    return this.request('/api/v2/multillm/workflow/execute', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * ワークフロー一覧取得
   */
  async getWorkflows(filters?: {
    category?: string;
    tags?: string[];
    search?: string;
  }): Promise<Workflow[]> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, Array.isArray(value) ? value.join(',') : value);
        }
      });
    }

    return this.request(`/api/v2/multillm/workflows${params.toString() ? `?${params}` : ''}`);
  }

  /**
   * ワーカー状態取得
   */
  async getWorkersStatus(): Promise<WorkerStatus[]> {
    return this.request('/api/v2/multillm/workers/status');
  }

  /**
   * CSV分析
   */
  async analyzeCSV(file: File, options?: CSVAnalysisOptions): Promise<CSVAnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (options) {
      formData.append('analysisOptions', JSON.stringify(options));
    }

    const response = await fetch(`${this.baseURL}/api/v2/multillm/analyze/csv`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`CSV Analysis failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 市場調査
   */
  async conductMarketResearch(request: MarketResearchRequest): Promise<MarketResearchResult> {
    return this.request('/api/v2/multillm/research/market', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * コード実行
   */
  async executeCode(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    return this.request('/api/v2/multillm/execute/code', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * 利用可能なモデル一覧とプロバイダー状態を取得
   */
  async getModelsAndProviders(): Promise<ModelsResponse> {
    return this.request('/api/models');
  }

  /**
   * プロバイダー状態のみを取得
   */
  async getProviderStatus(): Promise<{
    status: ProviderStatus;
    available: string[];
    models: string[];
  }> {
    return this.request('/api/providers/status');
  }

  /**
   * チャット（基本的なAPI）
   */
  async chat(messages: Array<{role: string; content: string}>, options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    system_prompt?: string;
  }): Promise<{
    id: string;
    model: string;
    message: string;
    choices: Array<{
      message: { role: string; content: string };
      finish_reason: string;
    }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }> {
    return this.request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages,
        ...options
      }),
    });
  }
}

// シングルトンインスタンス
export const multiLLMAPI = new MultiLLMAPI();

export default MultiLLMAPI;