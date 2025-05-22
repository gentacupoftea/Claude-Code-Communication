/**
 * Google Search Console (GSC) 認証モジュール
 * OAuth 2.0とサービスアカウント認証をサポート
 * 
 * @module GSCAuth
 * @requires googleapis
 * @requires events
 * @requires fs
 * @requires path
 */

const { google } = require('googleapis');
const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../../utils/logger').child({ module: 'GSCAuth' });
const cache = require('../../../utils/cache');
const config = require('../../../config/settings');

/**
 * Google Search Console認証クラス
 * OAuth 2.0とサービスアカウント認証の両方をサポート
 * 
 * @class GSCAuth
 * @extends EventEmitter
 */
class GSCAuth extends EventEmitter {
  constructor() {
    super();
    this.oauth2Client = null;
    this.searchconsole = null;
    this.isAuthenticated = false;
    this.authType = null; // 'oauth2' or 'service_account'
    
    // OAuth 2.0設定
    this.CLIENT_ID = process.env.GSC_CLIENT_ID;
    this.CLIENT_SECRET = process.env.GSC_CLIENT_SECRET;
    this.REDIRECT_URI = process.env.GSC_REDIRECT_URI || 'http://localhost:3000/callback';
    
    // サービスアカウント設定
    this.SERVICE_ACCOUNT_PATH = process.env.GSC_SERVICE_ACCOUNT_PATH;
    
    // API設定
    this.SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];
    
    this.initializeAuth();
  }

  /**
   * 認証を初期化
   * @private
   */
  async initializeAuth() {
    try {
      logger.info('GSC認証を初期化しています...');
      
      // サービスアカウント認証を優先
      if (this.SERVICE_ACCOUNT_PATH) {
        await this.authenticateWithServiceAccount();
      } else if (this.CLIENT_ID && this.CLIENT_SECRET) {
        await this.authenticateWithOAuth2();
      } else {
        throw new Error('認証情報が設定されていません');
      }
      
      this.emit('authenticated', { authType: this.authType });
      logger.info('GSC認証が正常に完了しました', { authType: this.authType });
      
    } catch (error) {
      logger.error('GSC認証の初期化に失敗しました', { error });
      this.emit('authError', error);
      throw error;
    }
  }

  /**
   * サービスアカウントで認証
   * @private
   */
  async authenticateWithServiceAccount() {
    try {
      const keyFile = await fs.readFile(this.SERVICE_ACCOUNT_PATH, 'utf8');
      const key = JSON.parse(keyFile);
      
      const auth = new google.auth.JWT({
        email: key.client_email,
        key: key.private_key,
        scopes: this.SCOPES
      });
      
      await auth.authorize();
      
      this.oauth2Client = auth;
      this.searchconsole = google.searchconsole({ version: 'v1', auth });
      this.isAuthenticated = true;
      this.authType = 'service_account';
      
      logger.info('サービスアカウント認証が成功しました');
      
    } catch (error) {
      logger.error('サービスアカウント認証に失敗しました', { error });
      throw error;
    }
  }

  /**
   * OAuth 2.0で認証
   * @private
   */
  async authenticateWithOAuth2() {
    try {
      this.oauth2Client = new google.auth.OAuth2(
        this.CLIENT_ID,
        this.CLIENT_SECRET,
        this.REDIRECT_URI
      );
      
      // キャッシュからトークンを取得
      const cachedToken = await cache.get('gsc:oauth_token');
      
      if (cachedToken) {
        this.oauth2Client.setCredentials(JSON.parse(cachedToken));
        await this.refreshTokenIfNeeded();
      } else {
        // 新規認証フローが必要
        const authUrl = this.getAuthorizationUrl();
        logger.info('認証URLを生成しました', { authUrl });
        this.emit('authRequired', { authUrl });
        return;
      }
      
      this.searchconsole = google.searchconsole({ version: 'v1', auth: this.oauth2Client });
      this.isAuthenticated = true;
      this.authType = 'oauth2';
      
      logger.info('OAuth 2.0認証が成功しました');
      
    } catch (error) {
      logger.error('OAuth 2.0認証に失敗しました', { error });
      throw error;
    }
  }

  /**
   * 認証URLを生成
   * @returns {string} 認証URL
   */
  getAuthorizationUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      prompt: 'consent'
    });
  }

  /**
   * 認証コードからトークンを取得
   * @param {string} code - 認証コード
   */
  async getTokenFromCode(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      
      // トークンをキャッシュに保存
      await cache.set('gsc:oauth_token', JSON.stringify(tokens), 3600 * 24 * 7);
      
      this.searchconsole = google.searchconsole({ version: 'v1', auth: this.oauth2Client });
      this.isAuthenticated = true;
      this.authType = 'oauth2';
      
      logger.info('トークンの取得に成功しました');
      this.emit('tokenReceived', tokens);
      
      return tokens;
      
    } catch (error) {
      logger.error('トークンの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * トークンを更新
   * @private
   */
  async refreshTokenIfNeeded() {
    try {
      const currentToken = this.oauth2Client.credentials;
      
      if (!currentToken.expiry_date || Date.now() >= currentToken.expiry_date - 5 * 60 * 1000) {
        logger.info('トークンを更新しています...');
        
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        this.oauth2Client.setCredentials(credentials);
        
        // 更新されたトークンをキャッシュに保存
        await cache.set('gsc:oauth_token', JSON.stringify(credentials), 3600 * 24 * 7);
        
        logger.info('トークンの更新に成功しました');
        this.emit('tokenRefreshed', credentials);
      }
      
    } catch (error) {
      logger.error('トークンの更新に失敗しました', { error });
      throw error;
    }
  }

  /**
   * 認証状態を確認
   * @returns {boolean} 認証済みかどうか
   */
  isAuthValid() {
    return this.isAuthenticated && this.searchconsole !== null;
  }

  /**
   * Search Consoleクライアントを取得
   * @returns {object} Search Consoleクライアント
   */
  getClient() {
    if (!this.isAuthValid()) {
      throw new Error('認証が完了していません');
    }
    
    return this.searchconsole;
  }

  /**
   * 認証情報をリセット
   */
  async reset() {
    try {
      await cache.del('gsc:oauth_token');
      this.oauth2Client = null;
      this.searchconsole = null;
      this.isAuthenticated = false;
      this.authType = null;
      
      logger.info('認証情報をリセットしました');
      this.emit('reset');
      
    } catch (error) {
      logger.error('認証情報のリセットに失敗しました', { error });
      throw error;
    }
  }

  /**
   * 利用可能なサイトを取得
   * @returns {Array} サイトリスト
   */
  async getSites() {
    try {
      if (!this.isAuthValid()) {
        throw new Error('認証が完了していません');
      }
      
      const response = await this.searchconsole.sites.list();
      const sites = response.data.siteEntry || [];
      
      logger.info(`${sites.length}件のサイトを取得しました`);
      
      return sites.map(site => ({
        siteUrl: site.siteUrl,
        permissionLevel: site.permissionLevel,
        verified: true
      }));
      
    } catch (error) {
      logger.error('サイトの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * サイトへのアクセス権限を確認
   * @param {string} siteUrl - サイトURL
   * @returns {boolean} アクセス権限の有無
   */
  async verifySiteAccess(siteUrl) {
    try {
      const sites = await this.getSites();
      return sites.some(site => site.siteUrl === siteUrl);
      
    } catch (error) {
      logger.error('サイトアクセスの確認に失敗しました', { error });
      return false;
    }
  }
}

module.exports = new GSCAuth();