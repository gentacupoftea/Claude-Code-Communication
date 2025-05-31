/**
 * BigQuery Storage Service
 * チャートデータとダッシュボード設定の永続化を管理
 */

const { BigQuery } = require('@google-cloud/bigquery');
const { v4: uuidv4 } = require('uuid');

class BigQueryStorageService {
  constructor() {
    // 環境変数チェック
    if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
      console.warn('⚠️  GOOGLE_CLOUD_PROJECT_ID not set - BigQuery features disabled');
      this.enabled = false;
      return;
    }

    try {
      this.bigquery = new BigQuery({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
      });
      this.datasetId = 'conea_analytics';
      this.enabled = true;
      
      // テーブルの初期化
      this.initializeTables().catch(console.error);
    } catch (error) {
      console.error('BigQuery initialization error:', error);
      this.enabled = false;
    }
  }

  /**
   * テーブルの初期化
   */
  async initializeTables() {
    if (!this.enabled) return;

    try {
      // データセットの作成
      const [datasets] = await this.bigquery.getDatasets();
      const datasetExists = datasets.some(ds => ds.id === this.datasetId);
      
      if (!datasetExists) {
        await this.bigquery.createDataset(this.datasetId, {
          location: 'asia-northeast1'
        });
        console.log('✅ BigQueryデータセット作成: conea_analytics');
      }

      // processed_queries テーブル
      await this.createTableIfNotExists('processed_queries', [
        { name: 'query_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'user_query', type: 'STRING', mode: 'REQUIRED' },
        { name: 'processed_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'ai_provider', type: 'STRING' },
        { name: 'api_calls', type: 'STRING' }, // JSON as STRING
        { name: 'processing_time_ms', type: 'INTEGER' },
        { name: 'status', type: 'STRING' },
        { name: 'error_message', type: 'STRING' }
      ]);

      // chart_data テーブル
      await this.createTableIfNotExists('chart_data', [
        { name: 'chart_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'query_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'chart_type', type: 'STRING', mode: 'REQUIRED' },
        { name: 'chart_title', type: 'STRING' },
        { name: 'data_points', type: 'STRING', mode: 'REQUIRED' }, // JSON as STRING
        { name: 'chart_config', type: 'STRING' }, // JSON as STRING
        { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'is_public', type: 'BOOLEAN' },
        { name: 'tags', type: 'STRING', mode: 'REPEATED' }
      ]);

      // aggregated_data テーブル
      await this.createTableIfNotExists('aggregated_data', [
        { name: 'aggregation_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'query_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'source_api', type: 'STRING', mode: 'REQUIRED' },
        { name: 'aggregation_type', type: 'STRING' },
        { name: 'result_data', type: 'STRING', mode: 'REQUIRED' }, // JSON as STRING
        { name: 'metadata', type: 'STRING' }, // JSON as STRING
        { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'cache_ttl_seconds', type: 'INTEGER' }
      ]);

      // dashboard_configs テーブル
      await this.createTableIfNotExists('dashboard_configs', [
        { name: 'dashboard_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'dashboard_name', type: 'STRING' },
        { name: 'chart_ids', type: 'STRING', mode: 'REPEATED' },
        { name: 'layout_config', type: 'STRING' }, // JSON as STRING
        { name: 'auto_refresh', type: 'BOOLEAN' },
        { name: 'refresh_interval_seconds', type: 'INTEGER' },
        { name: 'is_public', type: 'BOOLEAN' },
        { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
      ]);

      console.log('✅ BigQueryテーブル初期化完了');

    } catch (error) {
      console.error('BigQueryテーブル初期化エラー:', error);
    }
  }

  /**
   * テーブル作成ヘルパー
   */
  async createTableIfNotExists(tableName, schema) {
    if (!this.enabled) return;

    try {
      const table = this.bigquery.dataset(this.datasetId).table(tableName);
      const [exists] = await table.exists();
      
      if (!exists) {
        await table.create({ schema });
        console.log(`✅ テーブル作成: ${tableName}`);
      }
    } catch (error) {
      console.error(`テーブル作成エラー (${tableName}):`, error);
    }
  }

  /**
   * 処理済みクエリとデータを保存
   */
  async saveProcessedQuery(queryData, chartData, aggregatedData) {
    if (!this.enabled) {
      console.warn('BigQuery is not enabled');
      return { queryId: uuidv4(), chartId: uuidv4() };
    }

    const queryId = uuidv4();
    const chartId = uuidv4();
    const aggregationId = uuidv4();
    const timestamp = new Date();

    try {
      // 1. クエリ情報を保存
      await this.bigquery
        .dataset(this.datasetId)
        .table('processed_queries')
        .insert([{
          query_id: queryId,
          user_id: queryData.userId || 'anonymous',
          user_query: queryData.userQuery,
          processed_at: timestamp,
          ai_provider: queryData.aiProvider || 'claude',
          api_calls: JSON.stringify(queryData.apiCalls || []),
          processing_time_ms: queryData.processingTime || 0,
          status: 'success'
        }]);

      // 2. 集計データを保存
      await this.bigquery
        .dataset(this.datasetId)
        .table('aggregated_data')
        .insert([{
          aggregation_id: aggregationId,
          query_id: queryId,
          source_api: aggregatedData.sourceApi || 'unknown',
          aggregation_type: aggregatedData.aggregationType || 'none',
          result_data: JSON.stringify(aggregatedData.data || {}),
          metadata: JSON.stringify(aggregatedData.metadata || {}),
          created_at: timestamp,
          cache_ttl_seconds: 3600 // 1時間キャッシュ
        }]);

      // 3. チャートデータを保存
      await this.bigquery
        .dataset(this.datasetId)
        .table('chart_data')
        .insert([{
          chart_id: chartId,
          query_id: queryId,
          user_id: queryData.userId || 'anonymous',
          chart_type: chartData.chartType || 'bar',
          chart_title: this.generateChartTitle(queryData.userQuery, chartData.chartType),
          data_points: JSON.stringify(chartData.dataPoints || []),
          chart_config: JSON.stringify(chartData.chartConfig || {}),
          created_at: timestamp,
          is_public: false,
          tags: this.extractTags(queryData.userQuery)
        }]);

      console.log(`✅ データ保存成功 - Query: ${queryId}, Chart: ${chartId}`);
      return { queryId, chartId };

    } catch (error) {
      console.error('BigQuery保存エラー:', error);
      // フォールバック: IDだけ返す
      return { queryId, chartId };
    }
  }

  /**
   * ダッシュボードにチャートを追加
   */
  async addChartToDashboard(userId, chartId, dashboardId) {
    if (!this.enabled) {
      console.warn('BigQuery is not enabled');
      return uuidv4();
    }

    try {
      let targetDashboardId = dashboardId;
      
      if (!targetDashboardId) {
        // デフォルトダッシュボードを取得または作成
        targetDashboardId = await this.getOrCreateDefaultDashboard(userId);
      }

      // 現在のダッシュボード設定を取得
      const query = `
        SELECT * FROM \`${this.datasetId}.dashboard_configs\`
        WHERE dashboard_id = @dashboardId AND user_id = @userId
        LIMIT 1
      `;

      const [rows] = await this.bigquery.query({
        query,
        params: { dashboardId: targetDashboardId, userId }
      });

      if (rows.length > 0) {
        // 既存のダッシュボードを更新
        const dashboard = rows[0];
        const chartIds = dashboard.chart_ids || [];
        
        if (!chartIds.includes(chartId)) {
          chartIds.push(chartId);
          
          // BigQueryのUPDATEは制限があるため、新しい行を挿入
          await this.bigquery
            .dataset(this.datasetId)
            .table('dashboard_configs')
            .insert([{
              ...dashboard,
              chart_ids: chartIds,
              updated_at: new Date()
            }]);
        }
      }

      console.log(`✅ チャート ${chartId} をダッシュボード ${targetDashboardId} に追加`);
      return targetDashboardId;

    } catch (error) {
      console.error('ダッシュボード更新エラー:', error);
      return dashboardId || uuidv4();
    }
  }

  /**
   * ダッシュボードデータを読み込み
   */
  async loadDashboard(userId, dashboardId) {
    if (!this.enabled) {
      console.warn('BigQuery is not enabled');
      return null;
    }

    try {
      // シンプルなクエリに変更（JOINを使わない）
      const dashboardQuery = `
        SELECT * FROM \`${this.datasetId}.dashboard_configs\`
        WHERE user_id = @userId
        ${dashboardId ? 'AND dashboard_id = @dashboardId' : ''}
        ORDER BY updated_at DESC
        LIMIT 1
      `;

      const params = { userId };
      if (dashboardId) {
        params.dashboardId = dashboardId;
      }

      const [dashboards] = await this.bigquery.query({ query: dashboardQuery, params });

      if (dashboards.length === 0) {
        return null;
      }

      const dashboard = dashboards[0];
      const chartIds = dashboard.chart_ids || [];

      // チャートデータを個別に取得
      const charts = [];
      for (const chartId of chartIds) {
        try {
          const chartQuery = `
            SELECT c.*, a.result_data, a.metadata, a.source_api
            FROM \`${this.datasetId}.chart_data\` c
            JOIN \`${this.datasetId}.aggregated_data\` a ON a.query_id = c.query_id
            WHERE c.chart_id = @chartId
            LIMIT 1
          `;

          const [chartRows] = await this.bigquery.query({
            query: chartQuery,
            params: { chartId }
          });

          if (chartRows.length > 0) {
            const chart = chartRows[0];
            charts.push({
              ...chart,
              data_points: JSON.parse(chart.data_points || '[]'),
              chart_config: JSON.parse(chart.chart_config || '{}'),
              result_data: JSON.parse(chart.result_data || '{}'),
              metadata: JSON.parse(chart.metadata || '{}')
            });
          }
        } catch (error) {
          console.error(`チャート ${chartId} の読み込みエラー:`, error);
        }
      }

      return {
        ...dashboard,
        layout_config: JSON.parse(dashboard.layout_config || '{}'),
        charts
      };

    } catch (error) {
      console.error('ダッシュボード読み込みエラー:', error);
      return null;
    }
  }

  /**
   * ヘルパーメソッド: チャートタイトル生成
   */
  generateChartTitle(query, chartType) {
    const date = new Date().toLocaleDateString('ja-JP');
    const shortQuery = query.length > 30 ? query.substring(0, 30) + '...' : query;
    return `${shortQuery} - ${chartType} (${date})`;
  }

  /**
   * ヘルパーメソッド: タグ抽出
   */
  extractTags(query) {
    const tags = [];
    
    if (query.includes('売上')) tags.push('sales');
    if (query.includes('在庫')) tags.push('inventory');
    if (query.includes('顧客')) tags.push('customer');
    if (query.includes('カテゴリ')) tags.push('category');
    if (query.includes('月')) tags.push('monthly');
    if (query.includes('日')) tags.push('daily');
    
    return tags;
  }

  /**
   * デフォルトダッシュボード作成
   */
  async getOrCreateDefaultDashboard(userId) {
    const dashboardId = uuidv4();
    const timestamp = new Date();

    try {
      await this.bigquery
        .dataset(this.datasetId)
        .table('dashboard_configs')
        .insert([{
          dashboard_id: dashboardId,
          user_id: userId,
          dashboard_name: 'メインダッシュボード',
          chart_ids: [],
          layout_config: JSON.stringify({
            columns: 2,
            gap: 20,
            responsive: true
          }),
          auto_refresh: true,
          refresh_interval_seconds: 300, // 5分
          is_public: false,
          created_at: timestamp,
          updated_at: timestamp
        }]);

      return dashboardId;
    } catch (error) {
      console.error('デフォルトダッシュボード作成エラー:', error);
      return dashboardId;
    }
  }
}

module.exports = BigQueryStorageService;
