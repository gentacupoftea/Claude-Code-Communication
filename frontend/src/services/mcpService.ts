import axios from 'axios';

const MCP_API_URL = process.env.REACT_APP_MCP_API_URL || 'https://staging-conea-ai.web.app/api';

interface MCPConnection {
  url: string;
  status: 'connected' | 'disconnected' | 'error';
  lastChecked?: Date;
}

interface MCPSettings {
  apiKey?: string;
  webhookUrl?: string;
  proxyEnabled: boolean;
  debug: boolean;
}

export const mcpService = {
  /**
   * MCP接続状態を確認する
   */
  async checkConnection(): Promise<MCPConnection> {
    try {
      // 実際の実装ではAPIを呼び出す
      // const response = await axios.get(`${MCP_API_URL}/status`);
      // return response.data;
      
      // モックレスポンス
      return {
        url: MCP_API_URL,
        status: 'connected',
        lastChecked: new Date()
      };
    } catch (error) {
      console.error('MCP接続エラー:', error);
      return {
        url: MCP_API_URL,
        status: 'error'
      };
    }
  },

  /**
   * MCP設定を取得する
   */
  async getSettings(): Promise<MCPSettings> {
    try {
      // 実際の実装ではAPIを呼び出す
      // const response = await axios.get(`${MCP_API_URL}/settings`);
      // return response.data;
      
      // モックレスポンス
      return {
        apiKey: '••••••••••••••••',
        webhookUrl: 'https://webhook.conea.ai/inbound',
        proxyEnabled: true,
        debug: false
      };
    } catch (error) {
      console.error('MCP設定取得エラー:', error);
      throw error;
    }
  },

  /**
   * MCP設定を更新する
   */
  async updateSettings(settings: Partial<MCPSettings>): Promise<MCPSettings> {
    try {
      // 実際の実装ではAPIを呼び出す
      // const response = await axios.put(`${MCP_API_URL}/settings`, settings);
      // return response.data;
      
      // モックレスポンス
      return {
        apiKey: settings.apiKey || '••••••••••••••••',
        webhookUrl: settings.webhookUrl || 'https://webhook.conea.ai/inbound',
        proxyEnabled: settings.proxyEnabled !== undefined ? settings.proxyEnabled : true,
        debug: settings.debug !== undefined ? settings.debug : false
      };
    } catch (error) {
      console.error('MCP設定更新エラー:', error);
      throw error;
    }
  },

  /**
   * MCP接続を更新する
   */
  async refreshConnection(): Promise<MCPConnection> {
    try {
      // 実際の実装ではAPIを呼び出す
      // const response = await axios.post(`${MCP_API_URL}/refresh`);
      // return response.data;
      
      // モックレスポンス
      return {
        url: MCP_API_URL,
        status: 'connected',
        lastChecked: new Date()
      };
    } catch (error) {
      console.error('MCP接続更新エラー:', error);
      throw error;
    }
  }
};

export default mcpService;