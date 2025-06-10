/**
 * Backend API 連携サービス
 */

import { APISettings } from '@/src/types/api-settings';
import { Dashboard } from '@/src/types/widgets';

class BackendAPI {
  private baseURL: string;

  constructor() {
    // Next.jsのプロキシを使うため、空文字列に設定
    this.baseURL = '';
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Backend API Error (${endpoint}):`, error);
      throw error;
    }
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
    return this.request('/api/health');
  }

  /**
   * API設定を取得
   */
  async getAPISettings(): Promise<APISettings> {
    return this.request('/api/settings/apis');
  }

  /**
   * API設定を保存
   */
  async saveAPISettings(settings: APISettings): Promise<{ success: boolean; message: string }> {
    return this.request('/api/settings/apis', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  /**
   * ダッシュボード一覧を取得
   */
  async getDashboards(): Promise<Dashboard[]> {
    return this.request('/api/dashboards');
  }

  /**
   * ダッシュボードを保存
   */
  async saveDashboard(dashboard: Dashboard): Promise<{ success: boolean; dashboard: Dashboard }> {
    return this.request('/api/dashboards', {
      method: 'POST',
      body: JSON.stringify(dashboard),
    });
  }

  /**
   * 学習データ一覧を取得
   */
  async getLearningData(): Promise<any[]> {
    return this.request('/api/learning-data');
  }

  /**
   * 学習データをアップロード
   */
  async uploadLearningData(file: File): Promise<{ success: boolean; file: any }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          
          const result = await this.request<{ success: boolean; file: any }>('/api/learning-data/upload', {
            method: 'POST',
            body: JSON.stringify({
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              content: content
            }),
          });
          
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * API接続テスト
   */
  async testAPIConnection(apiType: 'amazon' | 'rakuten' | 'shopify' | 'nextengine'): Promise<boolean> {
    try {
      const response = await this.request<{ success: boolean; message: string }>(`/api/test-connection/${apiType}`);
      return response.success;
    } catch (error) {
      console.error(`API connection test failed for ${apiType}:`, error);
      return false;
    }
  }
}

// シングルトンインスタンス
export const backendAPI = new BackendAPI();

export default BackendAPI;