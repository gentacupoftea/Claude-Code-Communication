/**
 * Google Search Console パフォーマンスデータモデル
 * サイト全体のパフォーマンスメトリクスを管理
 * 
 * @module PerformanceData
 * @requires events
 */

import { EventEmitter  } from 'events';
import { logger } from '../../../utils/logger';
const _perfLogger = logger.child({ module: 'GSCPerformanceData' });
import db from '../../../db/connection';
import cache from '../../../utils/cache';

/**
 * パフォーマンスデータを管理するクラス
 * @class PerformanceData
 * @extends EventEmitter
 */
class PerformanceData extends EventEmitter {
  constructor() {
    super();
    this.tableName = 'gsc_performance_data';
    this.summaryTableName = 'gsc_performance_summary';
    this.initialize();
  }

  /**
   * データモデルを初期化
   * @private
   */
  async initialize() {
    try {
      await this.createTables();
      logger.info('PerformanceDataモデルが初期化されました');
      this.emit('initialized');
    } catch (error) {
      logger.error('PerformanceDataモデルの初期化に失敗しました', { error });
      this.emit('error', error);
    }
  }

  /**
   * テーブルを作成
   * @private
   */
  async createTables() {
    // メインパフォーマンステーブル
    const mainTableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id SERIAL PRIMARY KEY,
        site_url VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        data_type VARCHAR(50) NOT NULL, -- 'total', 'device', 'country', 'searchType'
        dimension_name VARCHAR(100),
        dimension_value VARCHAR(100),
        clicks INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        ctr DECIMAL(5,4) DEFAULT 0,
        position DECIMAL(8,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(site_url, date, data_type, dimension_name, dimension_value)
      );

      CREATE INDEX IF NOT EXISTS idx_gsc_perf_site_date ON ${this.tableName}(site_url, date);
      CREATE INDEX IF NOT EXISTS idx_gsc_perf_data_type ON ${this.tableName}(data_type);
      CREATE INDEX IF NOT EXISTS idx_gsc_perf_metrics ON ${this.tableName}(clicks DESC, impressions DESC);
    `;

    // サマリーテーブル
    const summaryTableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.summaryTableName} (
        id SERIAL PRIMARY KEY,
        site_url VARCHAR(255) NOT NULL,
        period_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        total_clicks INTEGER DEFAULT 0,
        total_impressions INTEGER DEFAULT 0,
        avg_ctr DECIMAL(5,4) DEFAULT 0,
        avg_position DECIMAL(8,2) DEFAULT 0,
        unique_queries INTEGER DEFAULT 0,
        unique_pages INTEGER DEFAULT 0,
        top_query VARCHAR(255),
        top_page TEXT,
        mobile_percentage DECIMAL(5,2),
        desktop_percentage DECIMAL(5,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(site_url, period_type, period_start)
      );

      CREATE INDEX IF NOT EXISTS idx_gsc_summary_site_period ON ${this.summaryTableName}(site_url, period_type, period_start);
    `;

    try {
      await db.raw(mainTableQuery);
      await db.raw(summaryTableQuery);
      logger.info('パフォーマンスデータテーブルが作成されました');
    } catch (error) {
      logger.error('テーブル作成に失敗しました', { error });
      throw error;
    }
  }

