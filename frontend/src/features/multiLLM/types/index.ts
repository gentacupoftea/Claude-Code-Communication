// Worker LLMの型定義
export interface WorkerLLM {
  id: string;
  name: string;
  type: 'analyzer' | 'visualizer' | 'planner' | 'general';
  capabilities: string[];
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMRequest {
  query: string;
  context?: any;
  dataSource?: DataSource;
  history?: ChatMessage[];
  tools?: Tool[];
}

export interface LLMResponse {
  workerId: string;
  content: string;
  data?: any;
  visualization?: any;
  thinking?: string[];
  confidence: number;
  toolCalls?: ToolCall[];
}

export interface DataSource {
  type: 'api' | 'csv' | 'database';
  endpoint?: string;
  data?: any;
  schema?: any;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: any;
}

export interface Tool {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any) => Promise<any>;
}

export interface ToolCall {
  toolName: string;
  parameters: any;
  result?: any;
}

export interface MultiLLMConfig {
  workers: WorkerLLM[];
  orchestrator: {
    model: string;
    temperature: number;
  };
  maxConcurrentWorkers: number;
  timeout: number;
}