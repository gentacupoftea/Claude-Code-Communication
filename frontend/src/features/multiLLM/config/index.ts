export const LLM_CONFIG = {
  // OpenAI API設定
  openai: {
    endpoint: process.env.REACT_APP_OPENAI_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
    apiKey: process.env.REACT_APP_OPENAI_API_KEY || '',
    models: {
      orchestrator: 'gpt-4-turbo-preview',
      analyzer: 'gpt-4-turbo-preview',
      visualizer: 'gpt-4-turbo-preview',
      planner: 'gpt-4-turbo-preview',
      general: 'gpt-3.5-turbo'
    }
  },
  
  // Claude API設定（将来の拡張用）
  anthropic: {
    endpoint: process.env.REACT_APP_ANTHROPIC_ENDPOINT || 'https://api.anthropic.com/v1/messages',
    apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY || '',
    models: {
      orchestrator: 'claude-3-opus-20240229',
      analyzer: 'claude-3-sonnet-20240229'
    }
  },
  
  // ローカルLLM設定（将来の拡張用）
  local: {
    endpoint: process.env.REACT_APP_LOCAL_LLM_ENDPOINT || 'http://localhost:11434/api/generate',
    models: {
      general: 'llama2'
    }
  },
  
  // デフォルト設定
  defaults: {
    provider: 'openai',
    maxRetries: 3,
    timeout: 30000,
    temperature: {
      orchestrator: 0.1,
      analyzer: 0.2,
      visualizer: 0.3,
      planner: 0.4,
      general: 0.7,
      aggregator: 0.3
    } as Record<string, number>
  }
};