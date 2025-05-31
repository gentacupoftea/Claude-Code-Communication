/**
 * Amazon Selling Partner API Authentication Module
 * SP-API認証実装
 */

const axios = require('axios');
const crypto = require('crypto');
const aws4 = require('aws4');
const { logger } = require('../../../utils/logger');
const { cache } = require('../../../utils/cache');

class AmazonAuth {
  constructor(config) {
    // SP-API認証設定
    this.refreshToken = config.refreshToken;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.roleArn = config.roleArn;
    this.marketplaceId = config.marketplaceId || 'A1VC38T7YXB528'; // JP marketplace
    
    // AWS設定
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.region = config.region || 'us-east-1';
    
    // エンドポイント設定
    this.endpoint = config.endpoint || 'https://sellingpartnerapi-fe.amazon.com';
    this.tokenEndpoint = 'https://api.amazon.com/auth/o2/token';
    
    // キャッシュ設定
    this.tokenCache = cache.namespace('amazon-tokens');
    this.roleSessionCache = cache.namespace('amazon-role-sessions');
  }

  /**
   * Get access token using refresh token
   * リフレッシュトークンを使用してアクセストークンを取得
   * @returns {Promise<Object>} Access token response
   */
  async getAccessToken() {
    const cacheKey = `access-token-${this.clientId}`;
    const cachedToken = await this.tokenCache.get(cacheKey);
    
    if (cachedToken && cachedToken.expires_at > Date.now()) {
      return cachedToken;
    }

    try {
      const response = await axios.post(this.tokenEndpoint, {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      const tokenData = {
        access_token: response.data.access_token,
        token_type: response.data.token_type,
        expires_in: response.data.expires_in,
        expires_at: Date.now() + (response.data.expires_in * 1000) - 60000 // 1分前に期限切れ
      };

      await this.tokenCache.set(cacheKey, tokenData, response.data.expires_in - 60);
      
      logger.info('Amazon access token obtained successfully');
      return tokenData;
    } catch (error) {
      logger.error('Failed to obtain Amazon access token', error);
      throw new Error(`Amazon authentication failed: ${error.message}`);
    }
  }

  /**
   * Assume IAM role for SP-API access
   * SP-APIアクセス用のIAMロールを引き受ける
   * @returns {Promise<Object>} Role credentials
   */
  async assumeRole() {
    const cacheKey = `role-session-${this.roleArn}`;
    const cachedSession = await this.roleSessionCache.get(cacheKey);
    
    if (cachedSession && cachedSession.Expiration > new Date()) {
      return cachedSession;
    }

    try {
      const sts = require('@aws-sdk/client-sts');
      const stsClient = new sts.STSClient({
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey
        }
      });

      const command = new sts.AssumeRoleCommand({
        RoleArn: this.roleArn,
        RoleSessionName: 'SP-API-Session',
        DurationSeconds: 3600
      });

      const response = await stsClient.send(command);
      const credentials = response.Credentials;

      await this.roleSessionCache.set(cacheKey, credentials, 3500); // 少し早めに期限切れ
      
      logger.info('Successfully assumed IAM role for SP-API');
      return credentials;
    } catch (error) {
      logger.error('Failed to assume IAM role', error);
      throw new Error(`Role assumption failed: ${error.message}`);
    }
  }

  /**
   * Generate AWS signature for API request
   * APIリクエスト用のAWS署名を生成
   * @param {Object} options - Request options
   * @returns {Object} Signed request headers
   */
  async generateSignature(options) {
    try {
      // Get role credentials
      const roleCredentials = await this.assumeRole();
      
      const request = {
        host: this.endpoint.replace('https://', '').replace(/\/.*/, ''),
        method: options.method,
        path: options.path,
        headers: {
          'x-amz-date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
          'x-amz-security-token': roleCredentials.SessionToken,
          'User-Agent': 'ShopifyMCPServer/1.0'
        }
      };

      // Add body if present
      if (options.body) {
        request.headers['Content-Type'] = 'application/json';
        request.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(options.body));
        request.body = JSON.stringify(options.body);
      }

      // Sign the request
      const signedRequest = aws4.sign(request, {
        accessKeyId: roleCredentials.AccessKeyId,
        secretAccessKey: roleCredentials.SecretAccessKey,
        sessionToken: roleCredentials.SessionToken
      });

      return signedRequest.headers;
    } catch (error) {
      logger.error('Failed to generate AWS signature', error);
      throw error;
    }
  }

  /**
   * Generate authorization header for SP-API
   * SP-API用の認証ヘッダーを生成
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Authorization headers
   */
  async generateAuthHeader(options = {}) {
    try {
      // Get access token
      const tokenData = await this.getAccessToken();
      
      // Get AWS signature
      const signedHeaders = await this.generateSignature(options);
      
      return {
        ...signedHeaders,
        'x-amz-access-token': tokenData.access_token,
        'x-amz-date': signedHeaders['x-amz-date'],
        'x-amz-security-token': signedHeaders['x-amz-security-token'],
        'Authorization': signedHeaders['Authorization'],
        'Content-Type': 'application/json;charset=UTF-8',
        'Accept': 'application/json'
      };
    } catch (error) {
      logger.error('Failed to generate auth header', error);
      throw error;
    }
  }

  /**
   * Validate current authentication
   * 現在の認証を検証
   * @returns {Promise<boolean>} Authentication validity
   */
  async validateAuth() {
    try {
      const tokenData = await this.getAccessToken();
      const roleCredentials = await this.assumeRole();
      
      return tokenData && roleCredentials && 
             tokenData.expires_at > Date.now() && 
             new Date(roleCredentials.Expiration) > new Date();
    } catch (error) {
      logger.error('Auth validation failed', error);
      return false;
    }
  }

  /**
   * Refresh all credentials
   * すべての認証情報を更新
   * @returns {Promise<void>}
   */
  async refreshCredentials() {
    try {
      // Clear caches
      await this.tokenCache.delete(`access-token-${this.clientId}`);
      await this.roleSessionCache.delete(`role-session-${this.roleArn}`);
      
      // Get new credentials
      await this.getAccessToken();
      await this.assumeRole();
      
      logger.info('All credentials refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh credentials', error);
      throw error;
    }
  }

  /**
   * Get marketplace information
   * マーケットプレイス情報を取得
   * @returns {Object} Marketplace information
   */
  getMarketplaceInfo() {
    const marketplaces = {
      'A1VC38T7YXB528': {
        name: 'Amazon.co.jp',
        country: 'JP',
        currency: 'JPY',
        language: 'ja_JP'
      },
      'ATVPDKIKX0DER': {
        name: 'Amazon.com',
        country: 'US',
        currency: 'USD',
        language: 'en_US'
      },
      'A1F83G8C2ARO7P': {
        name: 'Amazon.co.uk',
        country: 'UK',
        currency: 'GBP',
        language: 'en_GB'
      }
    };
    
    return marketplaces[this.marketplaceId] || marketplaces['A1VC38T7YXB528'];
  }
}

module.exports = AmazonAuth;