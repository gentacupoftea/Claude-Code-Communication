import * as express from 'express';
import { BigQuery, Dataset, Table } from '@google-cloud/bigquery';
import { PubSub } from '@google-cloud/pubsub';
import { logger } from '../config/logger';
import { DataLayerClient } from '../core/DataLayerClient';
import { EventBroker } from '../core/EventBroker';
import { MonitoringService } from '../core/MonitoringService';
import * as moment from 'moment-timezone';

interface AnalyticsConfig {
  projectId: string;
  datasetId: string;
  region: string;
}

interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  query: string;
  dimensions: string[];
  measures: string[];
  timeGranularity: 'hour' | 'day' | 'week' | 'month';
  cacheDuration: number;
}

interface DashboardDefinition {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  refreshInterval: number;
}

interface DashboardWidget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'map';
  metricId: string;
  config: any;
}

interface Report {
  id: string;
  name: string;
  description: string;
  metrics: string[];
  schedule?: string;
  format: 'pdf' | 'excel' | 'csv';
  recipients: string[];
}

export class AnalyticsService {
  private app: express.Application;
  private bigquery: BigQuery;
  private dataLayer: DataLayerClient;
  private eventBroker: EventBroker;
  private monitoring: MonitoringService;
  private config: AnalyticsConfig;
  private metrics: Map<string, MetricDefinition> = new Map();
  private dashboards: Map<string, DashboardDefinition> = new Map();
  private reports: Map<string, Report> = new Map();

  constructor(config: AnalyticsConfig) {
    this.config = config;
    this.app = express();
    this.bigquery = new BigQuery({ projectId: config.projectId });

    // Initialize services
    this.dataLayer = new DataLayerClient({
      projectId: config.projectId,
      region: config.region,
      firestore: { databaseId: 'shopify-mcp-db' },
      bigquery: { datasetId: config.datasetId },
      redis: {
        host: 'localhost',
        port: 6379
      },
      storage: { bucketName: `${config.projectId}-analytics` }
    });

    this.eventBroker = new EventBroker({
      projectId: config.projectId,
      region: config.region
    });

    this.monitoring = new MonitoringService({
      projectId: config.projectId,
      region: config.region,
      serviceName: 'analytics-service',
      environment: process.env.ENVIRONMENT || 'production'
    });

    this.setupRoutes();
    this.setupDefaultMetrics();
    this.setupEventProcessing();
  }