  /**
   * パフォーマンスデータを保存
   * @param {Array} performanceItems - パフォーマンスデータの配列
   * @returns {Object} 保存結果
   */
  async save(performanceItems) {
    if (!Array.isArray(performanceItems) || performanceItems.length === 0) {
      throw new Error('保存するデータが指定されていません');
    }

    const transaction = await db.transaction();
    let savedCount = 0;
    let errorCount = 0;

    try {
      for (const item of performanceItems) {
        try {
          const data = this.prepareData(item);
          
          await transaction(this.tableName)
            .insert(data)
            .onConflict(['site_url', 'date', 'data_type', 'dimension_name', 'dimension_value'])
            .merge({
              clicks: data.clicks,
              impressions: data.impressions,
              ctr: data.ctr,
              position: data.position,
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
        total: performanceItems.length,
        saved: savedCount,
        errors: errorCount
      };

      logger.info('パフォーマンスデータを保存しました', result);
      this.emit('saved', result);

      // サマリーを更新
      await this.updateSummary(performanceItems[0].site_url);

      return result;

    } catch (error) {
      await transaction.rollback();
      logger.error('パフォーマンスデータの保存に失敗しました', { error });
      throw error;
    }
  }

  /**
   * データを準備
   * @private
   */
  prepareData(item) {
    const {
      site_url,
      date,
      data_type,
      dimension_name = null,
      dimension_value = null,
      clicks = 0,
      impressions = 0,
      ctr = 0,
      position = 0
    } = item;

    return {
      site_url,
      date,
      data_type,
      dimension_name,
      dimension_value,
      clicks,
      impressions,
      ctr,
      position
    };
  }

  /**
   * 日次パフォーマンスを取得
   * @param {Object} params - 検索パラメータ
   * @returns {Array} 日次データ
   */
  async getDailyPerformance(params = {}) {
    const {
      siteUrl,
      startDate,
      endDate,
      dataType = 'total'
    } = params;

    const cacheKey = this.generateCacheKey('daily', params);
    const cachedData = await cache.get(cacheKey);

    if (cachedData && !params.forceRefresh) {
      return JSON.parse(cachedData);
    }

    try {
      let query = db(this.tableName)
        .where('data_type', dataType)
        .orderBy('date', 'asc');

      if (siteUrl) query.where('site_url', siteUrl);
      if (startDate) query.where('date', '>=', startDate);
      if (endDate) query.where('date', '<=', endDate);

      const results = await query;

      // キャッシュに保存（5分間）
      await cache.set(cacheKey, JSON.stringify(results), 300);

      return results;

    } catch (error) {
      logger.error('日次パフォーマンスの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * デバイス別パフォーマンスを取得
   * @param {Object} params - 検索パラメータ
   * @returns {Array} デバイス別データ
   */
  async getDevicePerformance(params = {}) {
    const {
      siteUrl,
      startDate,
      endDate
    } = params;

    try {
      let query = db(this.tableName)
        .select('dimension_value as device')
        .sum('clicks as total_clicks')
        .sum('impressions as total_impressions')
        .avg('ctr as avg_ctr')
        .avg('position as avg_position')
        .where('data_type', 'device')
        .where('dimension_name', 'device')
        .groupBy('dimension_value');

      if (siteUrl) query.where('site_url', siteUrl);
      if (startDate) query.where('date', '>=', startDate);
      if (endDate) query.where('date', '<=', endDate);

      const results = await query;

      return results.map(row => ({
        device: row.device,
        totalClicks: parseInt(row.total_clicks),
        totalImpressions: parseInt(row.total_impressions),
        avgCtr: parseFloat(row.avg_ctr),
        avgPosition: parseFloat(row.avg_position),
        percentage: 0 // 後で計算
      }));

    } catch (error) {
      logger.error('デバイス別パフォーマンスの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * 国別パフォーマンスを取得
   * @param {Object} params - 検索パラメータ
   * @returns {Array} 国別データ
   */
  async getCountryPerformance(params = {}) {
    const {
      siteUrl,
      startDate,
      endDate,
      limit = 50
    } = params;

    try {
      let query = db(this.tableName)
        .select('dimension_value as country')
        .sum('clicks as total_clicks')
        .sum('impressions as total_impressions')
        .avg('ctr as avg_ctr')
        .avg('position as avg_position')
        .where('data_type', 'country')
        .where('dimension_name', 'country')
        .groupBy('dimension_value')
        .orderBy('total_clicks', 'desc')
        .limit(limit);

      if (siteUrl) query.where('site_url', siteUrl);
      if (startDate) query.where('date', '>=', startDate);
      if (endDate) query.where('date', '<=', endDate);

      const results = await query;

      return results.map(row => ({
        country: row.country,
        totalClicks: parseInt(row.total_clicks),
        totalImpressions: parseInt(row.total_impressions),
        avgCtr: parseFloat(row.avg_ctr),
        avgPosition: parseFloat(row.avg_position)
      }));

    } catch (error) {
      logger.error('国別パフォーマンスの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * サマリーを更新
   * @param {string} siteUrl - サイトURL
   * @private
   */
  async updateSummary(siteUrl) {
    try {
      // 日次サマリー
      await this.updateDailySummary(siteUrl);
      
      // 週次サマリー
      await this.updateWeeklySummary(siteUrl);
      
      // 月次サマリー
      await this.updateMonthlySummary(siteUrl);

      logger.info('サマリーを更新しました', { siteUrl });

    } catch (error) {
      logger.error('サマリーの更新に失敗しました', { error });
    }
  }

  /**
   * 日次サマリーを更新
   * @private
   */
  async updateDailySummary(siteUrl) {
    const today = new Date();
    const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      const dailyData = await db(this.tableName)
        .select('date')
        .sum('clicks as total_clicks')
        .sum('impressions as total_impressions')
        .avg('ctr as avg_ctr')
        .avg('position as avg_position')
        .where('site_url', siteUrl)
        .where('data_type', 'total')
        .where('date', '>=', startDate)
        .groupBy('date');

      for (const day of dailyData) {
        await db(this.summaryTableName)
          .insert({
            site_url: siteUrl,
            period_type: 'daily',
            period_start: day.date,
            period_end: day.date,
            total_clicks: day.total_clicks,
            total_impressions: day.total_impressions,
            avg_ctr: day.avg_ctr,
            avg_position: day.avg_position
          })
          .onConflict(['site_url', 'period_type', 'period_start'])
          .merge();
      }

    } catch (error) {
      logger.error('日次サマリーの更新に失敗しました', { error });
    }
  }

  /**
   * 週次サマリーを更新
   * @private
   */
  async updateWeeklySummary(siteUrl) {
    try {
      const weeklyData = await db(this.tableName)
        .select(db.raw("DATE_TRUNC('week', date) as week_start"))
        .sum('clicks as total_clicks')
        .sum('impressions as total_impressions')
        .avg('ctr as avg_ctr')
        .avg('position as avg_position')
        .where('site_url', siteUrl)
        .where('data_type', 'total')
        .groupByRaw("DATE_TRUNC('week', date)");

      for (const week of weeklyData) {
        const weekEnd = new Date(week.week_start);
        weekEnd.setDate(weekEnd.getDate() + 6);

        await db(this.summaryTableName)
          .insert({
            site_url: siteUrl,
            period_type: 'weekly',
            period_start: week.week_start,
            period_end: weekEnd,
            total_clicks: week.total_clicks,
            total_impressions: week.total_impressions,
            avg_ctr: week.avg_ctr,
            avg_position: week.avg_position
          })
          .onConflict(['site_url', 'period_type', 'period_start'])
          .merge();
      }

    } catch (error) {
      logger.error('週次サマリーの更新に失敗しました', { error });
    }
  }

  /**
   * 月次サマリーを更新
   * @private
   */
  async updateMonthlySummary(siteUrl) {
    try {
      const monthlyData = await db(this.tableName)
        .select(db.raw("DATE_TRUNC('month', date) as month_start"))
        .sum('clicks as total_clicks')
        .sum('impressions as total_impressions')
        .avg('ctr as avg_ctr')
        .avg('position as avg_position')
        .where('site_url', siteUrl)
        .where('data_type', 'total')
        .groupByRaw("DATE_TRUNC('month', date)");

      for (const month of monthlyData) {
        const monthEnd = new Date(month.month_start);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(monthEnd.getDate() - 1);

        await db(this.summaryTableName)
          .insert({
            site_url: siteUrl,
            period_type: 'monthly',
            period_start: month.month_start,
            period_end: monthEnd,
            total_clicks: month.total_clicks,
            total_impressions: month.total_impressions,
            avg_ctr: month.avg_ctr,
            avg_position: month.avg_position
          })
          .onConflict(['site_url', 'period_type', 'period_start'])
          .merge();
      }

    } catch (error) {
      logger.error('月次サマリーの更新に失敗しました', { error });
    }
  }

  /**
   * パフォーマンストレンドを分析
   * @param {Object} params - 検索パラメータ
   * @returns {Object} トレンド分析結果
   */
  async analyzeTrends(params = {}) {
    const {
      siteUrl,
      startDate,
      endDate,
      metric = 'clicks' // clicks, impressions, ctr, position
    } = params;

    try {
      const data = await this.getDailyPerformance({
        siteUrl,
        startDate,
        endDate
      });

      if (data.length < 2) {
        return { trend: 'insufficient_data' };
      }

      // トレンドを計算
      const values = data.map(d => d[metric]);
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));

      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      const changeRate = ((secondAvg - firstAvg) / firstAvg) * 100;

      return {
        trend: changeRate > 5 ? 'up' : changeRate < -5 ? 'down' : 'stable',
        changeRate: changeRate.toFixed(2),
        firstPeriodAvg: firstAvg.toFixed(2),
        secondPeriodAvg: secondAvg.toFixed(2),
        metric
      };

    } catch (error) {
      logger.error('トレンド分析に失敗しました', { error });
      throw error;
    }
  }

  /**
   * 前期比較を実行
   * @param {Object} params - 検索パラメータ
   * @returns {Object} 比較結果
   */
  async comparePeriods(params = {}) {
    const {
      siteUrl,
      currentStart,
      currentEnd,
      previousStart,
      previousEnd
    } = params;

    try {
      // 現在期間のデータ
      const currentData = await db(this.tableName)
        .select()
        .sum('clicks as total_clicks')
        .sum('impressions as total_impressions')
        .avg('ctr as avg_ctr')
        .avg('position as avg_position')
        .where('site_url', siteUrl)
        .where('data_type', 'total')
        .whereBetween('date', [currentStart, currentEnd])
        .first();

      // 前期間のデータ
      const previousData = await db(this.tableName)
        .select()
        .sum('clicks as total_clicks')
        .sum('impressions as total_impressions')
        .avg('ctr as avg_ctr')
        .avg('position as avg_position')
        .where('site_url', siteUrl)
        .where('data_type', 'total')
        .whereBetween('date', [previousStart, previousEnd])
        .first();

      const comparison = {
        current: {
          clicks: parseInt(currentData.total_clicks || 0),
          impressions: parseInt(currentData.total_impressions || 0),
          ctr: parseFloat(currentData.avg_ctr || 0),
          position: parseFloat(currentData.avg_position || 0)
        },
        previous: {
          clicks: parseInt(previousData.total_clicks || 0),
          impressions: parseInt(previousData.total_impressions || 0),
          ctr: parseFloat(previousData.avg_ctr || 0),
          position: parseFloat(previousData.avg_position || 0)
        },
        changes: {}
      };

      // 変化率を計算
      for (const metric of ['clicks', 'impressions', 'ctr', 'position']) {
        const current = comparison.current[metric];
        const previous = comparison.previous[metric];
        
        if (previous === 0) {
          comparison.changes[metric] = current > 0 ? 100 : 0;
        } else {
          comparison.changes[metric] = ((current - previous) / previous) * 100;
        }
      }

      return comparison;

    } catch (error) {
      logger.error('期間比較に失敗しました', { error });
      throw error;
    }
  }

  /**
   * キャッシュキーを生成
   * @private
   */
  generateCacheKey(operation, params) {
    return `gsc:performance:${operation}:${JSON.stringify(params)}`;
  }

  /**
   * 統計情報を取得
   * @param {Object} params - 検索パラメータ
   * @returns {Object} 統計情報
   */
  async getStatistics(params = {}) {
    const { siteUrl, startDate, endDate } = params;

    try {
      let query = db(this.tableName)
        .where('data_type', 'total');

      if (siteUrl) query.where('site_url', siteUrl);
      if (startDate) query.where('date', '>=', startDate);
      if (endDate) query.where('date', '<=', endDate);

      const stats = await query
        .select(
          db.raw('COUNT(DISTINCT date) as days'),
          db.raw('SUM(clicks) as total_clicks'),
          db.raw('SUM(impressions) as total_impressions'),
          db.raw('AVG(ctr) as avg_ctr'),
          db.raw('AVG(position) as avg_position'),
          db.raw('MAX(clicks) as max_daily_clicks'),
          db.raw('MAX(impressions) as max_daily_impressions')
        )
        .first();

      return {
        days: parseInt(stats.days),
        totalClicks: parseInt(stats.total_clicks),
        totalImpressions: parseInt(stats.total_impressions),
        avgCtr: parseFloat(stats.avg_ctr),
        avgPosition: parseFloat(stats.avg_position),
        maxDailyClicks: parseInt(stats.max_daily_clicks),
        maxDailyImpressions: parseInt(stats.max_daily_impressions),
        avgDailyClicks: stats.days > 0 ? Math.round(stats.total_clicks / stats.days) : 0,
        avgDailyImpressions: stats.days > 0 ? Math.round(stats.total_impressions / stats.days) : 0
      };

    } catch (error) {
      logger.error('統計情報の取得に失敗しました', { error });
      throw error;
    }
  }
}

module.exports = new PerformanceData();