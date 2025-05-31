/**
 * Rakuten API Authentication Module
 * OAuth 2.0 implementation for Rakuten RMS API
 */

const axios = require('axios');
const crypto = require('crypto');
const { logger } = require('../../../utils/logger');
const { cache } = require('../../../utils/cache');

class RakutenAuth {
  constructor(config) {
    this.serviceSecret = config.serviceSecret;
    this.licenseKey = config.licenseKey;
    this.apiEndpoint = config.apiEndpoint || 'https://api.rms.rakuten.co.jp';
    this.tokenCache = cache.namespace('rakuten-tokens');
  }

  /**
   * Generate API authorization header
   * 楽天RMS APIの認証ヘッダーを生成
   */
  generateAuthHeader() {
    const timestamp = Date.now();
    const authString = `ESA ${this.serviceSecret}:${this.licenseKey}`;
    const base64Auth = Buffer.from(authString).toString('base64');
    
    return {
      'Authorization': base64Auth,
      'Content-Type': 'application/json;charset=UTF-8',
      'X-RMS-API-Timestamp': timestamp
    };
  }

  /**
   * OAuth 2.0 token acquisition
   * @param {string} code - Authorization code
   * @returns {Promise<Object>} Access token response
   */
  async getAccessToken(code) {
    const cacheKey = `access-token-${this.licenseKey}`;
    const cachedToken = await this.tokenCache.get(cacheKey);
    
    if (cachedToken && cachedToken.expires_at > Date.now()) {
      return cachedToken;
    }

    try {
      const response = await axios.post(
        `${this.apiEndpoint}/es/2.0/auth/token`,
        {
          grant_type: 'authorization_code',
          code,
          client_id: this.serviceSecret,
          client_secret: this.licenseKey
        },
        {
          headers: this.generateAuthHeader()
        }
      );

      const tokenData = {
        ...response.data,
        expires_at: Date.now() + (response.data.expires_in * 1000) - 60000 // 1分前に期限切れ
      };

      await this.tokenCache.set(cacheKey, tokenData, response.data.expires_in - 60);
      
      logger.info('Rakuten access token obtained successfully');
      return tokenData;
    } catch (error) {
      logger.error('Failed to obtain Rakuten access token', error);
      throw new Error(`Rakuten authentication failed: ${error.message}`);
    }
  }

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const response = await axios.post(
        `${this.apiEndpoint}/es/2.0/auth/refresh`,
        {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.serviceSecret,
          client_secret: this.licenseKey
        },
        {
          headers: this.generateAuthHeader()
        }
      );

      const tokenData = {
        ...response.data,
        expires_at: Date.now() + (response.data.expires_in * 1000) - 60000
      };

      const cacheKey = `access-token-${this.licenseKey}`;
      await this.tokenCache.set(cacheKey, tokenData, response.data.expires_in - 60);
      
      logger.info('Rakuten access token refreshed successfully');
      return tokenData;
    } catch (error) {
      logger.error('Failed to refresh Rakuten access token', error);
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Validate current authentication
   * @returns {Promise<boolean>} Authentication validity
   */
  async validateAuth() {
    const cacheKey = `access-token-${this.licenseKey}`;
    const token = await this.tokenCache.get(cacheKey);
    
    if (!token || token.expires_at <= Date.now()) {
      return false;
    }

    try {
      const response = await axios.get(
        `${this.apiEndpoint}/es/2.0/auth/validate`,
        {
          headers: {
            ...this.generateAuthHeader(),
            'X-RMS-API-Access-Token': token.access_token
          }
        }
      );
      
      return response.data.valid === true;
    } catch (error) {
      logger.error('Auth validation failed', error);
      return false;
    }
  }

  /**
   * Generate signature for API requests
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} params - Request parameters
   * @returns {string} Signature
   */
  generateSignature(method, path, params = {}) {
    const timestamp = Date.now();
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    const signatureBase = `${method.toUpperCase()}&${path}&${paramString}&${timestamp}`;
    const signature = crypto
      .createHmac('sha256', this.licenseKey)
      .update(signatureBase)
      .digest('base64');
    
    return signature;
  }
}

module.exports = RakutenAuth;