  private setupRoutes(): void {
    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: 'analytics' });
    });

    // Metrics endpoints
    this.app.get('/metrics', this.handleListMetrics.bind(this));
    this.app.get('/metrics/:id', this.handleGetMetric.bind(this));
    this.app.post('/metrics', this.handleCreateMetric.bind(this));
    this.app.put('/metrics/:id', this.handleUpdateMetric.bind(this));
    this.app.delete('/metrics/:id', this.handleDeleteMetric.bind(this));
    this.app.post('/metrics/:id/query', this.handleQueryMetric.bind(this));

    // Dashboard endpoints
    this.app.get('/dashboards', this.handleListDashboards.bind(this));
    this.app.get('/dashboards/:id', this.handleGetDashboard.bind(this));
    this.app.post('/dashboards', this.handleCreateDashboard.bind(this));
    this.app.put('/dashboards/:id', this.handleUpdateDashboard.bind(this));
    this.app.delete('/dashboards/:id', this.handleDeleteDashboard.bind(this));
    this.app.get('/dashboards/:id/data', this.handleGetDashboardData.bind(this));

    // Report endpoints
    this.app.get('/reports', this.handleListReports.bind(this));
    this.app.get('/reports/:id', this.handleGetReport.bind(this));
    this.app.post('/reports', this.handleCreateReport.bind(this));
    this.app.put('/reports/:id', this.handleUpdateReport.bind(this));
    this.app.delete('/reports/:id', this.handleDeleteReport.bind(this));
    this.app.post('/reports/:id/generate', this.handleGenerateReport.bind(this));
    this.app.post('/reports/:id/schedule', this.handleScheduleReport.bind(this));

    // Analytics query endpoints
    this.app.post('/query', this.handleQuery.bind(this));
    this.app.get('/query/saved', this.handleListSavedQueries.bind(this));
    this.app.post('/query/save', this.handleSaveQuery.bind(this));

    // Real-time analytics
    this.app.get('/realtime/:shopId', this.handleRealtimeAnalytics.bind(this));
    this.app.ws('/realtime/:shopId/stream', this.handleRealtimeStream.bind(this));

    // Data export
    this.app.post('/export', this.handleExportData.bind(this));
  }

  private setupDefaultMetrics(): void {
    // Revenue metrics
    this.registerMetric({
      id: 'total_revenue',
      name: '総売上',
      description: '指定期間の総売上高',
      query: `
        SELECT 
          DATE_TRUNC(created_at, @timeGranularity) as date,
          shop_id,
          SUM(total_price) as revenue,
          COUNT(DISTINCT id) as order_count,
          AVG(total_price) as avg_order_value
        FROM shopify_data.orders
        WHERE created_at >= @startDate AND created_at <= @endDate
          AND shop_id = @shopId
        GROUP BY date, shop_id
        ORDER BY date DESC
      `,
      dimensions: ['date', 'shop_id'],
      measures: ['revenue', 'order_count', 'avg_order_value'],
      timeGranularity: 'day',
      cacheDuration: 3600
    });

    // Product performance
    this.registerMetric({
      id: 'product_performance',
      name: '商品パフォーマンス',
      description: 'Top performing products by revenue',
      query: `
        SELECT 
          p.id as product_id,
          p.title as product_name,
          COUNT(DISTINCT o.id) as order_count,
          SUM(JSON_EXTRACT_SCALAR(oi, '$.quantity')) as units_sold,
          SUM(CAST(JSON_EXTRACT_SCALAR(oi, '$.price') AS FLOAT64) * 
              CAST(JSON_EXTRACT_SCALAR(oi, '$.quantity') AS INT64)) as revenue
        FROM shopify_data.orders o
        CROSS JOIN UNNEST(JSON_EXTRACT_ARRAY(o.data, '$.line_items')) as oi
        JOIN shopify_data.products p 
          ON p.id = CAST(JSON_EXTRACT_SCALAR(oi, '$.product_id') AS STRING)
        WHERE o.created_at >= @startDate AND o.created_at <= @endDate
          AND o.shop_id = @shopId
        GROUP BY product_id, product_name
        ORDER BY revenue DESC
        LIMIT 50
      `,
      dimensions: ['product_id', 'product_name'],
      measures: ['order_count', 'units_sold', 'revenue'],
      timeGranularity: 'day',
      cacheDuration: 7200
    });

    // Customer analytics
    this.registerMetric({
      id: 'customer_segments',
      name: '顧客セグメント',
      description: 'Customer segmentation based on purchase behavior',
      query: `
        WITH customer_stats AS (
          SELECT 
            customer_id,
            COUNT(DISTINCT id) as order_count,
            SUM(total_price) as total_spent,
            MAX(created_at) as last_order_date,
            MIN(created_at) as first_order_date,
            DATE_DIFF(CURRENT_DATE(), DATE(MAX(created_at)), DAY) as days_since_last_order
          FROM shopify_data.orders
          WHERE shop_id = @shopId
            AND customer_id IS NOT NULL
          GROUP BY customer_id
        )
        SELECT 
          CASE 
            WHEN order_count >= 5 AND days_since_last_order <= 30 THEN 'VIP Active'
            WHEN order_count >= 5 AND days_since_last_order > 30 THEN 'VIP Inactive'
            WHEN order_count >= 2 AND days_since_last_order <= 60 THEN 'Regular'
            WHEN order_count = 1 AND days_since_last_order <= 90 THEN 'New'
            ELSE 'At Risk'
          END as segment,
          COUNT(*) as customer_count,
          AVG(order_count) as avg_orders,
          AVG(total_spent) as avg_lifetime_value
        FROM customer_stats
        GROUP BY segment
      `,
      dimensions: ['segment'],
      measures: ['customer_count', 'avg_orders', 'avg_lifetime_value'],
      timeGranularity: 'day',
      cacheDuration: 21600
    });

    // Geographic distribution
    this.registerMetric({
      id: 'geographic_distribution',
      name: '地域別売上分布',
      description: 'Revenue distribution by geographic location',
      query: `
        SELECT 
          JSON_EXTRACT_SCALAR(data, '$.shipping_address.country') as country,
          JSON_EXTRACT_SCALAR(data, '$.shipping_address.province') as province,
          COUNT(DISTINCT id) as order_count,
          SUM(total_price) as revenue,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM shopify_data.orders
        WHERE created_at >= @startDate AND created_at <= @endDate
          AND shop_id = @shopId
          AND JSON_EXTRACT_SCALAR(data, '$.shipping_address.country') IS NOT NULL
        GROUP BY country, province
        ORDER BY revenue DESC
      `,
      dimensions: ['country', 'province'],
      measures: ['order_count', 'revenue', 'unique_customers'],
      timeGranularity: 'day',
      cacheDuration: 14400
    });

    // Conversion funnel
    this.registerMetric({
      id: 'conversion_funnel',
      name: 'コンバージョンファネル',
      description: 'E-commerce conversion funnel analysis',
      query: `
        WITH funnel_events AS (
          SELECT 
            DATE_TRUNC(timestamp, @timeGranularity) as date,
            event_type,
            COUNT(DISTINCT session_id) as sessions
          FROM analytics.events
          WHERE timestamp >= @startDate AND timestamp <= @endDate
            AND shop_id = @shopId
            AND event_type IN ('page_view', 'product_view', 'add_to_cart', 'checkout_start', 'purchase')
          GROUP BY date, event_type
        )
        SELECT 
          date,
          SUM(CASE WHEN event_type = 'page_view' THEN sessions ELSE 0 END) as page_views,
          SUM(CASE WHEN event_type = 'product_view' THEN sessions ELSE 0 END) as product_views,
          SUM(CASE WHEN event_type = 'add_to_cart' THEN sessions ELSE 0 END) as cart_additions,
          SUM(CASE WHEN event_type = 'checkout_start' THEN sessions ELSE 0 END) as checkout_starts,
          SUM(CASE WHEN event_type = 'purchase' THEN sessions ELSE 0 END) as purchases
        FROM funnel_events
        GROUP BY date
        ORDER BY date DESC
      `,
      dimensions: ['date'],
      measures: ['page_views', 'product_views', 'cart_additions', 'checkout_starts', 'purchases'],
      timeGranularity: 'day',
      cacheDuration: 3600
    });
  }

  private setupEventProcessing(): void {
    // Subscribe to analytics events
    this.eventBroker.subscribe('analytics-subscription', {
      id: 'analytics-processor',
      eventType: /^analytics\./,
      handler: this.processAnalyticsEvent.bind(this)
    });

    // Subscribe to Shopify events for real-time analytics
    this.eventBroker.subscribe('shopify-subscription', {
      id: 'shopify-analytics-processor',
      eventType: /^shopify\./,
      handler: this.processShopifyEvent.bind(this)
    });
  }

  private registerMetric(metric: MetricDefinition): void {
    this.metrics.set(metric.id, metric);
    logger.info(`Registered metric: ${metric.id}`);
  }

  // Metric handlers
  private async handleListMetrics(req: express.Request, res: express.Response): Promise<void> {
    try {
      const metrics = Array.from(this.metrics.values()).map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        dimensions: m.dimensions,
        measures: m.measures,
        timeGranularity: m.timeGranularity
      }));

      res.json(metrics);
    } catch (error) {
      logger.error('List metrics error', { error });
      res.status(500).json({ error: 'Failed to list metrics' });
    }
  }

  private async handleGetMetric(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const metric = this.metrics.get(id);

      if (!metric) {
        res.status(404).json({ error: 'Metric not found' });
        return;
      }

      res.json(metric);
    } catch (error) {
      logger.error('Get metric error', { error });
      res.status(500).json({ error: 'Failed to get metric' });
    }
  }

  private async handleCreateMetric(req: express.Request, res: express.Response): Promise<void> {
    try {
      const metric = req.body as MetricDefinition;
      
      // Validate metric
      if (!metric.id || !metric.query) {
        res.status(400).json({ error: 'Invalid metric definition' });
        return;
      }

      // Save to Firestore
      await this.dataLayer.firestoreSet('metrics', metric.id, metric);
      
      // Register in memory
      this.registerMetric(metric);

      res.status(201).json(metric);
    } catch (error) {
      logger.error('Create metric error', { error });
      res.status(500).json({ error: 'Failed to create metric' });
    }
  }

  private async handleUpdateMetric(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const metric = this.metrics.get(id);
      if (!metric) {
        res.status(404).json({ error: 'Metric not found' });
        return;
      }

      const updatedMetric = { ...metric, ...updates };
      
      // Save to Firestore
      await this.dataLayer.firestoreSet('metrics', id, updatedMetric);
      
      // Update in memory
      this.metrics.set(id, updatedMetric);

      res.json(updatedMetric);
    } catch (error) {
      logger.error('Update metric error', { error });
      res.status(500).json({ error: 'Failed to update metric' });
    }
  }

  private async handleDeleteMetric(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;

      // Delete from Firestore
      await this.dataLayer.firestoreSet('metrics', id, null);
      
      // Remove from memory
      this.metrics.delete(id);

      res.status(204).end();
    } catch (error) {
      logger.error('Delete metric error', { error });
      res.status(500).json({ error: 'Failed to delete metric' });
    }
  }

  private async handleQueryMetric(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const { shopId, startDate, endDate, timeGranularity, filters } = req.body;

      const metric = this.metrics.get(id);
      if (!metric) {
        res.status(404).json({ error: 'Metric not found' });
        return;
      }

      // Check cache
      const cacheKey = `metric:${id}:${shopId}:${startDate}:${endDate}:${timeGranularity}`;
      const cached = await this.dataLayer.cacheGet(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      // Execute query
      const params = {
        shopId,
        startDate,
        endDate,
        timeGranularity: timeGranularity || metric.timeGranularity,
        ...filters
      };

      const results = await this.executeMetricQuery(metric, params);

      // Cache results
      await this.dataLayer.cacheSet(cacheKey, results, { ttl: metric.cacheDuration });

      res.json(results);
    } catch (error) {
      logger.error('Query metric error', { error });
      res.status(500).json({ error: 'Failed to query metric' });
    }
  }

  // Dashboard handlers
  private async handleListDashboards(req: express.Request, res: express.Response): Promise<void> {
    try {
      const dashboards = await this.dataLayer.firestoreQuery('dashboards', {
        orderBy: [{ field: 'name', direction: 'asc' }]
      });

      res.json(dashboards);
    } catch (error) {
      logger.error('List dashboards error', { error });
      res.status(500).json({ error: 'Failed to list dashboards' });
    }
  }

  private async handleGetDashboard(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const dashboard = await this.dataLayer.firestoreGet('dashboards', id);

      if (!dashboard) {
        res.status(404).json({ error: 'Dashboard not found' });
        return;
      }

      res.json(dashboard);
    } catch (error) {
      logger.error('Get dashboard error', { error });
      res.status(500).json({ error: 'Failed to get dashboard' });
    }
  }

  private async handleCreateDashboard(req: express.Request, res: express.Response): Promise<void> {
    try {
      const dashboard = req.body as DashboardDefinition;
      
      // Validate dashboard
      if (!dashboard.id || !dashboard.name) {
        res.status(400).json({ error: 'Invalid dashboard definition' });
        return;
      }

      // Save to Firestore
      await this.dataLayer.firestoreSet('dashboards', dashboard.id, dashboard);

      res.status(201).json(dashboard);
    } catch (error) {
      logger.error('Create dashboard error', { error });
      res.status(500).json({ error: 'Failed to create dashboard' });
    }
  }

  private async handleGetDashboardData(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const { shopId, startDate, endDate } = req.query;

      const dashboard = await this.dataLayer.firestoreGet('dashboards', id) as DashboardDefinition;
      if (!dashboard) {
        res.status(404).json({ error: 'Dashboard not found' });
        return;
      }

      // Fetch data for all widgets
      const widgetData = await Promise.all(
        dashboard.widgets.map(async widget => {
          const metric = this.metrics.get(widget.metricId);
          if (!metric) {
            return { widgetId: widget.id, error: 'Metric not found' };
          }

          const data = await this.executeMetricQuery(metric, {
            shopId: shopId as string,
            startDate: startDate as string,
            endDate: endDate as string
          });

          return {
            widgetId: widget.id,
            type: widget.type,
            config: widget.config,
            data
          };
        })
      );

      res.json({
        dashboard,
        data: widgetData,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Get dashboard data error', { error });
      res.status(500).json({ error: 'Failed to get dashboard data' });
    }
  }

  // Report handlers
  private async handleListReports(req: express.Request, res: express.Response): Promise<void> {
    try {
      const reports = await this.dataLayer.firestoreQuery('reports', {
        orderBy: [{ field: 'name', direction: 'asc' }]
      });

      res.json(reports);
    } catch (error) {
      logger.error('List reports error', { error });
      res.status(500).json({ error: 'Failed to list reports' });
    }
  }

  private async handleCreateReport(req: express.Request, res: express.Response): Promise<void> {
    try {
      const report = req.body as Report;
      
      // Validate report
      if (!report.id || !report.name || !report.metrics?.length) {
        res.status(400).json({ error: 'Invalid report definition' });
        return;
      }

      // Save to Firestore
      await this.dataLayer.firestoreSet('reports', report.id, report);

      // Schedule if needed
      if (report.schedule) {
        await this.scheduleReport(report);
      }

      res.status(201).json(report);
    } catch (error) {
      logger.error('Create report error', { error });
      res.status(500).json({ error: 'Failed to create report' });
    }
  }

  private async handleGenerateReport(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const { shopId, startDate, endDate } = req.body;

      const report = await this.dataLayer.firestoreGet('reports', id) as Report;
      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }

      // Generate report asynchronously
      this.generateReport(report, shopId, startDate, endDate).catch(error => {
        logger.error('Report generation failed', { error, reportId: id });
      });

      res.json({ message: 'Report generation started', reportId: id });
    } catch (error) {
      logger.error('Generate report error', { error });
      res.status(500).json({ error: 'Failed to generate report' });
    }
  }

  // Query handlers
  private async handleQuery(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { query, params } = req.body;

      // Execute query with proper permissions check
      const results = await this.bigquery.query({
        query,
        params,
        location: this.config.region
      });

      res.json({
        results: results[0],
        metadata: {
          totalRows: results[0].length,
          fields: results[1].schema?.fields
        }
      });
    } catch (error) {
      logger.error('Query error', { error });
      res.status(500).json({ error: 'Failed to execute query' });
    }
  }

  // Real-time analytics
  private async handleRealtimeAnalytics(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { shopId } = req.params;
      
      // Get real-time metrics from memory/cache
      const realtime = await this.getRealtimeMetrics(shopId);
      
      res.json(realtime);
    } catch (error) {
      logger.error('Realtime analytics error', { error });
      res.status(500).json({ error: 'Failed to get realtime analytics' });
    }
  }

  private async handleRealtimeStream(ws: any, req: express.Request): Promise<void> {
    const { shopId } = req.params;
    
    // Set up real-time event stream
    const subscription = this.eventBroker.createEventStream('realtime-events', {
      batchSize: 1,
      flushInterval: 1000
    });

    for await (const events of subscription) {
      const filtered = events.filter(e => e.data.shopId === shopId);
      if (filtered.length > 0) {
        ws.send(JSON.stringify(filtered));
      }
    }
  }

  // Helper methods
  private async executeMetricQuery(metric: MetricDefinition, params: any): Promise<any> {
    // Replace parameters in query
    let query = metric.query;
    for (const [key, value] of Object.entries(params)) {
      query = query.replace(new RegExp(`@${key}`, 'g'), `'${value}'`);
    }

    const [rows] = await this.bigquery.query({
      query,
      location: this.config.region
    });

    return {
      metric: {
        id: metric.id,
        name: metric.name,
        description: metric.description
      },
      data: rows,
      params,
      timestamp: new Date()
    };
  }

  private async generateReport(report: Report, shopId: string, startDate: string, endDate: string): Promise<void> {
    logger.info(`Generating report: ${report.id} for shop: ${shopId}`);

    try {
      // Fetch data for all metrics
      const metricData = await Promise.all(
        report.metrics.map(async metricId => {
          const metric = this.metrics.get(metricId);
          if (!metric) {
            return null;
          }

          return await this.executeMetricQuery(metric, {
            shopId,
            startDate,
            endDate
          });
        })
      );

      // Generate report file based on format
      let fileContent: Buffer;
      let fileName: string;

      switch (report.format) {
        case 'pdf':
          fileContent = await this.generatePDFReport(report, metricData);
          fileName = `${report.id}_${shopId}_${Date.now()}.pdf`;
          break;
        case 'excel':
          fileContent = await this.generateExcelReport(report, metricData);
          fileName = `${report.id}_${shopId}_${Date.now()}.xlsx`;
          break;
        case 'csv':
          fileContent = await this.generateCSVReport(report, metricData);
          fileName = `${report.id}_${shopId}_${Date.now()}.csv`;
          break;
        default:
          throw new Error(`Unsupported report format: ${report.format}`);
      }

      // Upload to storage
      const fileUrl = await this.dataLayer.storageUpload(
        `${this.config.projectId}-analytics`,
        `reports/${fileName}`,
        fileContent,
        {
          contentType: this.getContentType(report.format)
        }
      );

      // Send to recipients
      await this.sendReport(report, fileUrl);

      // Emit event
      await this.eventBroker.publish('analytics-events', 'report.generated', {
        reportId: report.id,
        shopId,
        fileName,
        fileUrl,
        recipients: report.recipients
      });

      logger.info(`Report generated: ${report.id} for shop: ${shopId}`);
    } catch (error) {
      logger.error('Report generation failed', { error, reportId: report.id });
      throw error;
    }
  }

  private async generatePDFReport(report: Report, data: any[]): Promise<Buffer> {
    // Implement PDF generation using a library like puppeteer or pdfkit
    // For now, return a placeholder
    return Buffer.from('PDF Report Content');
  }

  private async generateExcelReport(report: Report, data: any[]): Promise<Buffer> {
    // Implement Excel generation using a library like exceljs
    // For now, return a placeholder
    return Buffer.from('Excel Report Content');
  }

  private async generateCSVReport(report: Report, data: any[]): Promise<Buffer> {
    // Implement CSV generation
    const csv = data.map(metric => {
      if (!metric || !metric.data) return '';
      
      const headers = Object.keys(metric.data[0] || {}).join(',');
      const rows = metric.data.map((row: any) => 
        Object.values(row).join(',')
      ).join('\n');
      
      return `${metric.metric.name}\n${headers}\n${rows}`;
    }).join('\n\n');

    return Buffer.from(csv);
  }

  private getContentType(format: string): string {
    const types: Record<string, string> = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv'
    };
    return types[format] || 'application/octet-stream';
  }

  private async sendReport(report: Report, fileUrl: string): Promise<void> {
    // Send report to recipients via email or other notification method
    await this.eventBroker.publish('notification-events', 'email.send', {
      recipients: report.recipients,
      subject: `Analytics Report: ${report.name}`,
      body: `Your analytics report is ready: ${fileUrl}`,
      attachments: [{
        filename: fileUrl.split('/').pop(),
        url: fileUrl
      }]
    });
  }

  private async scheduleReport(report: Report): Promise<void> {
    // Schedule report using Cloud Scheduler or similar
    await this.eventBroker.registerScheduledTask({
      id: `report_${report.id}`,
      name: `Generate Report: ${report.name}`,
      schedule: report.schedule!,
      handler: async () => {
        // Generate report for all shops (or specific ones based on config)
        const shops = await this.dataLayer.firestoreQuery('shops');
        
        for (const shop of shops) {
          await this.generateReport(
            report,
            shop.id,
            moment().subtract(30, 'days').format('YYYY-MM-DD'),
            moment().format('YYYY-MM-DD')
          );
        }
      },
      timezone: 'Asia/Tokyo',
      enabled: true
    });
  }

  private async getRealtimeMetrics(shopId: string): Promise<any> {
    // Get real-time metrics from cache/memory
    const metrics = {
      activeUsers: await this.dataLayer.cacheGet(`realtime:${shopId}:active_users`) || 0,
      currentOrders: await this.dataLayer.cacheGet(`realtime:${shopId}:current_orders`) || 0,
      recentEvents: await this.dataLayer.cacheGet(`realtime:${shopId}:events`) || [],
      revenue: {
        today: await this.dataLayer.cacheGet(`realtime:${shopId}:revenue:today`) || 0,
        hour: await this.dataLayer.cacheGet(`realtime:${shopId}:revenue:hour`) || 0
      }
    };

    return metrics;
  }

  // Event processing
  private async processAnalyticsEvent(event: any): Promise<void> {
    // Process analytics events (page views, clicks, etc.)
    const { type, data } = event;

    // Update real-time metrics
    if (data.shopId) {
      await this.updateRealtimeMetrics(data.shopId, type, data);
    }

    // Store event for analysis
    await this.storeAnalyticsEvent(event);
  }

  private async processShopifyEvent(event: any): Promise<void> {
    // Process Shopify events for analytics
    const { type, data } = event;

    switch (type) {
      case 'shopify.order.created':
        await this.updateOrderMetrics(data);
        break;
      case 'shopify.product.viewed':
        await this.updateProductMetrics(data);
        break;
      case 'shopify.customer.created':
        await this.updateCustomerMetrics(data);
        break;
    }
  }

  private async updateRealtimeMetrics(shopId: string, eventType: string, data: any): Promise<void> {
    // Update real-time metrics in cache
    const key = `realtime:${shopId}`;
    
    switch (eventType) {
      case 'analytics.page_view':
        await this.dataLayer.cacheSet(
          `${key}:active_users`,
          await this.countActiveUsers(shopId),
          { ttl: 300 }
        );
        break;
      case 'analytics.order_created':
        await this.incrementCounter(`${key}:current_orders`);
        await this.incrementCounter(`${key}:revenue:today`, data.amount);
        await this.incrementCounter(`${key}:revenue:hour`, data.amount);
        break;
    }

    // Add to recent events
    const events = await this.dataLayer.cacheGet(`${key}:events`) || [];
    events.unshift({
      type: eventType,
      data,
      timestamp: new Date()
    });
    await this.dataLayer.cacheSet(
      `${key}:events`,
      events.slice(0, 100),
      { ttl: 300 }
    );
  }

  private async storeAnalyticsEvent(event: any): Promise<void> {
    // Store event in BigQuery for analysis
    await this.dataLayer.bigqueryInsert('analytics', 'events', [{
      event_id: event.id,
      event_type: event.type,
      shop_id: event.data.shopId,
      user_id: event.data.userId,
      session_id: event.data.sessionId,
      timestamp: event.timestamp,
      data: JSON.stringify(event.data)
    }]);
  }

  private async updateOrderMetrics(data: any): Promise<void> {
    // Update order-related metrics
    await this.monitoring.recordBusinessMetric('order_created', 1, {
      shop: data.shopId,
      amount: data.totalPrice.toString()
    });
  }

  private async updateProductMetrics(data: any): Promise<void> {
    // Update product-related metrics
    await this.monitoring.recordBusinessMetric('product_viewed', 1, {
      shop: data.shopId,
      product: data.productId
    });
  }

  private async updateCustomerMetrics(data: any): Promise<void> {
    // Update customer-related metrics
    await this.monitoring.recordBusinessMetric('customer_created', 1, {
      shop: data.shopId
    });
  }

  private async countActiveUsers(shopId: string): Promise<number> {
    // Query active users in the last 5 minutes
    const query = `
      SELECT COUNT(DISTINCT session_id) as active_users
      FROM analytics.events
      WHERE shop_id = @shopId
        AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
    `;

    const [rows] = await this.bigquery.query({
      query,
      params: { shopId },
      location: this.config.region
    });

    return rows[0]?.active_users || 0;
  }

  private async incrementCounter(key: string, amount: number = 1): Promise<void> {
    const current = await this.dataLayer.cacheGet(key) || 0;
    await this.dataLayer.cacheSet(key, current + amount, { ttl: 300 });
  }

  // Export functionality
  private async handleExportData(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { query, format, destination } = req.body;

      // Execute query
      const [rows] = await this.bigquery.query({
        query,
        location: this.config.region
      });

      // Export data
      let exportUrl: string;
      
      switch (format) {
        case 'csv':
          exportUrl = await this.exportToCSV(rows, destination);
          break;
        case 'json':
          exportUrl = await this.exportToJSON(rows, destination);
          break;
        case 'bigquery':
          exportUrl = await this.exportToBigQuery(query, destination);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      res.json({ exportUrl, rowCount: rows.length });
    } catch (error) {
      logger.error('Export data error', { error });
      res.status(500).json({ error: 'Failed to export data' });
    }
  }

  private async exportToCSV(data: any[], destination: string): Promise<string> {
    const csv = this.convertToCSV(data);
    const fileName = `export_${Date.now()}.csv`;
    
    return await this.dataLayer.storageUpload(
      `${this.config.projectId}-analytics`,
      `exports/${fileName}`,
      Buffer.from(csv),
      { contentType: 'text/csv' }
    );
  }

  private async exportToJSON(data: any[], destination: string): Promise<string> {
    const json = JSON.stringify(data, null, 2);
    const fileName = `export_${Date.now()}.json`;
    
    return await this.dataLayer.storageUpload(
      `${this.config.projectId}-analytics`,
      `exports/${fileName}`,
      Buffer.from(json),
      { contentType: 'application/json' }
    );
  }

  private async exportToBigQuery(query: string, destination: string): Promise<string> {
    const [datasetId, tableId] = destination.split('.');
    
    const [job] = await this.bigquery.createQueryJob({
      query,
      destination: this.bigquery.dataset(datasetId).table(tableId),
      location: this.config.region,
      writeDisposition: 'WRITE_TRUNCATE'
    });

    await job.promise();
    return `${this.config.projectId}.${destination}`;
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => row[h]).join(','));
    
    return [headers.join(','), ...rows].join('\n');
  }

  // Service lifecycle
  async start(port: number = 3006): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        logger.info(`Analytics service started on port ${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await this.dataLayer.close();
    await this.monitoring.close();
  }
}