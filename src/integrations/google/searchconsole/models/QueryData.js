/**
 * Google Search Console クエリデータモデル
 * 検索クエリのパフォーマンスデータを管理
 * 
 * @module QueryData
 * @requires events
 */

import { EventEmitter  } from 'events';
import { logger } from '../../../utils/logger';
const _queryLogger = logger.child({ module: 'GSCQueryData' });
import db from '../../../db/connection';
import cache from '../../../utils/cache';

/**
 * 検索クエリデータを管理するクラス
 * @class QueryData
 * @extends EventEmitter
 */
class QueryData extends EventEmitter {
  constructor() {
    super();
    this.tableName = 'gsc_query_data';
    this.initialize();
  }

  /**
   * データモデルを初期化
   * @private
   */
  async initialize() {
    try {
      await this.createTable();
      logger.info('QueryDataモデルが初期化されました');
      this.emit('initialized');
    } catch (error) {
      logger.error('QueryDataモデルの初期化に失敗しました', { error });
      this.emit('error', error);
    }
  }

  /**
   * テーブルを作成
   * @private
   */
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id SERIAL PRIMARY KEY,
        site_url VARCHAR(255) NOT NULL,
        query TEXT NOT NULL,
        page TEXT NOT NULL,
        country VARCHAR(10),
        device VARCHAR(20),
        search_appearance TEXT,
        date DATE NOT NULL,
        clicks INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        ctr DECIMAL(5,4) DEFAULT 0,
        position DECIMAL(8,2) DEFAULT 0,
        click_through_rate DECIMAL(5,4) GENERATED ALWAYS AS (
          CASE WHEN impressions > 0 THEN clicks::DECIMAL / impressions ELSE 0 END
        ) STORED,
        keyword_length INTEGER GENERATED ALWAYS AS (LENGTH(query)) STORED,
        is_branded BOOLEAN DEFAULT FALSE,
        is_long_tail BOOLEAN GENERATED ALWAYS AS (
          CASE WHEN LENGTH(query) - LENGTH(REPLACE(query, ' ', '')) >= 2 THEN TRUE ELSE FALSE END
        ) STORED,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(site_url, query, page, country, device, date)
      );

      CREATE INDEX IF NOT EXISTS idx_gsc_query_site_date ON ${this.tableName}(site_url, date);
      CREATE INDEX IF NOT EXISTS idx_gsc_query_query ON ${this.tableName}(query);
      CREATE INDEX IF NOT EXISTS idx_gsc_query_page ON ${this.tableName}(page);
      CREATE INDEX IF NOT EXISTS idx_gsc_query_performance ON ${this.tableName}(clicks DESC, impressions DESC);
      CREATE INDEX IF NOT EXISTS idx_gsc_query_position ON ${this.tableName}(position);
      CREATE INDEX IF NOT EXISTS idx_gsc_query_date ON ${this.tableName}(date DESC);
    `;

    try {
      await db.raw(query);
      logger.info('クエリデータテーブルが作成されました');
    } catch (error) {
      logger.error('テーブル作成に失敗しました', { error });
      throw error;
    }
  }

  /**
   * クエリデータを保存
   * @param {Array} queryDataItems - クエリデータの配列
   * @returns {Object} 保存結果
   */
  async save(queryDataItems) {
    if (!Array.isArray(queryDataItems) || queryDataItems.length === 0) {
      throw new Error('保存するデータが指定されていません');
    }

    const transaction = await db.transaction();
    let savedCount = 0;
    let errorCount = 0;

    try {
      for (const item of queryDataItems) {
        try {
          const data = this.prepareData(item);
          
          await transaction(this.tableName)
            .insert(data)
            .onConflict(['site_url', 'query', 'page', 'country', 'device', 'date'])
            .merge({
              clicks: data.clicks,
              impressions: data.impressions,
              ctr: data.ctr,
              position: data.position,
              search_appearance: data.search_appearance,
              is_branded: data.is_branded,
              updated_at: new Date()
            });
          
          savedCount++;
        } catch (error) {
          logger.error('レコードの保存に失敗しました', { error, item });
          errorCount++;
        }
      }

      await transaction.commit();

      const result = {
        total: queryDataItems.length,
        saved: savedCount,
        errors: errorCount
      };

      logger.info('クエリデータを保存しました', result);
      this.emit('saved', result);

      // キャッシュをクリア
      await this.clearCache(queryDataItems[0].site_url);

      return result;

    } catch (error) {
      await transaction.rollback();
      logger.error('クエリデータの保存に失敗しました', { error });
      throw error;
    }
  }

  /**
   * データを準備
   * @private
   */
  prepareData(item) {
    const [date, query, page, country = 'UNKNOWN', device = 'UNKNOWN'] = item.keys || [];
    
    return {
      site_url: item.site_url,
      query: query || '',
      page: page || '',
      country: country,
      device: device,
      search_appearance: item.search_appearance || null,
      date: date,
      clicks: item.clicks || 0,
      impressions: item.impressions || 0,
      ctr: item.ctr || 0,
      position: item.position || 0,
      is_branded: this.checkIfBranded(query)
    };
  }

  /**
   * ブランドクエリかどうかをチェック
   * @private
   */
  checkIfBranded(query) {
    const brandKeywords = process.env.BRAND_KEYWORDS?.split(',') || [];
    const lowerQuery = (query || '').toLowerCase();
    
    return brandKeywords.some(brand => 
      lowerQuery.includes(brand.toLowerCase().trim())
    );
  }

  /**
   * クエリデータを取得
   * @param {Object} params - 検索パラメータ
   * @returns {Array} クエリデータ
   */
  async find(params = {}) {
    const {
      siteUrl,
      startDate,
      endDate,
      query,
      page,
      country,
      device,
      minClicks,
      minImpressions,
      orderBy = 'date DESC, clicks DESC',
      limit = 1000,
      offset = 0
    } = params;

    const cacheKey = this.generateCacheKey('find', params);
    const cachedData = await cache.get(cacheKey);

    if (cachedData && !params.forceRefresh) {
      return JSON.parse(cachedData);
    }

    try {
      let queryBuilder = db(this.tableName);

      if (siteUrl) queryBuilder.where('site_url', siteUrl);
      if (startDate) queryBuilder.where('date', '>=', startDate);
      if (endDate) queryBuilder.where('date', '<=', endDate);
      if (query) queryBuilder.where('query', 'LIKE', `%${query}%`);
      if (page) queryBuilder.where('page', 'LIKE', `%${page}%`);
      if (country) queryBuilder.where('country', country);
      if (device) queryBuilder.where('device', device);
      if (minClicks) queryBuilder.where('clicks', '>=', minClicks);
      if (minImpressions) queryBuilder.where('impressions', '>=', minImpressions);

      const results = await queryBuilder
        .orderByRaw(orderBy)
        .limit(limit)
        .offset(offset);

      // キャッシュに保存（5分間）
      await cache.set(cacheKey, JSON.stringify(results), 300);

      return results;

    } catch (error) {
      logger.error('クエリデータの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * トップクエリを取得
   * @param {Object} params - 検索パラメータ
   * @returns {Array} トップクエリ
   */
  async getTopQueries(params = {}) {
    const {
      siteUrl,
      startDate,
      endDate,
      limit = 100,
      minImpressions = 10,
      device
    } = params;

    try {
      const query = db(this.tableName)
        .select('query')
        .sum('clicks as total_clicks')
        .sum('impressions as total_impressions')
        .avg('ctr as avg_ctr')
        .avg('position as avg_position')
        .count('* as days_appeared')
        .groupBy('query');

      if (siteUrl) query.where('site_url', siteUrl);
      if (startDate) query.where('date', '>=', startDate);
      if (endDate) query.where('date', '<=', endDate);
      if (device) query.where('device', device);

      const results = await query
        .having('total_impressions', '>=', minImpressions)
        .orderBy('total_clicks', 'desc')
        .limit(limit);

      return results.map(row => ({
        query: row.query,
        totalClicks: parseInt(row.total_clicks),
        totalImpressions: parseInt(row.total_impressions),
        avgCtr: parseFloat(row.avg_ctr),
        avgPosition: parseFloat(row.avg_position),
        daysAppeared: parseInt(row.days_appeared)
      }));

    } catch (error) {
      logger.error('トップクエリの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * ページ別パフォーマンスを取得
   * @param {Object} params - 検索パラメータ
   * @returns {Array} ページ別データ
   */
  async getPagePerformance(params = {}) {
    const {
      siteUrl,
      startDate,
      endDate,
      limit = 100
    } = params;

    try {
      const query = db(this.tableName)
        .select('page')
        .sum('clicks as total_clicks')
        .sum('impressions as total_impressions')
        .avg('ctr as avg_ctr')
        .avg('position as avg_position')
        .countDistinct('query as unique_queries')
        .groupBy('page');

      if (siteUrl) query.where('site_url', siteUrl);
      if (startDate) query.where('date', '>=', startDate);
      if (endDate) query.where('date', '<=', endDate);

      const results = await query
        .orderBy('total_clicks', 'desc')
        .limit(limit);

      return results.map(row => ({
        page: row.page,
        totalClicks: parseInt(row.total_clicks),
        totalImpressions: parseInt(row.total_impressions),
        avgCtr: parseFloat(row.avg_ctr),
        avgPosition: parseFloat(row.avg_position),
        uniqueQueries: parseInt(row.unique_queries)
      }));

    } catch (error) {
      logger.error('ページ別パフォーマンスの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * 検索意図を分析
   * @param {Object} params - 検索パラメータ
   * @returns {Object} 検索意図の分析結果
   */
  async analyzeSearchIntent(params = {}) {
    const { siteUrl, startDate, endDate } = params;

    try {
      // 検索意図のキーワードパターン
      const intentPatterns = {
        informational: ['とは', 'どうやって', '方法', '意味', '違い', '比較'],
        transactional: ['購入', '買う', '価格', '値段', '最安', 'セール'],
        navigational: ['ログイン', 'サイト', 'ホームページ', '公式'],
        commercial: ['おすすめ', 'ランキング', '評価', 'レビュー', '口コミ']
      };

      const results = {};

      for (const [intent, patterns] of Object.entries(intentPatterns)) {
        let query = db(this.tableName)
          .sum('clicks as total_clicks')
          .sum('impressions as total_impressions')
          .count('distinct query as query_count');

        if (siteUrl) query.where('site_url', siteUrl);
        if (startDate) query.where('date', '>=', startDate);
        if (endDate) query.where('date', '<=', endDate);

        // パターンに基づくフィルタリング
        query.where(function() {
          patterns.forEach(pattern => {
            this.orWhere('query', 'LIKE', `%${pattern}%`);
          });
        });

        const result = await query.first();
        
        results[intent] = {
          totalClicks: parseInt(result.total_clicks || 0),
          totalImpressions: parseInt(result.total_impressions || 0),
          queryCount: parseInt(result.query_count || 0)
        };
      }

      return results;

    } catch (error) {
      logger.error('検索意図の分析に失敗しました', { error });
      throw error;
    }
  }

  /**
   * キーワードトレンドを分析
   * @param {Object} params - 検索パラメータ
   * @returns {Array} トレンドデータ
   */
  async analyzeTrends(params = {}) {
    const {
      siteUrl,
      query,
      startDate,
      endDate,
      interval = 'day' // day, week, month
    } = params;

    try {
      let dateFormat;
      switch (interval) {
        case 'week':
          dateFormat = "DATE_TRUNC('week', date)";
          break;
        case 'month':
          dateFormat = "DATE_TRUNC('month', date)";
          break;
        default:
          dateFormat = 'date';
      }

      let queryBuilder = db(this.tableName)
        .select(db.raw(`${dateFormat} as period`))
        .sum('clicks as total_clicks')
        .sum('impressions as total_impressions')
        .avg('ctr as avg_ctr')
        .avg('position as avg_position')
        .groupByRaw(dateFormat)
        .orderByRaw(`${dateFormat} ASC`);

      if (siteUrl) queryBuilder.where('site_url', siteUrl);
      if (query) queryBuilder.where('query', query);
      if (startDate) queryBuilder.where('date', '>=', startDate);
      if (endDate) queryBuilder.where('date', '<=', endDate);

      const results = await queryBuilder;

      return results.map(row => ({
        period: row.period,
        totalClicks: parseInt(row.total_clicks),
        totalImpressions: parseInt(row.total_impressions),
        avgCtr: parseFloat(row.avg_ctr),
        avgPosition: parseFloat(row.avg_position)
      }));

    } catch (error) {
      logger.error('トレンド分析に失敗しました', { error });
      throw error;
    }
  }

  /**
   * キャッシュキーを生成
   * @private
   */
  generateCacheKey(operation, params) {
    return `gsc:query:${operation}:${JSON.stringify(params)}`;
  }

  /**
   * キャッシュをクリア
   * @private
   */
  async clearCache(siteUrl) {
    const pattern = `gsc:query:*${siteUrl}*`;
    await cache.deletePattern(pattern);
  }

  /**
   * 統計情報を取得
   * @param {Object} params - 検索パラメータ
   * @returns {Object} 統計情報
   */
  async getStatistics(params = {}) {
    const { siteUrl, startDate, endDate } = params;

    try {
      let query = db(this.tableName);

      if (siteUrl) query.where('site_url', siteUrl);
      if (startDate) query.where('date', '>=', startDate);
      if (endDate) query.where('date', '<=', endDate);

      const stats = await query
        .select(
          db.raw('COUNT(DISTINCT query) as unique_queries'),
          db.raw('COUNT(DISTINCT page) as unique_pages'),
          db.raw('SUM(clicks) as total_clicks'),
          db.raw('SUM(impressions) as total_impressions'),
          db.raw('AVG(ctr) as avg_ctr'),
          db.raw('AVG(position) as avg_position'),
          db.raw('MIN(date) as first_date'),
          db.raw('MAX(date) as last_date')
        )
        .first();

      return {
        uniqueQueries: parseInt(stats.unique_queries),
        uniquePages: parseInt(stats.unique_pages),
        totalClicks: parseInt(stats.total_clicks),
        totalImpressions: parseInt(stats.total_impressions),
        avgCtr: parseFloat(stats.avg_ctr),
        avgPosition: parseFloat(stats.avg_position),
        dateRange: {
          start: stats.first_date,
          end: stats.last_date
        }
      };

    } catch (error) {
      logger.error('統計情報の取得に失敗しました', { error });
      throw error;
    }
  }
}

module.exports = new QueryData();