/**
 * Google Search Console API クライアント
 * 検索パフォーマンスデータとサイト情報を取得
 * 
 * @module GSCApiClient
 * @requires events
 * @requires axios
 */

const { EventEmitter } = require('events');
const axios = require('axios');
const logger = require('../../../utils/logger').child({ module: 'GSCApiClient' });
const cache = require('../../../utils/cache');
const gscAuth = require('../auth/GSCAuth');
const RateLimiter = require('../../../utils/RateLimiter');
const { formatDateRange, parseGSCDate } = require('../../../utils/dateHelpers');

/**
 * Google Search Console API クライアントクラス
 * 検索パフォーマンスデータとサイト情報の取得を管理
 * 
 * @class GSCApiClient
 * @extends EventEmitter
 */
class GSCApiClient extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.rateLimiter = new RateLimiter({
      maxRequests: 200,      // 1分間の最大リクエスト数
      interval: 60 * 1000    // 1分
    });
    
    // デフォルト設定
    this.defaultDimensions = ['query', 'page', 'country', 'device'];
    this.defaultMetrics = ['clicks', 'impressions', 'ctr', 'position'];
    this.maxRows = 25000;    // API制限
    
    this.initialize();
  }

  /**
   * APIクライアントを初期化
   * @private
   */
  async initialize() {
    try {
      gscAuth.on('authenticated', () => {
        this.client = gscAuth.getClient();
        logger.info('GSC APIクライアントが初期化されました');
        this.emit('initialized');
      });
      
      if (gscAuth.isAuthValid()) {
        this.client = gscAuth.getClient();
      }
      
    } catch (error) {
      logger.error('APIクライアントの初期化に失敗しました', { error });
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 検索パフォーマンスデータを取得
   * @param {Object} params - 検索パラメータ
   * @returns {Object} 検索パフォーマンスデータ
   */
  async getSearchAnalytics(params) {
    try {
      const {
        siteUrl,
        startDate,
        endDate,
        dimensions = this.defaultDimensions,
        metrics = this.defaultMetrics,
        filters = [],
        dimensionFilterGroups = [],
        searchType = 'web',
        dataState = 'final',
        aggregationType = 'auto',
        rowLimit = 1000,
        startRow = 0
      } = params;
      
      // キャッシュキーを生成
      const cacheKey = this.generateCacheKey('searchAnalytics', params);
      const cachedData = await cache.get(cacheKey);
      
      if (cachedData && !params.forceRefresh) {
        logger.debug('キャッシュからデータを返します', { cacheKey });
        return JSON.parse(cachedData);
      }
      
      // レート制限をチェック
      await this.rateLimiter.checkLimit();
      
      logger.info('検索パフォーマンスデータを取得しています', {
        siteUrl,
        startDate,
        endDate,
        dimensions,
        rowLimit
      });
      
      const requestBody = {
        startDate,
        endDate,
        dimensions: dimensions.map(d => ({ name: d })),
        metrics,
        searchType,
        dataState,
        aggregationType,
        rowLimit: Math.min(rowLimit, this.maxRows),
        startRow
      };
      
      // フィルターを適用
      if (filters.length > 0) {
        requestBody.dimensionFilterGroups = [{
          groupType: 'and',
          filters: filters
        }];
      } else if (dimensionFilterGroups.length > 0) {
        requestBody.dimensionFilterGroups = dimensionFilterGroups;
      }
      
      const response = await this.client.searchanalytics.query({
        siteUrl,
        requestBody
      });
      
      const data = {
        rows: response.data.rows || [],
        responseAggregationType: response.data.responseAggregationType
      };
      
      // キャッシュに保存（1時間）
      await cache.set(cacheKey, JSON.stringify(data), 3600);
      
      logger.info('検索パフォーマンスデータを取得しました', {
        rowCount: data.rows.length,
        aggregationType: data.responseAggregationType
      });
      
      this.emit('dataFetched', {
        type: 'searchAnalytics',
        siteUrl,
        rowCount: data.rows.length
      });
      
      return data;
      
    } catch (error) {
      logger.error('検索パフォーマンスデータの取得に失敗しました', { error });
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * すべての検索パフォーマンスデータを取得（ページネーション対応）
   * @param {Object} params - 検索パラメータ
   * @returns {Array} すべての検索パフォーマンスデータ
   */
  async getAllSearchAnalytics(params) {
    try {
      const allRows = [];
      let startRow = 0;
      let hasMore = true;
      
      while (hasMore) {
        const data = await this.getSearchAnalytics({
          ...params,
          startRow,
          rowLimit: this.maxRows
        });
        
        if (data.rows.length > 0) {
          allRows.push(...data.rows);
          startRow += data.rows.length;
          
          // APIの制限により、これ以上データがない場合
          hasMore = data.rows.length === this.maxRows;
          
          logger.debug(`${allRows.length}行のデータを取得しました`);
          
          // レート制限を考慮
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } else {
          hasMore = false;
        }
      }
      
      logger.info(`合計${allRows.length}行のデータを取得しました`);
      
      return {
        rows: allRows,
        totalRows: allRows.length
      };
      
    } catch (error) {
      logger.error('全検索パフォーマンスデータの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * URLインスペクションを実行
   * @param {string} siteUrl - サイトURL
   * @param {string} inspectionUrl - 検査するURL
   * @returns {Object} URL検査結果
   */
  async inspectUrl(siteUrl, inspectionUrl) {
    try {
      await this.rateLimiter.checkLimit();
      
      logger.info('URL検査を実行しています', { siteUrl, inspectionUrl });
      
      const response = await this.client.urlInspection.index.inspect({
        requestBody: {
          inspectionUrl,
          siteUrl
        }
      });
      
      const result = response.data.inspectionResult;
      
      logger.info('URL検査が完了しました', {
        inspectionUrl,
        indexStatus: result.indexStatusResult?.indexState,
        mobileUsability: result.mobileUsabilityResult?.verdict
      });
      
      this.emit('urlInspected', {
        siteUrl,
        inspectionUrl,
        result
      });
      
      return result;
      
    } catch (error) {
      logger.error('URL検査に失敗しました', { error });
      throw error;
    }
  }

  /**
   * サイトマップを取得
   * @param {string} siteUrl - サイトURL
   * @returns {Array} サイトマップリスト
   */
  async getSitemaps(siteUrl) {
    try {
      const cacheKey = `gsc:sitemaps:${siteUrl}`;
      const cachedData = await cache.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      await this.rateLimiter.checkLimit();
      
      logger.info('サイトマップを取得しています', { siteUrl });
      
      const response = await this.client.sitemaps.list({ siteUrl });
      const sitemaps = response.data.sitemap || [];
      
      // キャッシュに保存（1時間）
      await cache.set(cacheKey, JSON.stringify(sitemaps), 3600);
      
      logger.info(`${sitemaps.length}件のサイトマップを取得しました`);
      
      return sitemaps;
      
    } catch (error) {
      logger.error('サイトマップの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * 日次検索パフォーマンスデータを取得
   * @param {Object} params - 検索パラメータ
   * @returns {Array} 日次データ
   */
  async getDailySearchAnalytics(params) {
    try {
      const { siteUrl, startDate, endDate, ...otherParams } = params;
      
      const data = await this.getSearchAnalytics({
        siteUrl,
        startDate,
        endDate,
        dimensions: ['date', ...(otherParams.dimensions || [])],
        ...otherParams
      });
      
      // 日付でソート
      const sortedData = data.rows.sort((a, b) => {
        const dateA = new Date(a.keys[0]);
        const dateB = new Date(b.keys[0]);
        return dateA - dateB;
      });
      
      return {
        rows: sortedData,
        startDate,
        endDate
      };
      
    } catch (error) {
      logger.error('日次検索パフォーマンスデータの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * キーワードランキングを取得
   * @param {Object} params - 検索パラメータ
   * @returns {Array} キーワードランキングデータ
   */
  async getKeywordRankings(params) {
    try {
      const { siteUrl, startDate, endDate, keyword } = params;
      
      const filters = [{
        dimension: 'query',
        operator: 'equals',
        expression: keyword
      }];
      
      const data = await this.getSearchAnalytics({
        siteUrl,
        startDate,
        endDate,
        dimensions: ['date', 'query', 'page'],
        filters,
        rowLimit: 10000
      });
      
      return {
        keyword,
        rankings: data.rows.map(row => ({
          date: row.keys[0],
          query: row.keys[1],
          page: row.keys[2],
          position: row.position,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr
        }))
      };
      
    } catch (error) {
      logger.error('キーワードランキングの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * デバイス別パフォーマンスを取得
   * @param {Object} params - 検索パラメータ
   * @returns {Object} デバイス別データ
   */
  async getDevicePerformance(params) {
    try {
      const { siteUrl, startDate, endDate } = params;
      
      const data = await this.getSearchAnalytics({
        siteUrl,
        startDate,
        endDate,
        dimensions: ['device'],
        rowLimit: 10
      });
      
      const deviceMap = {
        DESKTOP: 'デスクトップ',
        MOBILE: 'モバイル',
        TABLET: 'タブレット'
      };
      
      return data.rows.map(row => ({
        device: deviceMap[row.keys[0]] || row.keys[0],
        deviceId: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position
      }));
      
    } catch (error) {
      logger.error('デバイス別パフォーマンスの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * キャッシュキーを生成
   * @private
   */
  generateCacheKey(type, params) {
    const keyParts = [
      'gsc',
      type,
      params.siteUrl,
      params.startDate,
      params.endDate,
      JSON.stringify(params.dimensions || []),
      JSON.stringify(params.filters || [])
    ];
    
    return keyParts.join(':');
  }

  /**
   * バッチリクエストを実行
   * @param {Array} requests - リクエストの配列
   * @returns {Array} レスポンスの配列
   */
  async batchRequest(requests) {
    try {
      logger.info(`${requests.length}件のバッチリクエストを実行しています`);
      
      const results = [];
      
      for (const request of requests) {
        try {
          const result = await this.getSearchAnalytics(request);
          results.push({ success: true, data: result });
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
        
        // レート制限を考慮
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      const successCount = results.filter(r => r.success).length;
      logger.info(`バッチリクエストが完了しました（成功: ${successCount}/${requests.length}）`);
      
      return results;
      
    } catch (error) {
      logger.error('バッチリクエストに失敗しました', { error });
      throw error;
    }
  }
}

module.exports = new GSCApiClient();