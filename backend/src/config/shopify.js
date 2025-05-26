/**
 * Shopify API Configuration
 * 
 * 環境変数から設定を読み込み、正しいエンドポイントURLを構築
 */

const shopifyConfig = {
  // 店舗ドメイン（.myshopify.comは自動付与）
  storeDomain: process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_SHOP_NAME,
  
  // アクセストークン
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  
  // APIバージョン
  apiVersion: process.env.SHOPIFY_API_VERSION || '2024-01',
  
  // 完全なAPI URLを構築
  get apiUrl() {
    const domain = this.storeDomain.replace('.myshopify.com', '');
    return `https://${domain}.myshopify.com/admin/api/${this.apiVersion}`;
  },
  
  // URLビルダー関数
  buildUrl(endpoint) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const jsonEndpoint = cleanEndpoint.endsWith('.json') ? cleanEndpoint : `${cleanEndpoint}.json`;
    return `${this.apiUrl}/${jsonEndpoint}`;
  },
  
  // 設定検証
  validate() {
    const errors = [];
    
    if (!this.storeDomain) {
      errors.push('SHOPIFY_STORE_DOMAIN or SHOPIFY_SHOP_NAME is required');
    }
    
    if (!this.accessToken) {
      errors.push('SHOPIFY_ACCESS_TOKEN is required');
    }
    
    if (errors.length > 0) {
      throw new Error(`Shopify configuration errors: ${errors.join(', ')}`);
    }
    
    return true;
  }
};

module.exports = shopifyConfig;