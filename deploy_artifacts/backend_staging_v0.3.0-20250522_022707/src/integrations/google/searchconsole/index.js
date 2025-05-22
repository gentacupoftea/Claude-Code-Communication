/**
 * Google Search Console統合メインモジュール
 * 各コンポーネントの統合とAPIエンドポイントの提供
 * 
 * @module GSCIntegration
 * @requires express
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger').child({ module: 'GSCIntegration' });

// コンポーネントをインポート
const GSCAuth = require('./auth/GSCAuth');
const GSCApiClient = require('./api/GSCApiClient');
const QueryData = require('./models/QueryData');
const PerformanceData = require('./models/PerformanceData');
const DataFetchProcessor = require('./processors/DataFetchProcessor');
const AnalyticsProcessor = require('./processors/AnalyticsProcessor');
const DataVisualizer = require('./visualizers/DataVisualizer');

/**
 * Google Search Console統合クラス
 * @class GSCIntegration
 */
class GSCIntegration {
  constructor() {
    this.isInitialized = false;
    this.initialize();
  }

  /**
   * 統合を初期化
   * @private
   */
  async initialize() {
    try {
      logger.info('Google Search Console統合を初期化しています...');
      
      // 認証の初期化を待つ
      await new Promise((resolve, reject) => {
        GSCAuth.once('authenticated', () => {
          logger.info('GSC認証が完了しました');
          resolve();
        });
        
        GSCAuth.once('authError', (error) => {
          logger.error('GSC認証エラー', { error });
          reject(error);
        });
        
        // タイムアウト設定（30秒）
        setTimeout(() => {
          reject(new Error('認証タイムアウト'));
        }, 30000);
      });
      
      this.isInitialized = true;
      logger.info('Google Search Console統合の初期化が完了しました');
      
    } catch (error) {
      logger.error('GSC統合の初期化に失敗しました', { error });
      throw error;
    }
  }

