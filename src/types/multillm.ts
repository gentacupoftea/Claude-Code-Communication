export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  description?: string;
  maxTokens?: number;
  pricing?: {
    input: number;
    output: number;
  };
}