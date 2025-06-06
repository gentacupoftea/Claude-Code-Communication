/**
 * Google Search Consoleデータ取得プロセッサー
 * API経由でデータを取得し、データベースに保存
 * 
 * @module DataFetchProcessor
 * @requires events
 */

import { EventEmitter  } from 'events';
import { logger } from '../../../utils/logger';
const _fetchLogger = logger.child({ module: 'GSCDataFetchProcessor' });
import gscApiClient from '../api/GSCApiClient';
import QueryData from '../models/QueryData';
import PerformanceData from '../models/PerformanceData';
import Queue from '../../../utils/Queue';
import { _formatDateRange, _addDays  } from '../../../utils/dateHelpers';

/**
 * データ取得プロセッサークラス
 * バッチ処理とリトライ機構を備えた効率的なデータ取得
 * 
 * @class DataFetchProcessor
 * @extends EventEmitter
 */
class DataFetchProcessor extends EventEmitter {
  constructor() {
    super();
    this.queue = new Queue({
      concurrency: 3,
      retries: 3,
      retryDelay: 5000
    });
    
    this.batchSize = 100;
    this.maxDaysPerRequest = 30;
    this.dimensions = {
      query: ['date', 'query', 'page', 'country', 'device'],
      performance: ['date'],
      device: ['date', 'device'],
      country: ['date', 'country'],
      searchType: ['date', 'searchType']
    };
    
    this.initialize();
  }

  /**
   * プロセッサーを初期化
   * @private
   */
  initialize() {
    this.queue.on('taskComplete', (task) => {
      logger.info('タスクが完了しました', { taskId: task.id });
      this.emit('taskComplete', task);
    });
    
    this.queue.on('taskError', (task, error) => {
      logger.error('タスクでエラーが発生しました', { taskId: task.id, error });
      this.emit('taskError', task, error);
    });
    
    this.queue.on('queueEmpty', () => {
      logger.info('キューが空になりました');
      this.emit('queueEmpty');
    });
  }

  /**
   * 全データの同期を実行
   * @param {Object} params - 同期パラメータ
   * @returns {Object} 同期結果
   */
  async syncAllData(params) {
    const {
      siteUrl,
      startDate,
      endDate,
      dataTypes = ['query', 'performance', 'device', 'country']
    } = params;
    
    try {
      logger.info('全データの同期を開始します', {
        siteUrl,
        startDate,
        endDate,
        dataTypes
      });
      
      const tasks = [];
      
      // データタイプごとにタスクを作成
      for (const dataType of dataTypes) {
        const dateRanges = this.splitDateRange(startDate, endDate);
        
        for (const range of dateRanges) {
          tasks.push({
            type: 'fetchData',
            dataType,
            siteUrl,
            startDate: range.start,
            endDate: range.end
          });
        }
      }
      
      // タスクをキューに追加
      for (const task of tasks) {
        await this.queue.addTask(task, this.processTask.bind(this));
      }
      
      // キューの完了を待つ
      await this.queue.waitForCompletion();
      
      const result = {
        totalTasks: tasks.length,
        completed: this.queue.completedTasks,
        failed: this.queue.failedTasks,
        duration: this.queue.getDuration()
      };
      
      logger.info('全データの同期が完了しました', result);
      this.emit('syncComplete', result);
      
      return result;
      
    } catch (error) {
      logger.error('データ同期でエラーが発生しました', { error });
      this.emit('syncError', error);
      throw error;
    }
  }

  /**
   * タスクを処理
   * @private
   */
  async processTask(task) {
    const { type, dataType, siteUrl, startDate, endDate } = task;
    
    try {
      switch (type) {
        case 'fetchData':
          return await this.fetchDataByType(dataType, siteUrl, startDate, endDate);
        case 'fetchUrl':
          return await this.fetchUrlData(task);
        default:
          throw new Error(`未知のタスクタイプ: ${type}`);
      }
    } catch (error) {
      logger.error('タスク処理でエラーが発生しました', { task, error });
      throw error;
    }
  }

  /**
   * データタイプごとにデータを取得
   * @private
   */
  async fetchDataByType(dataType, siteUrl, startDate, endDate) {
    try {
      logger.info(`${dataType}データを取得しています`, {
        siteUrl,
        startDate,
        endDate
      });
      
      let data;
      
      switch (dataType) {
        case 'query':
          data = await this.fetchQueryData(siteUrl, startDate, endDate);
          break;
        case 'performance':
          data = await this.fetchPerformanceData(siteUrl, startDate, endDate);
          break;
        case 'device':
          data = await this.fetchDeviceData(siteUrl, startDate, endDate);
          break;
        case 'country':
          data = await this.fetchCountryData(siteUrl, startDate, endDate);
          break;
        default:
          throw new Error(`未対応のデータタイプ: ${dataType}`);
      }
      
      logger.info(`${dataType}データの取得が完了しました`, {
        rowCount: data.savedCount
      });
      
      return data;
      
    } catch (error) {
      logger.error(`${dataType}データの取得に失敗しました`, { error });
      throw error;
    }
  }

