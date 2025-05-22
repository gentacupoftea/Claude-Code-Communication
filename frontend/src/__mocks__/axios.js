/**
 * axios テスト用モック
 * セキュリティ強化・テスト安定化のための専用実装
 */

const mockAxios = {
  create: jest.fn(() => mockAxios),
  
  // HTTP メソッド
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
  patch: jest.fn(() => Promise.resolve({ data: {} })),
  
  // レスポンス設定
  defaults: {
    baseURL: 'http://localhost:3000',
    headers: {
      'Content-Type': 'application/json'
    }
  },
  
  // インターセプター
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() }
  },
  
  // AI推薦API専用モック
  mockAIRecommendations: (recommendations = [], delay = 100) => {
    mockAxios.get.mockImplementation((url) => {
      if (url.includes('/ai/recommendations')) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ 
              data: { 
                recommendations,
                total: recommendations.length,
                timestamp: new Date().toISOString()
              }
            });
          }, delay);
        });
      }
      return Promise.resolve({ data: {} });
    });
  },
  
  // エラーシミュレーション
  mockNetworkError: () => {
    mockAxios.get.mockRejectedValue(new Error('Network Error'));
    mockAxios.post.mockRejectedValue(new Error('Network Error'));
  },
  
  // タイムアウトシミュレーション
  mockTimeout: () => {
    mockAxios.get.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout' });
  },
  
  // リセット機能
  resetMocks: () => {
    Object.keys(mockAxios).forEach(key => {
      if (mockAxios[key] && typeof mockAxios[key].mockReset === 'function') {
        mockAxios[key].mockReset();
      }
    });
  }
};

export default mockAxios;