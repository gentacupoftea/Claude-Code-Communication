/**
 * API client for environment variable management
 */
import {
  EnvironmentVariable,
  EnvironmentVariableCreate,
  EnvironmentVariableUpdate,
  EnvironmentVariableHistory,
  EnvironmentVariableBulkUpdate,
  EnvironmentVariableTemplate,
  EnvironmentVariableCategoryInfo,
  EnvironmentVariableValidationResult,
  EnvironmentVariableExport,
  EnvironmentVariableImport,
  EnvironmentVariableImportResult,
  ApiResponse,
} from '../types/environment';

// Base API URL with environment-specific configuration
const getApiUrl = (): string => {
  const env = process.env.NODE_ENV;
  const customEnv = process.env.REACT_APP_ENV;
  const apiUrl = process.env.REACT_APP_API_URL;
  
  if (apiUrl) {
    return apiUrl;
  }
  
  // Environment-specific defaults
  if (customEnv === 'staging') {
    return 'https://staging-api.conea.com';
  }
  
  switch (env) {
    case 'production':
      return 'https://api.conea.com';
    case 'development':
    default:
      return 'http://localhost:8000';
  }
};

const API_BASE_URL = getApiUrl();
const API_ENDPOINT = `${API_BASE_URL}/api/v1/environment`;