  /**
   * クエリデータを取得
   * @private
   */
  async fetchQueryData(siteUrl, startDate, endDate) {
    try {
      const data = await gscApiClient.getAllSearchAnalytics({
        siteUrl,
        startDate,
        endDate,
        dimensions: this.dimensions.query
      });
      
      // データを整形
      const formattedData = data.rows.map(row => ({
        site_url: siteUrl,
        keys: row.keys,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position
      }));
      
      // バッチ保存
      let totalSaved = 0;
      
      for (let i = 0; i < formattedData.length; i += this.batchSize) {
        const batch = formattedData.slice(i, i + this.batchSize);
        const result = await QueryData.save(batch);
        totalSaved += result.saved;
        
        this.emit('batchSaved', {
          dataType: 'query',
          batchSize: batch.length,
          saved: result.saved
        });
      }
      
      return {
        dataType: 'query',
        totalRows: data.rows.length,
        savedCount: totalSaved
      };
      
    } catch (error) {
      logger.error('クエリデータの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * パフォーマンスデータを取得
   * @private
   */
  async fetchPerformanceData(siteUrl, startDate, endDate) {
    try {
      const data = await gscApiClient.getDailySearchAnalytics({
        siteUrl,
        startDate,
        endDate,
        dimensions: this.dimensions.performance
      });
      
      // データを整形
      const formattedData = data.rows.map(row => ({
        site_url: siteUrl,
        date: row.keys[0],
        data_type: 'total',
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position
      }));
      
      // 保存
      const result = await PerformanceData.save(formattedData);
      
      return {
        dataType: 'performance',
        totalRows: data.rows.length,
        savedCount: result.saved
      };
      
    } catch (error) {
      logger.error('パフォーマンスデータの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * デバイス別データを取得
   * @private
   */
  async fetchDeviceData(siteUrl, startDate, endDate) {
    try {
      const data = await gscApiClient.getSearchAnalytics({
        siteUrl,
        startDate,
        endDate,
        dimensions: this.dimensions.device
      });
      
      // データを整形
      const formattedData = data.rows.map(row => ({
        site_url: siteUrl,
        date: row.keys[0],
        data_type: 'device',
        dimension_name: 'device',
        dimension_value: row.keys[1],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position
      }));
      
      // 保存
      const result = await PerformanceData.save(formattedData);
      
      return {
        dataType: 'device',
        totalRows: data.rows.length,
        savedCount: result.saved
      };
      
    } catch (error) {
      logger.error('デバイス別データの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * 国別データを取得
   * @private
   */
  async fetchCountryData(siteUrl, startDate, endDate) {
    try {
      const data = await gscApiClient.getSearchAnalytics({
        siteUrl,
        startDate,
        endDate,
        dimensions: this.dimensions.country
      });
      
      // データを整形
      const formattedData = data.rows.map(row => ({
        site_url: siteUrl,
        date: row.keys[0],
        data_type: 'country',
        dimension_name: 'country',
        dimension_value: row.keys[1],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position
      }));
      
      // 保存
      const result = await PerformanceData.save(formattedData);
      
      return {
        dataType: 'country',
        totalRows: data.rows.length,
        savedCount: result.saved
      };
      
    } catch (error) {
      logger.error('国別データの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * 増分同期を実行
   * @param {Object} params - 同期パラメータ
   * @returns {Object} 同期結果
   */
  async incrementalSync(params) {
    const {
      siteUrl,
      daysBack = 7,
      dataTypes = ['query', 'performance']
    } = params;
    
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
      
      logger.info('増分同期を開始します', {
        siteUrl,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dataTypes
      });
      
      const result = await this.syncAllData({
        siteUrl,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dataTypes
      });
      
      logger.info('増分同期が完了しました', result);
      
      return result;
      
    } catch (error) {
      logger.error('増分同期でエラーが発生しました', { error });
      throw error;
    }
  }

  /**
   * 特定URLのデータを取得
   * @param {Object} params - 取得パラメータ
   * @returns {Object} 取得結果
   */
  async fetchUrlData(params) {
    const {
      siteUrl,
      inspectionUrl,
      startDate,
      endDate
    } = params;
    
    try {
      // URL検査を実行
      const inspectionResult = await gscApiClient.inspectUrl(siteUrl, inspectionUrl);
      
      // URLのパフォーマンスデータを取得
      const performanceData = await gscApiClient.getSearchAnalytics({
        siteUrl,
        startDate,
        endDate,
        dimensions: ['query'],
        filters: [{
          dimension: 'page',
          operator: 'equals',
          expression: inspectionUrl
        }]
      });
      
      return {
        inspection: inspectionResult,
        performance: performanceData
      };
      
    } catch (error) {
      logger.error('URLデータの取得に失敗しました', { error });
      throw error;
    }
  }

  /**
   * 日付範囲を分割
   * @private
   */
  splitDateRange(startDate, endDate) {
    const ranges = [];
    let currentStart = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentStart < end) {
      const currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + this.maxDaysPerRequest - 1);
      
      if (currentEnd > end) {
        currentEnd.setTime(end.getTime());
      }
      
      ranges.push({
        start: currentStart.toISOString().split('T')[0],
        end: currentEnd.toISOString().split('T')[0]
      });
      
      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }
    
    return ranges;
  }

  /**
   * キューの状態を取得
   * @returns {Object} キューの状態
   */
  getQueueStatus() {
    return this.queue.getStatus();
  }

  /**
   * データ取得をキャンセル
   */
  cancelFetch() {
    this.queue.clear();
    logger.info('データ取得がキャンセルされました');
    this.emit('fetchCancelled');
  }

  /**
   * リトライ設定を更新
   * @param {Object} config - リトライ設定
   */
  updateRetryConfig(config) {
    this.queue.updateRetryConfig(config);
    logger.info('リトライ設定が更新されました', config);
  }
}

module.exports = new DataFetchProcessor();