  /**
   * データ同期を実行
   * @param {Object} params - 同期パラメータ
   * @returns {Object} 同期結果
   */
  async syncData(params) {
    const {
      siteUrl,
      startDate,
      endDate,
      dataTypes = ['query', 'performance', 'device', 'country'],
      forceRefresh = false
    } = params;
    
    try {
      logger.info('データ同期を開始します', { siteUrl, startDate, endDate });
      
      const result = await DataFetchProcessor.syncAllData({
        siteUrl,
        startDate,
        endDate,
        dataTypes,
        forceRefresh
      });
      
      logger.info('データ同期が完了しました', result);
      
      return {
        success: true,
        result
      };
      
    } catch (error) {
      logger.error('データ同期でエラーが発生しました', { error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 分析を実行
   * @param {Object} params - 分析パラメータ
   * @returns {Object} 分析結果
   */
  async analyze(params) {
    const {
      siteUrl,
      startDate,
      endDate,
      previousStartDate,
      previousEndDate
    } = params;
    
    try {
      logger.info('分析を開始します', { siteUrl, startDate, endDate });
      
      const analysisResult = await AnalyticsProcessor.performComprehensiveAnalysis({
        siteUrl,
        startDate,
        endDate,
        previousStartDate,
        previousEndDate
      });
      
      logger.info('分析が完了しました');
      
      return {
        success: true,
        analysis: analysisResult
      };
      
    } catch (error) {
      logger.error('分析でエラーが発生しました', { error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * レポートを生成
   * @param {Object} params - レポートパラメータ
   * @returns {Object} レポート情報
   */
  async generateReport(params) {
    const {
      siteUrl,
      startDate,
      endDate,
      previousStartDate,
      previousEndDate,
      analysisData
    } = params;
    
    try {
      logger.info('レポート生成を開始します', { siteUrl });
      
      const reportInfo = await DataVisualizer.generateComprehensiveReport({
        siteUrl,
        startDate,
        endDate,
        previousStartDate,
        previousEndDate,
        analysisData
      });
      
      logger.info('レポート生成が完了しました', { reportId: reportInfo.reportId });
      
      return {
        success: true,
        report: reportInfo
      };
      
    } catch (error) {
      logger.error('レポート生成でエラーが発生しました', { error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * ダッシュボードデータを取得
   * @param {Object} params - ダッシュボードパラメータ
   * @returns {Object} ダッシュボードデータ
   */
  async getDashboardData(params) {
    const { siteUrl, period = 30 } = params;
    
    try {
      const dashboardData = await DataVisualizer.generateDashboardData({
        siteUrl,
        period
      });
      
      return {
        success: true,
        data: dashboardData
      };
      
    } catch (error) {
      logger.error('ダッシュボードデータ取得でエラーが発生しました', { error });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// シングルトンインスタンス
const gscIntegration = new GSCIntegration();

// APIエンドポイントの定義

/**
 * 認証状態を確認
 */
router.get('/auth/status', async (req, res) => {
  try {
    const isAuthenticated = GSCAuth.isAuthValid();
    const authType = GSCAuth.authType;
    
    res.json({
      authenticated: isAuthenticated,
      authType,
      initialized: gscIntegration.isInitialized
    });
    
  } catch (error) {
    logger.error('認証状態の確認でエラーが発生しました', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * 利用可能なサイトを取得
 */
router.get('/sites', async (req, res) => {
  try {
    const sites = await GSCAuth.getSites();
    
    res.json({
      sites,
      count: sites.length
    });
    
  } catch (error) {
    logger.error('サイト一覧の取得でエラーが発生しました', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * データ同期を実行
 */
router.post('/sync', async (req, res) => {
  try {
    const {
      siteUrl,
      startDate,
      endDate,
      dataTypes,
      forceRefresh
    } = req.body;
    
    const result = await gscIntegration.syncData({
      siteUrl,
      startDate,
      endDate,
      dataTypes,
      forceRefresh
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('データ同期でエラーが発生しました', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * 増分同期を実行
 */
router.post('/sync/incremental', async (req, res) => {
  try {
    const { siteUrl, daysBack = 7 } = req.body;
    
    const result = await DataFetchProcessor.incrementalSync({
      siteUrl,
      daysBack
    });
    
    res.json({
      success: true,
      result
    });
    
  } catch (error) {
    logger.error('増分同期でエラーが発生しました', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * 分析を実行
 */
router.post('/analyze', async (req, res) => {
  try {
    const {
      siteUrl,
      startDate,
      endDate,
      previousStartDate,
      previousEndDate
    } = req.body;
    
    const result = await gscIntegration.analyze({
      siteUrl,
      startDate,
      endDate,
      previousStartDate,
      previousEndDate
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('分析でエラーが発生しました', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * レポートを生成
 */
router.post('/report', async (req, res) => {
  try {
    const {
      siteUrl,
      startDate,
      endDate,
      previousStartDate,
      previousEndDate
    } = req.body;
    
    // まず分析を実行
    const analysisResult = await gscIntegration.analyze({
      siteUrl,
      startDate,
      endDate,
      previousStartDate,
      previousEndDate
    });
    
    if (!analysisResult.success) {
      throw new Error(analysisResult.error);
    }
    
    // レポートを生成
    const reportResult = await gscIntegration.generateReport({
      siteUrl,
      startDate,
      endDate,
      previousStartDate,
      previousEndDate,
      analysisData: analysisResult.analysis
    });
    
    res.json(reportResult);
    
  } catch (error) {
    logger.error('レポート生成でエラーが発生しました', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * クエリデータを取得
 */
router.get('/queries', async (req, res) => {
  try {
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
      orderBy,
      limit = 100,
      offset = 0
    } = req.query;
    
    const queries = await QueryData.find({
      siteUrl,
      startDate,
      endDate,
      query,
      page,
      country,
      device,
      minClicks: parseInt(minClicks) || undefined,
      minImpressions: parseInt(minImpressions) || undefined,
      orderBy,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      queries,
      count: queries.length
    });
    
  } catch (error) {
    logger.error('クエリデータの取得でエラーが発生しました', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * トップクエリを取得
 */
router.get('/queries/top', async (req, res) => {
  try {
    const {
      siteUrl,
      startDate,
      endDate,
      limit = 100,
      minImpressions = 10,
      device
    } = req.query;
    
    const topQueries = await QueryData.getTopQueries({
      siteUrl,
      startDate,
      endDate,
      limit: parseInt(limit),
      minImpressions: parseInt(minImpressions),
      device
    });
    
    res.json({
      queries: topQueries,
      count: topQueries.length
    });
    
  } catch (error) {
    logger.error('トップクエリの取得でエラーが発生しました', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * パフォーマンスデータを取得
 */
router.get('/performance', async (req, res) => {
  try {
    const {
      siteUrl,
      startDate,
      endDate,
      dataType = 'total'
    } = req.query;
    
    const performance = await PerformanceData.getDailyPerformance({
      siteUrl,
      startDate,
      endDate,
      dataType
    });
    
    res.json({
      performance,
      count: performance.length
    });
    
  } catch (error) {
    logger.error('パフォーマンスデータの取得でエラーが発生しました', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * デバイス別パフォーマンスを取得
 */
router.get('/performance/devices', async (req, res) => {
  try {
    const {
      siteUrl,
      startDate,
      endDate
    } = req.query;
    
    const devicePerformance = await PerformanceData.getDevicePerformance({
      siteUrl,
      startDate,
      endDate
    });
    
    res.json({
      devices: devicePerformance,
      count: devicePerformance.length
    });
    
  } catch (error) {
    logger.error('デバイス別パフォーマンスの取得でエラーが発生しました', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * 国別パフォーマンスを取得
 */
router.get('/performance/countries', async (req, res) => {
  try {
    const {
      siteUrl,
      startDate,
      endDate,
      limit = 50
    } = req.query;
    
    const countryPerformance = await PerformanceData.getCountryPerformance({
      siteUrl,
      startDate,
      endDate,
      limit: parseInt(limit)
    });
    
    res.json({
      countries: countryPerformance,
      count: countryPerformance.length
    });
    
  } catch (error) {
    logger.error('国別パフォーマンスの取得でエラーが発生しました', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * ダッシュボードデータを取得
 */
router.get('/dashboard', async (req, res) => {
  try {
    const {
      siteUrl,
      period = 30
    } = req.query;
    
    const dashboardData = await gscIntegration.getDashboardData({
      siteUrl,
      period: parseInt(period)
    });
    
    res.json(dashboardData);
    
  } catch (error) {
    logger.error('ダッシュボードデータの取得でエラーが発生しました', { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * 統計情報を取得
 */
router.get('/stats', async (req, res) => {
  try {
    const {
      siteUrl,
      startDate,
      endDate
    } = req.query;
    
    const [queryStats, performanceStats] = await Promise.all([
      QueryData.getStatistics({ siteUrl, startDate, endDate }),
      PerformanceData.getStatistics({ siteUrl, startDate, endDate })
    ]);
    
    res.json({
      queries: queryStats,
      performance: performanceStats
    });
    
  } catch (error) {
    logger.error('統計情報の取得でエラーが発生しました', { error });
    res.status(500).json({ error: error.message });
  }
});

// エクスポート
module.exports = {
  router,
  GSCIntegration: gscIntegration,
  GSCAuth,
  GSCApiClient,
  QueryData,
  PerformanceData,
  DataFetchProcessor,
  AnalyticsProcessor,
  DataVisualizer
};