const axios = require('axios');

const smaregiConfig = {
  baseUrl: process.env.SMAREGI_API_BASE_URL || 'https://api.smaregi.jp',
  contractId: process.env.SMAREGI_CONTRACT_ID,
  accessToken: process.env.SMAREGI_ACCESS_TOKEN,
  clientId: process.env.SMAREGI_CLIENT_ID,
  clientSecret: process.env.SMAREGI_CLIENT_SECRET,
  scopes: ['pos.transactions:read', 'pos.products:read', 'pos.stock:read'],
};

// スマレジAPIクライアントの作成
const smaregiClient = axios.create({
  baseURL: smaregiConfig.baseUrl,
  headers: {
    'Authorization': `Bearer ${smaregiConfig.accessToken}`,
    'Content-Type': 'application/json',
    'X-Contract-Id': smaregiConfig.contractId,
  },
  timeout: 30000,
});

// トークンリフレッシュのインターセプター
smaregiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshResponse = await axios.post(`${smaregiConfig.baseUrl}/token`, {
          grant_type: 'client_credentials',
          client_id: smaregiConfig.clientId,
          client_secret: smaregiConfig.clientSecret,
          scope: smaregiConfig.scopes.join(' '),
        });
        
        smaregiConfig.accessToken = refreshResponse.data.access_token;
        originalRequest.headers.Authorization = `Bearer ${smaregiConfig.accessToken}`;
        
        return smaregiClient(originalRequest);
      } catch (refreshError) {
        console.error('スマレジトークンリフレッシュエラー:', refreshError);
        throw refreshError;
      }
    }
    
    return Promise.reject(error);
  }
);

module.exports = {
  smaregiConfig,
  smaregiClient,
};