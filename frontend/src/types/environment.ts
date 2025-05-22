/**
 * TypeScript type definitions for environment variable management
 */

export type EnvironmentVariableType = 'string' | 'number' | 'boolean' | 'json' | 'secret';

export interface EnvironmentVariable {
  id: string;
  category: string;
  key: string;
  value: any;
  value_type: EnvironmentVariableType;
  description?: string;
  is_editable: boolean;
  validation_regex?: string;
  options?: string[];
  created_at?: string;
  updated_at?: string;
  last_modified_by?: string;
}

export interface EnvironmentVariableCreate {
  category: string;
  key: string;
  value?: any;
  value_type?: EnvironmentVariableType;
  description?: string;
  is_editable?: boolean;
  validation_regex?: string;
  options?: string[];
}

export interface EnvironmentVariableUpdate {
  value: any;
  notes?: string;
}

export interface EnvironmentVariableHistory {
  id: string;
  variable_id: string;
  previous_value?: string;
  new_value?: string;
  changed_by: string;
  changed_at: string;
  notes?: string;
}

export interface EnvironmentVariableBulkUpdate {
  variables: Array<{
    category: string;
    key: string;
    value: any;
  }>;
  notes?: string;
}

export interface EnvironmentVariableTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  template_data: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  is_global: boolean;
}

export interface EnvironmentVariableCategoryInfo {
  category: string;
  count: number;
  description?: string;
  last_modified?: string;
}

export interface EnvironmentVariableValidationResult {
  is_valid: boolean;
  error_message?: string;
  suggested_value?: any;
}

export interface EnvironmentVariableExport {
  format: 'json' | 'yaml' | 'env';
  categories?: string[];
  include_secrets?: boolean;
}

export interface EnvironmentVariableImport {
  data: string | Record<string, any>;
  format: 'json' | 'yaml' | 'env';
  merge_strategy?: 'update' | 'replace' | 'skip';
  dry_run?: boolean;
}

export interface EnvironmentVariableImportResult {
  success: boolean;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  errors: string[];
  warnings: string[];
}

export interface EnvironmentVariableFormData {
  category: string;
  key: string;
  value: any;
  value_type: EnvironmentVariableType;
  description: string;
  is_editable: boolean;
  validation_regex: string;
  options: string[];
}

export interface EnvironmentVariableFilters {
  category?: string;
  search?: string;
  value_type?: EnvironmentVariableType;
}

export interface EnvironmentVariablePagination {
  limit: number;
  offset: number;
  total?: number;
}

// Component props interfaces
export interface EnvironmentVariableTableProps {
  variables: EnvironmentVariable[];
  loading?: boolean;
  onEdit: (variable: EnvironmentVariable) => void;
  onDelete: (variable: EnvironmentVariable) => void;
  onBulkUpdate?: (variables: EnvironmentVariable[]) => void;
}

export interface EnvironmentVariableEditorProps {
  variable?: EnvironmentVariable;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EnvironmentVariableFormData) => void;
  loading?: boolean;
}

export interface EnvironmentVariableHistoryProps {
  variableId?: string;
  category?: string;
  key?: string;
  isOpen: boolean;
  onClose: () => void;
}

export interface EnvironmentVariableImportExportProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'import' | 'export';
  onImport?: (config: EnvironmentVariableImport) => void;
  onExport?: (config: EnvironmentVariableExport) => void;
}

// API response interfaces
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface ApiError {
  detail: string;
  status_code: number;
}

// Form validation interfaces
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Category definitions
export const ENVIRONMENT_CATEGORIES = {
  api: {
    label: 'API設定',
    description: 'APIエンドポイントとリクエスト設定',
    icon: 'api'
  },
  auth: {
    label: '認証設定',
    description: 'JWT、パスワード、認証に関する設定',
    icon: 'shield'
  },
  features: {
    label: '機能フラグ',
    description: 'アプリケーション機能のオン/オフ設定',
    icon: 'flag'
  },
  system: {
    label: 'システム設定',
    description: 'ログレベル、メンテナンス、タイムアウト設定',
    icon: 'cog'
  },
  integrations: {
    label: '外部連携',
    description: 'Shopify、キャッシュ、外部API設定',
    icon: 'plug'
  },
  database: {
    label: 'データベース',
    description: 'データベース接続プール設定',
    icon: 'database'
  },
  security: {
    label: 'セキュリティ',
    description: 'CORS、CSRF、セキュリティ関連設定',
    icon: 'lock'
  }
} as const;

export type EnvironmentCategory = keyof typeof ENVIRONMENT_CATEGORIES;

// Value type definitions
export const VALUE_TYPE_OPTIONS = [
  { value: 'string', label: '文字列', description: 'テキスト値' },
  { value: 'number', label: '数値', description: '整数または小数' },
  { value: 'boolean', label: '真偽値', description: 'true または false' },
  { value: 'json', label: 'JSON', description: 'JSON オブジェクトまたは配列' },
  { value: 'secret', label: '機密情報', description: '暗号化されて保存される値' }
] as const;

// Export format options
export const EXPORT_FORMAT_OPTIONS = [
  { value: 'json', label: 'JSON', description: 'JSON形式でエクスポート' },
  { value: 'yaml', label: 'YAML', description: 'YAML形式でエクスポート' },
  { value: 'env', label: 'ENV', description: '環境変数ファイル形式' }
] as const;

// Merge strategy options
export const MERGE_STRATEGY_OPTIONS = [
  { value: 'update', label: '更新', description: '既存の値を更新' },
  { value: 'replace', label: '置換', description: '既存の値を完全に置換' },
  { value: 'skip', label: 'スキップ', description: '既存の値はそのまま' }
] as const;