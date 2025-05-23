/**
 * Platform API Service
 * Handles platform connection and configuration
 */
import axios from 'axios';
import { API_BASE_URL } from './environment';

const API_URL = `${API_BASE_URL}/api/platforms`;

export interface PlatformCredentials {
  apiKey?: string;
  apiSecret?: string;
  storeUrl?: string;
  accessToken?: string;
  webhookUrl?: string;
}

export interface Platform {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastSync?: Date;
  lastError?: string;
  credentials?: PlatformCredentials;
  permissions?: string[];
  rateLimits?: {
    requestsPerMinute: number;
    currentUsage: number;
  };
}

class PlatformService {
  /**
   * Get all platforms
   */
  async getPlatforms(): Promise<Platform[]> {
    try {
      const response = await axios.get(API_URL);
      return response.data.map((platform: any) => ({
        ...platform,
        lastSync: platform.lastSync ? new Date(platform.lastSync) : undefined,
      }));
    } catch (error) {
      console.error('Failed to fetch platforms:', error);
      throw error;
    }
  }

  /**
   * Get a specific platform
   */
  async getPlatform(platformId: string): Promise<Platform> {
    try {
      const response = await axios.get(`${API_URL}/${platformId}`);
      return {
        ...response.data,
        lastSync: response.data.lastSync ? new Date(response.data.lastSync) : undefined,
      };
    } catch (error) {
      console.error('Failed to fetch platform:', error);
      throw error;
    }
  }

  /**
   * Test platform connection
   */
  async testConnection(platformId: string, credentials: PlatformCredentials): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await axios.post(`${API_URL}/${platformId}/test`, credentials);
      return response.data;
    } catch (error) {
      console.error('Failed to test connection:', error);
      throw error;
    }
  }

  /**
   * Connect to a platform
   */
  async connectPlatform(platformId: string, credentials: PlatformCredentials): Promise<Platform> {
    try {
      const response = await axios.post(`${API_URL}/${platformId}/connect`, credentials);
      return {
        ...response.data,
        lastSync: response.data.lastSync ? new Date(response.data.lastSync) : undefined,
      };
    } catch (error) {
      console.error('Failed to connect platform:', error);
      throw error;
    }
  }

  /**
   * Disconnect from a platform
   */
  async disconnectPlatform(platformId: string): Promise<void> {
    try {
      await axios.post(`${API_URL}/${platformId}/disconnect`);
    } catch (error) {
      console.error('Failed to disconnect platform:', error);
      throw error;
    }
  }

  /**
   * Update platform credentials
   */
  async updateCredentials(platformId: string, credentials: PlatformCredentials): Promise<Platform> {
    try {
      const response = await axios.put(`${API_URL}/${platformId}/credentials`, credentials);
      return {
        ...response.data,
        lastSync: response.data.lastSync ? new Date(response.data.lastSync) : undefined,
      };
    } catch (error) {
      console.error('Failed to update credentials:', error);
      throw error;
    }
  }

  /**
   * Sync platform data
   */
  async syncPlatform(platformId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await axios.post(`${API_URL}/${platformId}/sync`);
      return response.data;
    } catch (error) {
      console.error('Failed to sync platform:', error);
      throw error;
    }
  }

  /**
   * Get platform sync status
   */
  async getSyncStatus(platformId: string): Promise<{ status: string; progress?: number; message?: string }> {
    try {
      const response = await axios.get(`${API_URL}/${platformId}/sync/status`);
      return response.data;
    } catch (error) {
      console.error('Failed to get sync status:', error);
      throw error;
    }
  }

  /**
   * Get platform rate limits
   */
  async getRateLimits(platformId: string): Promise<{ requestsPerMinute: number; currentUsage: number; resetAt: Date }> {
    try {
      const response = await axios.get(`${API_URL}/${platformId}/rate-limits`);
      return {
        ...response.data,
        resetAt: new Date(response.data.resetAt),
      };
    } catch (error) {
      console.error('Failed to get rate limits:', error);
      throw error;
    }
  }

  /**
   * Validate Shopify credentials
   */
  validateShopifyCredentials(credentials: PlatformCredentials): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    
    if (!credentials.storeUrl) {
      errors.storeUrl = 'ストアURLは必須です';
    } else if (!credentials.storeUrl.endsWith('.myshopify.com')) {
      errors.storeUrl = '正しいShopifyストアURLを入力してください';
    }
    
    if (!credentials.apiKey) {
      errors.apiKey = 'APIキーは必須です';
    } else if (credentials.apiKey.length !== 32) {
      errors.apiKey = 'APIキーは32文字である必要があります';
    }
    
    if (!credentials.apiSecret) {
      errors.apiSecret = 'APIシークレットは必須です';
    }
    
    if (!credentials.accessToken) {
      errors.accessToken = 'アクセストークンは必須です';
    } else if (!credentials.accessToken.startsWith('shpat_')) {
      errors.accessToken = '正しいアクセストークンを入力してください';
    }
    
    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }
}

export const platformService = new PlatformService();