// ルール定義の型
export interface Rule {
  id: string;
  name: string;
  description?: string;
  priority: number; // 1-100, 高いほど優先
  conditions: Condition[];
  actions: Action[];
  metadata?: RuleMetadata;
}

// 条件の型定義
export interface Condition {
  type: 'contains' | 'equals' | 'regex' | 'custom' | 'llm_evaluate';
  field: string;
  value: any;
  operator?: 'AND' | 'OR';
  llmPrompt?: string; // LLM評価用のプロンプト
}

// アクションの型定義
export interface Action {
  type: 'set' | 'append' | 'transform' | 'llm_generate' | 'trigger';
  target: string;
  value?: any;
  prompt?: string; // LLM生成用のプロンプト
  functionName?: string; // カスタム関数名
}

// ルールメタデータ
export interface RuleMetadata {
  version: string;
  author?: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  neuralWeight?: number; // 神経網型評価での重み
  learningRate?: number; // 自己学習の学習率
}

// ルールセット
export interface RuleSet {
  version: string;
  name: string;
  rules: Rule[];
  globalContext?: Record<string, any>;
  neuralConfig?: NeuralConfig;
}

// 神経網型設定
export interface NeuralConfig {
  parallelismLevel: number; // 並列実行レベル
  layerDepth: number; // 評価層の深さ
  activationThreshold: number; // 活性化閾値
  learningEnabled: boolean; // 自己学習の有効化
}

// 評価結果
export interface EvaluationResult {
  ruleId: string;
  matched: boolean;
  score: number; // 0-1の信頼度スコア
  executedActions: Action[];
  processingTime: number;
  neuralActivation?: number[]; // 神経網の活性化パターン
}