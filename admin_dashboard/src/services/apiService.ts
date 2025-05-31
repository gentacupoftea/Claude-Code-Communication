/**
 * API Service - バックエンドAPI通信サービス
 */

// Configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

export interface APIKey {
  id: string;
  provider: 'claude' | 'openai' | 'gemini';
  name: string;
  key: string;
  status: 'active' | 'inactive' | 'error';
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
  monthlyCost: number;
  isEncrypted: boolean;
}

export interface SlackConfig {
  id: string;
  botToken: string;
  appToken: string;
  signingSecret: string;
  workspace: string;
  status: 'connected' | 'disconnected' | 'error';
  lastConnected?: string;
  channels: string[];
  features: {
    mentionCommands: boolean;
    slashCommands: boolean;
    directMessages: boolean;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  permissions: {
    claude: boolean;
    openai: boolean;
    gemini: boolean;
    billing: boolean;
  };
  createdAt: string;
}

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.token = localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Authentication
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const response = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    this.token = response.token;
    localStorage.setItem('auth_token', response.token);
    
    return response;
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  // API Keys Management
  async getAPIKeys(): Promise<APIKey[]> {
    return this.request<APIKey[]>('/api/keys');
  }

  async createAPIKey(data: Omit<APIKey, 'id' | 'createdAt' | 'usageCount' | 'monthlyCost' | 'isEncrypted'>): Promise<APIKey> {
    return this.request<APIKey>('/api/keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAPIKey(id: string, data: Partial<APIKey>): Promise<APIKey> {
    return this.request<APIKey>(`/api/keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAPIKey(id: string): Promise<void> {
    await this.request(`/api/keys/${id}`, { method: 'DELETE' });
  }

  async testAPIKey(id: string): Promise<{ success: boolean; message: string; responseTime?: number }> {
    return this.request<{ success: boolean; message: string; responseTime?: number }>(`/api/keys/${id}/test`, {
      method: 'POST',
    });
  }

  // Real AI API Key Management
  async updateAIAPIKey(provider: string, apiKey: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/ai/keys/${provider}`, {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    });
  }

  async testAIAPIKey(provider: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/ai/test/${provider}`, {
      method: 'GET',
    });
  }

  // Slack Configuration
  async getSlackConfig(): Promise<SlackConfig | null> {
    try {
      return await this.request<SlackConfig>('/api/slack/config');
    } catch (error) {
      return null;
    }
  }

  async saveSlackConfig(config: Omit<SlackConfig, 'id' | 'status' | 'lastConnected'>): Promise<SlackConfig> {
    console.log('🔧 ApiService.saveSlackConfig called with:', config);
    const result = await this.request<SlackConfig>('/api/slack/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    console.log('🔧 ApiService.saveSlackConfig result:', result);
    return result;
  }

  async updateSlackConfig(data: Partial<SlackConfig>): Promise<SlackConfig> {
    return this.request<SlackConfig>('/api/slack/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async testSlackConnection(): Promise<{ success: boolean; message: string; workspace?: string }> {
    return this.request<{ success: boolean; message: string; workspace?: string }>('/api/slack/test', {
      method: 'POST',
    });
  }

  async connectSlack(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/slack/connect', {
      method: 'POST',
    });
  }

  async disconnectSlack(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/slack/disconnect', {
      method: 'POST',
    });
  }

  // Users Management
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/api/users');
  }

  async createUser(data: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    return this.request<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    return this.request<User>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string): Promise<void> {
    await this.request(`/api/users/${id}`, { method: 'DELETE' });
  }

  // System Stats
  async getSystemStats(): Promise<any> {
    return this.request('/api/system/stats');
  }

  async getUsageStats(): Promise<any> {
    return this.request('/api/usage/stats');
  }

  // Projects
  async getProjects(): Promise<any[]> {
    return this.request('/api/projects');
  }

  async createProject(data: any): Promise<any> {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: any): Promise<any> {
    return this.request(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.request(`/api/projects/${id}`, { method: 'DELETE' });
  }
}

// Mock Data Service (開発用)
class MockApiService extends ApiService {
  private apiKeys: APIKey[] = [
    {
      id: '1',
      provider: 'claude',
      name: 'Claude Production',
      key: 'sk-ant-***masked***',
      status: 'active',
      createdAt: '2025-01-01T00:00:00Z',
      lastUsed: '2025-01-20T10:30:00Z',
      usageCount: 1250,
      monthlyCost: 45.67,
      isEncrypted: true,
    },
    {
      id: '2',
      provider: 'openai',
      name: 'OpenAI GPT-4',
      key: 'sk-***masked***',
      status: 'active',
      createdAt: '2025-01-01T00:00:00Z',
      lastUsed: '2025-01-20T09:15:00Z',
      usageCount: 890,
      monthlyCost: 32.18,
      isEncrypted: true,
    },
  ];

  private slackConfig: SlackConfig | null = {
    id: '1',
    botToken: 'xoxb-***masked***',
    appToken: 'xapp-***masked***',
    signingSecret: '***masked***',
    workspace: 'conea-dev',
    status: 'disconnected',
    channels: ['#conea-dev', '#general'],
    features: {
      mentionCommands: true,
      slashCommands: true,
      directMessages: false,
    },
  };

  private users: User[] = [
    {
      id: '1',
      name: 'Admin User',
      email: 'admin@conea.dev',
      role: 'admin',
      permissions: {
        claude: true,
        openai: true,
        gemini: true,
        billing: true,
      },
      createdAt: '2025-01-01T00:00:00Z',
    },
  ];

  async getAPIKeys(): Promise<APIKey[]> {
    return new Promise(resolve => {
      setTimeout(() => resolve([...this.apiKeys]), 500);
    });
  }

  async createAPIKey(data: Omit<APIKey, 'id' | 'createdAt' | 'usageCount' | 'monthlyCost' | 'isEncrypted'>): Promise<APIKey> {
    return new Promise(resolve => {
      setTimeout(() => {
        const newKey: APIKey = {
          ...data,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          usageCount: 0,
          monthlyCost: 0,
          isEncrypted: true,
        };
        this.apiKeys.push(newKey);
        resolve(newKey);
      }, 800);
    });
  }

  async updateAPIKey(id: string, data: Partial<APIKey>): Promise<APIKey> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = this.apiKeys.findIndex(key => key.id === id);
        if (index === -1) {
          reject(new Error('API Key not found'));
          return;
        }
        
        this.apiKeys[index] = { ...this.apiKeys[index], ...data };
        resolve(this.apiKeys[index]);
      }, 600);
    });
  }

  async deleteAPIKey(id: string): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        this.apiKeys = this.apiKeys.filter(key => key.id !== id);
        resolve();
      }, 400);
    });
  }

  async testAPIKey(id: string): Promise<{ success: boolean; message: string; responseTime?: number }> {
    return new Promise(resolve => {
      setTimeout(() => {
        const key = this.apiKeys.find(k => k.id === id);
        if (!key) {
          resolve({ success: false, message: 'API Key not found' });
          return;
        }

        const success = Math.random() > 0.2; // 80% success rate
        resolve({
          success,
          message: success ? 'Connection successful!' : 'Connection failed. Please check your API key.',
          responseTime: success ? Math.floor(Math.random() * 1000) + 200 : undefined,
        });
      }, 2000);
    });
  }

  async getSlackConfig(): Promise<SlackConfig | null> {
    return new Promise(resolve => {
      setTimeout(() => resolve(this.slackConfig), 300);
    });
  }

  async saveSlackConfig(config: Omit<SlackConfig, 'id' | 'status' | 'lastConnected'>): Promise<SlackConfig> {
    return new Promise(resolve => {
      setTimeout(() => {
        this.slackConfig = {
          ...config,
          id: this.slackConfig?.id || '1',
          status: 'disconnected',
        };
        resolve(this.slackConfig);
      }, 600);
    });
  }

  async testSlackConnection(): Promise<{ success: boolean; message: string; workspace?: string }> {
    return new Promise(resolve => {
      setTimeout(() => {
        const success = Math.random() > 0.3; // 70% success rate
        resolve({
          success,
          message: success ? 'Slack connection successful!' : 'Failed to connect to Slack. Please check your tokens.',
          workspace: success ? 'conea-dev' : undefined,
        });
      }, 2500);
    });
  }

  async connectSlack(): Promise<{ success: boolean; message: string }> {
    return new Promise(resolve => {
      setTimeout(() => {
        if (this.slackConfig) {
          this.slackConfig.status = 'connected';
          this.slackConfig.lastConnected = new Date().toISOString();
        }
        resolve({ success: true, message: 'Slack bot connected successfully!' });
      }, 1500);
    });
  }

  async disconnectSlack(): Promise<{ success: boolean; message: string }> {
    return new Promise(resolve => {
      setTimeout(() => {
        if (this.slackConfig) {
          this.slackConfig.status = 'disconnected';
        }
        resolve({ success: true, message: 'Slack bot disconnected.' });
      }, 800);
    });
  }

  async getUsers(): Promise<User[]> {
    return new Promise(resolve => {
      setTimeout(() => resolve([...this.users]), 400);
    });
  }

  async createUser(data: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    return new Promise(resolve => {
      setTimeout(() => {
        const newUser: User = {
          ...data,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
        };
        this.users.push(newUser);
        resolve(newUser);
      }, 700);
    });
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = this.users.findIndex(user => user.id === id);
        if (index === -1) {
          reject(new Error('User not found'));
          return;
        }
        
        this.users[index] = { ...this.users[index], ...data };
        resolve(this.users[index]);
      }, 600);
    });
  }

  async deleteUser(id: string): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        this.users = this.users.filter(user => user.id !== id);
        resolve();
      }, 400);
    });
  }
}

// 開発環境設定: REACT_APP_USE_REAL_API=true で実際のAPIを使用
const useRealAPI = process.env.REACT_APP_USE_REAL_API === 'true';
const isProduction = process.env.NODE_ENV === 'production';

// 強制的に実際のAPIを使用（バックエンド統合のため）
export const apiService = new ApiService();

export default apiService;