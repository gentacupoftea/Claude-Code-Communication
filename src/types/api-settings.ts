/**
 * API設定の型定義
 */

export interface AmazonAPISettings {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  marketplaceId: string;
  sellerId: string;
}

export interface RakutenAPISettings {
  applicationId: string;
  secret: string;
  serviceSecret: string;
  shopUrl: string;
}

export interface ShopifyAPISettings {
  shopDomain: string;
  accessToken: string;
  apiKey: string;
  apiSecret: string;
}

export interface NextEngineAPISettings {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  uid: string;
  accessToken: string;
}

export interface APISettings {
  amazon: AmazonAPISettings;
  rakuten: RakutenAPISettings;
  shopify: ShopifyAPISettings;
  nextengine: NextEngineAPISettings;
}

export const defaultAPISettings: APISettings = {
  amazon: {
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1',
    marketplaceId: '',
    sellerId: ''
  },
  rakuten: {
    applicationId: '',
    secret: '',
    serviceSecret: '',
    shopUrl: ''
  },
  shopify: {
    shopDomain: '',
    accessToken: '',
    apiKey: '',
    apiSecret: ''
  },
  nextengine: {
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    uid: '',
    accessToken: ''
  }
};