// Helper function to make authenticated API requests
async function makeApiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('access_token');
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_ENDPOINT}${url}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// Environment Variable API functions
export const environmentApi = {
  // Get categories
  async getCategories(): Promise<EnvironmentVariableCategoryInfo[]> {
    return makeApiRequest<EnvironmentVariableCategoryInfo[]>('/categories');
  },

  // Get all environment variables
  async getVariables(params?: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<EnvironmentVariable[]> {
    const searchParams = new URLSearchParams();
    
    if (params?.category) searchParams.append('category', params.category);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    
    const queryString = searchParams.toString();
    const url = queryString ? `/?${queryString}` : '/';
    
    return makeApiRequest<EnvironmentVariable[]>(url);
  },

  // Get variables by category
  async getVariablesByCategory(
    category: string,
    params?: {
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<EnvironmentVariable[]> {
    const searchParams = new URLSearchParams();
    
    if (params?.search) searchParams.append('search', params.search);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    
    const queryString = searchParams.toString();
    const url = queryString ? `/${category}?${queryString}` : `/${category}`;
    
    return makeApiRequest<EnvironmentVariable[]>(url);
  },

  // Get specific variable
  async getVariable(category: string, key: string): Promise<EnvironmentVariable> {
    return makeApiRequest<EnvironmentVariable>(`/${category}/${key}`);
  },

  // Create new variable
  async createVariable(data: EnvironmentVariableCreate): Promise<EnvironmentVariable> {
    return makeApiRequest<EnvironmentVariable>('/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update variable
  async updateVariable(
    category: string,
    key: string,
    data: EnvironmentVariableUpdate
  ): Promise<EnvironmentVariable> {
    return makeApiRequest<EnvironmentVariable>(`/${category}/${key}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete variable
  async deleteVariable(category: string, key: string): Promise<{ message: string }> {
    return makeApiRequest<{ message: string }>(`/${category}/${key}`, {
      method: 'DELETE',
    });
  },

  // Bulk update variables
  async bulkUpdateVariables(
    data: EnvironmentVariableBulkUpdate
  ): Promise<{
    success: number;
    errors: number;
    details: Array<{
      category: string;
      key: string;
      status: string;
      error?: string;
    }>;
  }> {
    return makeApiRequest('/bulk-update', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get variable history
  async getVariableHistory(params?: {
    category?: string;
    key?: string;
    limit?: number;
  }): Promise<EnvironmentVariableHistory[]> {
    const searchParams = new URLSearchParams();
    
    if (params?.category) searchParams.append('category', params.category);
    if (params?.key) searchParams.append('key', params.key);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const queryString = searchParams.toString();
    const url = queryString ? `/history/?${queryString}` : '/history/';
    
    return makeApiRequest<EnvironmentVariableHistory[]>(url);
  },

  // Validate variable
  async validateVariable(
    data: EnvironmentVariableCreate
  ): Promise<EnvironmentVariableValidationResult> {
    return makeApiRequest<EnvironmentVariableValidationResult>('/validate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Export variables
  async exportVariables(config: EnvironmentVariableExport): Promise<Blob> {
    const token = localStorage.getItem('access_token');
    
    const response = await fetch(`${API_ENDPOINT}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    
    return await response.blob();
  },

  // Import variables
  async importVariables(
    config: EnvironmentVariableImport
  ): Promise<EnvironmentVariableImportResult> {
    return makeApiRequest<EnvironmentVariableImportResult>('/import', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },
};

// Template API functions (if needed in the future)
export const templateApi = {
  // Get templates
  async getTemplates(): Promise<EnvironmentVariableTemplate[]> {
    return makeApiRequest<EnvironmentVariableTemplate[]>('/templates');
  },

  // Create template
  async createTemplate(data: Omit<EnvironmentVariableTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<EnvironmentVariableTemplate> {
    return makeApiRequest<EnvironmentVariableTemplate>('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Apply template
  async applyTemplate(templateId: string): Promise<{ message: string }> {
    return makeApiRequest<{ message: string }>(`/templates/${templateId}/apply`, {
      method: 'POST',
    });
  },
};

// Utility functions for working with environment variables
export const environmentUtils = {
  // Format value for display
  formatValue(variable: EnvironmentVariable): string {
    if (variable.value_type === 'secret') {
      return '••••••••';
    }
    
    if (variable.value_type === 'json' && typeof variable.value === 'object') {
      return JSON.stringify(variable.value, null, 2);
    }
    
    return String(variable.value ?? '');
  },

  // Parse value from string input
  parseValue(value: string, type: string): any {
    switch (type) {
      case 'number':
        const num = Number(value);
        return isNaN(num) ? value : num;
      
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1';
      
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      
      default:
        return value;
    }
  },

  // Validate value
  validateValue(value: any, variable: Partial<EnvironmentVariable>): { isValid: boolean; error?: string } {
    // Type validation
    switch (variable.value_type) {
      case 'number':
        if (isNaN(Number(value))) {
          return { isValid: false, error: '有効な数値を入力してください' };
        }
        break;
      
      case 'boolean':
        if (typeof value !== 'boolean' && !['true', 'false', '1', '0'].includes(String(value).toLowerCase())) {
          return { isValid: false, error: '真偽値を入力してください（true/false）' };
        }
        break;
      
      case 'json':
        if (typeof value === 'string') {
          try {
            JSON.parse(value);
          } catch {
            return { isValid: false, error: '有効なJSONを入力してください' };
          }
        }
        break;
    }

    // Regex validation
    if (variable.validation_regex && value) {
      try {
        const regex = new RegExp(variable.validation_regex);
        if (!regex.test(String(value))) {
          return { isValid: false, error: 'バリデーションパターンに一致しません' };
        }
      } catch {
        return { isValid: false, error: '無効なバリデーションパターンです' };
      }
    }

    // Options validation
    if (variable.options && variable.options.length > 0) {
      if (!variable.options.includes(String(value))) {
        return { isValid: false, error: `次のいずれかを選択してください: ${variable.options.join(', ')}` };
      }
    }

    return { isValid: true };
  },

  // Download exported data
  downloadExportedData(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Group variables by category
  groupByCategory(variables: EnvironmentVariable[]): Record<string, EnvironmentVariable[]> {
    return variables.reduce((groups, variable) => {
      const category = variable.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(variable);
      return groups;
    }, {} as Record<string, EnvironmentVariable[]>);
  },

  // Filter variables
  filterVariables(
    variables: EnvironmentVariable[],
    filters: {
      search?: string;
      category?: string;
      value_type?: string;
    }
  ): EnvironmentVariable[] {
    return variables.filter(variable => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          variable.key.toLowerCase().includes(searchLower) ||
          variable.description?.toLowerCase().includes(searchLower) ||
          variable.category.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Category filter
      if (filters.category && variable.category !== filters.category) {
        return false;
      }

      // Value type filter
      if (filters.value_type && variable.value_type !== filters.value_type) {
        return false;
      }

      return true;
    });
  },
};