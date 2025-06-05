import * as express from 'express';
import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import { CloudTasksClient } from '@google-cloud/tasks';
import { logger } from '../config/logger';
import { DataLayerClient } from '../core/DataLayerClient';
import { EventBroker } from '../core/EventBroker';
import { MonitoringService } from '../core/MonitoringService';
import * as ExcelJS from 'exceljs';
import * as csv from 'csv-writer';
import * as PDFDocument from 'pdfkit';
import * as archiver from 'archiver';
import * as moment from 'moment-timezone';

interface ExportConfig {
  projectId: string;
  region: string;
  bucketName: string;
  taskQueueName: string;
}

interface ExportJob {
  id: string;
  shopId: string;
  type: 'products' | 'orders' | 'customers' | 'inventory' | 'analytics' | 'all';
  format: 'csv' | 'excel' | 'json' | 'pdf';
  filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    category?: string;
    [key: string]: any;
  };
  options?: {
    includeImages?: boolean;
    includeMetadata?: boolean;
    timezone?: string;
    locale?: string;
    customFields?: string[];
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  fileUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  scheduledTime?: Date;
  recurring?: {
    schedule: string;
    enabled: boolean;
    lastRun?: Date;
    nextRun?: Date;
  };
}

interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  format: string;
  fields: {
    source: string;
    name: string;
    label: string;
    transform?: string;
  }[];
  filters: any;
  options: any;
}

export class ExportService {
  private app: express.Application;
  private bigquery: BigQuery;
  private storage: Storage;
  private cloudTasks: CloudTasksClient;
  private dataLayer: DataLayerClient;
  private eventBroker: EventBroker;
  private monitoring: MonitoringService;
  private config: ExportConfig;
  private bucket: any;
  private exportTemplates: Map<string, ExportTemplate> = new Map();

  constructor(config: ExportConfig) {
    this.config = config;
    this.app = express();
    this.bigquery = new BigQuery({ projectId: config.projectId });
    this.storage = new Storage({ projectId: config.projectId });
    this.cloudTasks = new CloudTasksClient();
    this.bucket = this.storage.bucket(config.bucketName);

    // Initialize services
    this.dataLayer = new DataLayerClient({
      projectId: config.projectId,
      region: config.region,
      firestore: { databaseId: 'shopify-mcp-db' },
      bigquery: { datasetId: 'shopify_data' },
      redis: {
        host: 'localhost',
        port: 6379
      },
      storage: { bucketName: config.bucketName }
    });

    this.eventBroker = new EventBroker({
      projectId: config.projectId,
      region: config.region
    });

    this.monitoring = new MonitoringService({
      projectId: config.projectId,
      region: config.region,
      serviceName: 'export-service',
      environment: process.env.ENVIRONMENT || 'production'
    });

    this.setupRoutes();
    this.setupTemplates();
    this.setupEventHandlers();
  }

  private setupRoutes(): void {
    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req: any, res: any) => {
      res.json({ status: 'healthy', service: 'export' });
    });

    // Export job endpoints
    this.app.post('/export', this.handleCreateExport.bind(this));
    this.app.get('/export/:id', this.handleGetExport.bind(this));
    this.app.get('/export', this.handleListExports.bind(this));
    this.app.delete('/export/:id', this.handleCancelExport.bind(this));
    this.app.get('/export/:id/download', this.handleDownloadExport.bind(this));

    // Template endpoints
    this.app.get('/templates', this.handleListTemplates.bind(this));
    this.app.get('/templates/:id', this.handleGetTemplate.bind(this));
    this.app.post('/templates', this.handleCreateTemplate.bind(this));
    this.app.put('/templates/:id', this.handleUpdateTemplate.bind(this));
    this.app.delete('/templates/:id', this.handleDeleteTemplate.bind(this));

    // Scheduled export endpoints
    this.app.post('/scheduled', this.handleCreateScheduledExport.bind(this));
    this.app.get('/scheduled', this.handleListScheduledExports.bind(this));
    this.app.put('/scheduled/:id', this.handleUpdateScheduledExport.bind(this));
    this.app.delete('/scheduled/:id', this.handleDeleteScheduledExport.bind(this));

    // Webhook for task processing
    this.app.post('/process/:id', this.handleProcessExport.bind(this));
  }

  private setupTemplates(): void {
    // Product export template
    this.exportTemplates.set('product_export', {
      id: 'product_export',
      name: '商品エクスポート',
      description: 'Shopify商品の標準エクスポートテンプレート',
      type: 'products',
      format: 'excel',
      fields: [
        { source: 'id', name: 'product_id', label: '商品ID' },
        { source: 'title', name: 'title', label: '商品名' },
        { source: 'vendor', name: 'vendor', label: 'ベンダー' },
        { source: 'product_type', name: 'category', label: 'カテゴリー' },
        { source: 'tags', name: 'tags', label: 'タグ' },
        { source: 'variants[0].price', name: 'price', label: '価格' },
        { source: 'variants[0].inventory_quantity', name: 'stock', label: '在庫数' },
        { source: 'created_at', name: 'created_date', label: '作成日' },
        { source: 'updated_at', name: 'updated_date', label: '更新日' }
      ],
      filters: {},
      options: {
        includeImages: true,
        includeMetadata: true
      }
    });

    // Order export template
    this.exportTemplates.set('order_export', {
      id: 'order_export',
      name: '注文エクスポート',
      description: '注文データの標準エクスポートテンプレート',
      type: 'orders',
      format: 'csv',
      fields: [
        { source: 'id', name: 'order_id', label: '注文ID' },
        { source: 'name', name: 'order_number', label: '注文番号' },
        { source: 'created_at', name: 'order_date', label: '注文日' },
        { source: 'customer.email', name: 'customer_email', label: '顧客Email' },
        { source: 'total_price', name: 'total', label: '合計金額' },
        { source: 'financial_status', name: 'payment_status', label: '支払い状況' },
        { source: 'fulfillment_status', name: 'fulfillment_status', label: '発送状況' },
        { source: 'shipping_address.city', name: 'shipping_city', label: '配送先市区町村' },
        { source: 'shipping_address.province', name: 'shipping_province', label: '配送先都道府県' }
      ],
      filters: {},
      options: {
        timezone: 'Asia/Tokyo',
        locale: 'ja-JP'
      }
    });

    // Customer export template
    this.exportTemplates.set('customer_export', {
      id: 'customer_export',
      name: '顧客エクスポート',
      description: '顧客データの標準エクスポートテンプレート',
      type: 'customers',
      format: 'excel',
      fields: [
        { source: 'id', name: 'customer_id', label: '顧客ID' },
        { source: 'email', name: 'email', label: 'Email' },
        { source: 'first_name', name: 'first_name', label: '名' },
        { source: 'last_name', name: 'last_name', label: '姓' },
        { source: 'phone', name: 'phone', label: '電話番号' },
        { source: 'orders_count', name: 'order_count', label: '注文回数' },
        { source: 'total_spent', name: 'total_spent', label: '累計購入金額' },
        { source: 'created_at', name: 'registration_date', label: '登録日' },
        { source: 'updated_at', name: 'last_update', label: '最終更新日' }
      ],
      filters: {},
      options: {}
    });
  }

  private setupEventHandlers(): void {
    // Subscribe to export request events
    this.eventBroker.subscribe('export-requests', {
      id: 'export-processor',
      eventType: 'export.requested',
      handler: this.processExportRequest.bind(this)
    });

    // Subscribe to scheduled task events
    this.eventBroker.subscribe('scheduled-tasks', {
      id: 'scheduled-export-processor',
      eventType: 'scheduled.export',
      handler: this.processScheduledExport.bind(this)
    });
  }

  // Export handlers
  private async handleCreateExport(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { shopId, type, format, filters, options, templateId, scheduleTime } = req.body;

      // Validate input
      if (!shopId || !type || !format) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Create export job
      const exportJob: ExportJob = {
        id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        shopId,
        type,
        format,
        filters,
        options,
        status: 'pending',
        progress: 0,
        createdAt: new Date(),
        scheduledTime: scheduleTime ? new Date(scheduleTime) : undefined
      };

      // Save to Firestore
      await this.dataLayer.firestoreSet('export_jobs', exportJob.id, exportJob);

      // Schedule processing
      if (scheduleTime) {
        await this.scheduleExport(exportJob);
      } else {
        await this.queueExport(exportJob);
      }

      res.status(201).json({
        exportId: exportJob.id,
        status: exportJob.status,
        message: scheduleTime ? 'Export scheduled' : 'Export queued for processing'
      });
    } catch (error) {
      logger.error('Create export error', { error });
      res.status(500).json({ error: 'Failed to create export' });
    }
  }

  private async handleGetExport(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const exportJob = await this.dataLayer.firestoreGet('export_jobs', id);
      if (!exportJob) {
        res.status(404).json({ error: 'Export not found' });
        return;
      }

      res.json(exportJob);
    } catch (error) {
      logger.error('Get export error', { error });
      res.status(500).json({ error: 'Failed to get export' });
    }
  }

  private async handleListExports(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { shopId, status, limit = 50, offset = 0 } = req.query;

      const filters = [];
      if (shopId) {
        filters.push({ field: 'shopId', operator: '==', value: shopId });
      }
      if (status) {
        filters.push({ field: 'status', operator: '==', value: status });
      }

      const exports = await this.dataLayer.firestoreQuery('export_jobs', {
        where: filters,
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
        limit: Number(limit),
        offset: Number(offset)
      });

      res.json(exports);
    } catch (error) {
      logger.error('List exports error', { error });
      res.status(500).json({ error: 'Failed to list exports' });
    }
  }

  private async handleCancelExport(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;

      const exportJob = await this.dataLayer.firestoreGet('export_jobs', id) as ExportJob;
      if (!exportJob) {
        res.status(404).json({ error: 'Export not found' });
        return;
      }

      if (exportJob.status !== 'pending' && exportJob.status !== 'processing') {
        res.status(400).json({ error: 'Cannot cancel completed export' });
        return;
      }

      // Update status
      exportJob.status = 'failed';
      exportJob.error = 'Export cancelled by user';
      await this.dataLayer.firestoreSet('export_jobs', id, exportJob);

      res.json({ message: 'Export cancelled' });
    } catch (error) {
      logger.error('Cancel export error', { error });
      res.status(500).json({ error: 'Failed to cancel export' });
    }
  }

  private async handleDownloadExport(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;

      const exportJob = await this.dataLayer.firestoreGet('export_jobs', id) as ExportJob;
      if (!exportJob) {
        res.status(404).json({ error: 'Export not found' });
        return;
      }

      if (exportJob.status !== 'completed' || !exportJob.fileUrl) {
        res.status(400).json({ error: 'Export not ready for download' });
        return;
      }

      // Generate signed URL
      const signedUrl = await this.dataLayer.storageGenerateSignedUrl(
        this.config.bucketName,
        exportJob.fileUrl.replace(`gs://${this.config.bucketName}/`, ''),
        60 // 1 hour
      );

      res.json({ downloadUrl: signedUrl });
    } catch (error) {
      logger.error('Download export error', { error });
      res.status(500).json({ error: 'Failed to generate download URL' });
    }
  }

  // Template handlers
  private async handleListTemplates(req: express.Request, res: express.Response): Promise<void> {
    try {
      const templates = Array.from(this.exportTemplates.values());
      res.json(templates);
    } catch (error) {
      logger.error('List templates error', { error });
      res.status(500).json({ error: 'Failed to list templates' });
    }
  }

  private async handleGetTemplate(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const template = this.exportTemplates.get(id);

      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      res.json(template);
    } catch (error) {
      logger.error('Get template error', { error });
      res.status(500).json({ error: 'Failed to get template' });
    }
  }

  private async handleCreateTemplate(req: express.Request, res: express.Response): Promise<void> {
    try {
      const template = req.body as ExportTemplate;

      // Validate template
      if (!template.id || !template.name || !template.type || !template.format) {
        res.status(400).json({ error: 'Invalid template' });
        return;
      }

      // Save to Firestore
      await this.dataLayer.firestoreSet('export_templates', template.id, template);
      
      // Add to cache
      this.exportTemplates.set(template.id, template);

      res.status(201).json(template);
    } catch (error) {
      logger.error('Create template error', { error });
      res.status(500).json({ error: 'Failed to create template' });
    }
  }

  // Processing
  private async handleProcessExport(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;

      const exportJob = await this.dataLayer.firestoreGet('export_jobs', id) as ExportJob;
      if (!exportJob) {
        res.status(404).json({ error: 'Export not found' });
        return;
      }

      // Process export
      await this.processExport(exportJob);

      res.json({ message: 'Export processing started' });
    } catch (error) {
      logger.error('Process export error', { error });
      res.status(500).json({ error: 'Failed to process export' });
    }
  }

  private async processExport(job: ExportJob): Promise<void> {
    const startTime = Date.now();
    logger.info(`Processing export: ${job.id}`);

    try {
      // Update status
      job.status = 'processing';
      job.progress = 0;
      await this.dataLayer.firestoreSet('export_jobs', job.id, job);

      // Get data based on type
      let data: any[];
      switch (job.type) {
        case 'products':
          data = await this.getProductData(job.shopId, job.filters);
          break;
        case 'orders':
          data = await this.getOrderData(job.shopId, job.filters);
          break;
        case 'customers':
          data = await this.getCustomerData(job.shopId, job.filters);
          break;
        case 'inventory':
          data = await this.getInventoryData(job.shopId, job.filters);
          break;
        case 'analytics':
          data = await this.getAnalyticsData(job.shopId, job.filters);
          break;
        case 'all':
          data = await this.getAllData(job.shopId, job.filters);
          break;
        default:
          throw new Error(`Unsupported export type: ${job.type}`);
      }

      // Update progress
      job.progress = 50;
      await this.dataLayer.firestoreSet('export_jobs', job.id, job);

      // Generate file
      let file: Buffer;
      let fileName: string;
      switch (job.format) {
        case 'csv':
          file = await this.generateCSV(data, job);
          fileName = `${job.type}_${job.shopId}_${Date.now()}.csv`;
          break;
        case 'excel':
          file = await this.generateExcel(data, job);
          fileName = `${job.type}_${job.shopId}_${Date.now()}.xlsx`;
          break;
        case 'json':
          file = await this.generateJSON(data, job);
          fileName = `${job.type}_${job.shopId}_${Date.now()}.json`;
          break;
        case 'pdf':
          file = await this.generatePDF(data, job);
          fileName = `${job.type}_${job.shopId}_${Date.now()}.pdf`;
          break;
        default:
          throw new Error(`Unsupported export format: ${job.format}`);
      }

      // Upload file
      const filePath = `exports/${job.shopId}/${fileName}`;
      const fileUrl = await this.dataLayer.storageUpload(
        this.config.bucketName,
        filePath,
        file,
        {
          contentType: this.getContentType(job.format),
          metadata: {
            exportId: job.id,
            shopId: job.shopId,
            type: job.type,
            format: job.format
          }
        }
      );

      // Update job status
      job.status = 'completed';
      job.progress = 100;
      job.fileUrl = fileUrl;
      job.completedAt = new Date();
      await this.dataLayer.firestoreSet('export_jobs', job.id, job);

      // Emit completion event
      await this.eventBroker.publish('export-events', 'export.completed', {
        exportId: job.id,
        shopId: job.shopId,
        fileUrl,
        duration: Date.now() - startTime
      });

      // Send notification
      await this.sendCompletionNotification(job);

      logger.info(`Export completed: ${job.id} in ${Date.now() - startTime}ms`);
    } catch (error: any) {
      logger.error(`Export failed: ${job.id}`, { error });

      // Update job status
      job.status = 'failed';
      job.error = error.message;
      await this.dataLayer.firestoreSet('export_jobs', job.id, job);

      // Emit failure event
      await this.eventBroker.publish('export-events', 'export.failed', {
        exportId: job.id,
        shopId: job.shopId,
        error: error.message
      });

      throw error;
    }
  }

  // Data retrieval methods
  private async getProductData(shopId: string, filters?: any): Promise<any[]> {
    const query = `
      SELECT * FROM shopify_data.products
      WHERE shop_id = @shopId
      ${filters?.startDate ? 'AND created_at >= @startDate' : ''}
      ${filters?.endDate ? 'AND created_at <= @endDate' : ''}
      ${filters?.category ? 'AND JSON_EXTRACT_SCALAR(data, "$.product_type") = @category' : ''}
      ORDER BY created_at DESC
    `;

    const params = {
      shopId,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      category: filters?.category
    };

    const [rows] = await this.bigquery.query({ query, params, location: this.config.region });
    return rows;
  }

  private async getOrderData(shopId: string, filters?: any): Promise<any[]> {
    const query = `
      SELECT * FROM shopify_data.orders
      WHERE shop_id = @shopId
      ${filters?.startDate ? 'AND created_at >= @startDate' : ''}
      ${filters?.endDate ? 'AND created_at <= @endDate' : ''}
      ${filters?.status ? 'AND JSON_EXTRACT_SCALAR(data, "$.financial_status") = @status' : ''}
      ORDER BY created_at DESC
    `;

    const params = {
      shopId,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      status: filters?.status
    };

    const [rows] = await this.bigquery.query({ query, params, location: this.config.region });
    return rows;
  }

  private async getCustomerData(shopId: string, filters?: any): Promise<any[]> {
    const customers = await this.dataLayer.firestoreQuery('customers', {
      where: [{ field: 'shopId', operator: '==', value: shopId }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }]
    });

    return customers;
  }

  private async getInventoryData(shopId: string, filters?: any): Promise<any[]> {
    const inventory = await this.dataLayer.firestoreQuery('inventory', {
      where: [{ field: 'shopId', operator: '==', value: shopId }],
      orderBy: [{ field: 'updatedAt', direction: 'desc' }]
    });

    return inventory;
  }

  private async getAnalyticsData(shopId: string, filters?: any): Promise<any[]> {
    const query = `
      SELECT 
        DATE_TRUNC(created_at, DAY) as date,
        COUNT(DISTINCT id) as orders,
        SUM(total_price) as revenue,
        COUNT(DISTINCT customer_id) as customers
      FROM shopify_data.orders
      WHERE shop_id = @shopId
      ${filters?.startDate ? 'AND created_at >= @startDate' : ''}
      ${filters?.endDate ? 'AND created_at <= @endDate' : ''}
      GROUP BY date
      ORDER BY date DESC
    `;

    const params = {
      shopId,
      startDate: filters?.startDate,
      endDate: filters?.endDate
    };

    const [rows] = await this.bigquery.query({ query, params, location: this.config.region });
    return rows;
  }

  private async getAllData(shopId: string, filters?: any): Promise<any> {
    const [products, orders, customers, inventory, analytics] = await Promise.all([
      this.getProductData(shopId, filters),
      this.getOrderData(shopId, filters),
      this.getCustomerData(shopId, filters),
      this.getInventoryData(shopId, filters),
      this.getAnalyticsData(shopId, filters)
    ]);

    return {
      products,
      orders,
      customers,
      inventory,
      analytics
    };
  }

  // File generation methods
  private async generateCSV(data: any[], job: ExportJob): Promise<Buffer> {
    // Flatten JSON data for CSV
    const flatData = data.map(item => this.flattenObject(item));
    
    if (flatData.length === 0) {
      return Buffer.from('No data available');
    }

    const headers = Object.keys(flatData[0]);
    const rows = flatData.map(item => headers.map(h => item[h] || ''));
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => this.escapeCSV(cell)).join(','))
    ].join('\n');

    return Buffer.from(csvContent, 'utf-8');
  }

  private async generateExcel(data: any[], job: ExportJob): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(job.type);

    // Add headers
    if (data.length > 0) {
      const headers = Object.keys(this.flattenObject(data[0]));
      worksheet.addRow(headers);

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data
      data.forEach(item => {
        const flatItem = this.flattenObject(item);
        const row = headers.map(h => flatItem[h] || '');
        worksheet.addRow(row);
      });

      // Auto-fit columns
      worksheet.columns.forEach((column: any) => {
        let maxLength = 0;
        column.eachCell!({ includeEmpty: true }, (cell: any) => {
          const length = cell.value ? cell.value.toString().length : 0;
          maxLength = Math.max(maxLength, length);
        });
        column.width = Math.min(maxLength + 2, 50);
      });
    }

    // Add metadata sheet
    const metaSheet = workbook.addWorksheet('Export Info');
    metaSheet.addRow(['Export Date', new Date().toISOString()]);
    metaSheet.addRow(['Shop ID', job.shopId]);
    metaSheet.addRow(['Export Type', job.type]);
    metaSheet.addRow(['Total Records', data.length]);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async generateJSON(data: any[], job: ExportJob): Promise<Buffer> {
    const exportData = {
      metadata: {
        exportId: job.id,
        shopId: job.shopId,
        type: job.type,
        exportDate: new Date().toISOString(),
        totalRecords: data.length
      },
      data
    };

    return Buffer.from(JSON.stringify(exportData, null, 2), 'utf-8');
  }

  private async generatePDF(data: any[], job: ExportJob): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: any) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add title
      doc.fontSize(20).text(`${job.type.toUpperCase()} Export Report`, { align: 'center' });
      doc.moveDown();

      // Add metadata
      doc.fontSize(12);
      doc.text(`Shop ID: ${job.shopId}`);
      doc.text(`Export Date: ${new Date().toISOString()}`);
      doc.text(`Total Records: ${data.length}`);
      doc.moveDown();

      // Add data summary (first 10 records)
      doc.fontSize(14).text('Data Summary', { underline: true });
      doc.moveDown();

      const sampleData = data.slice(0, 10);
      sampleData.forEach((item, index) => {
        doc.fontSize(10);
        doc.text(`Record ${index + 1}:`, { bold: true });
        
        const flatItem = this.flattenObject(item);
        Object.entries(flatItem).slice(0, 5).forEach(([key, value]) => {
          doc.text(`  ${key}: ${value}`);
        });
        doc.moveDown();
      });

      if (data.length > 10) {
        doc.text(`... and ${data.length - 10} more records`);
      }

      doc.end();
    });
  }

  // Helper methods
  private flattenObject(obj: any, prefix = ''): any {
    const flattened: any = {};
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value === null || value === undefined) {
        flattened[newKey] = '';
      } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        flattened[newKey] = value.join(', ');
      } else if (value instanceof Date) {
        flattened[newKey] = value.toISOString();
      } else {
        flattened[newKey] = value.toString();
      }
    });
    
    return flattened;
  }

  private escapeCSV(value: any): string {
    if (value === null || value === undefined) return '';
    
    const str = value.toString();
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private getContentType(format: string): string {
    const types: Record<string, string> = {
      csv: 'text/csv',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      json: 'application/json',
      pdf: 'application/pdf'
    };
    return types[format] || 'application/octet-stream';
  }

  // Scheduling methods
  private async queueExport(job: ExportJob): Promise<void> {
    const parent = `projects/${this.config.projectId}/locations/${this.config.region}/queues/${this.config.taskQueueName}`;
    
    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url: `https://export-service.shopify-mcp.com/process/${job.id}`,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    };

    await this.cloudTasks.createTask({ parent, task });
    logger.info(`Export queued: ${job.id}`);
  }

  private async scheduleExport(job: ExportJob): Promise<void> {
    if (!job.scheduledTime) return;

    const parent = `projects/${this.config.projectId}/locations/${this.config.region}/queues/${this.config.taskQueueName}`;
    
    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url: `https://export-service.shopify-mcp.com/process/${job.id}`,
        headers: {
          'Content-Type': 'application/json'
        }
      },
      scheduleTime: {
        seconds: Math.floor(job.scheduledTime.getTime() / 1000)
      }
    };

    await this.cloudTasks.createTask({ parent, task });
    logger.info(`Export scheduled: ${job.id} for ${job.scheduledTime}`);
  }

  // Event handlers
  private async processExportRequest(event: any): Promise<void> {
    const { exportId } = event.data;
    
    const job = await this.dataLayer.firestoreGet('export_jobs', exportId) as ExportJob;
    if (!job) {
      logger.error(`Export job not found: ${exportId}`);
      return;
    }

    await this.processExport(job);
  }

  private async processScheduledExport(event: any): Promise<void> {
    const { exportId } = event.data;
    
    const job = await this.dataLayer.firestoreGet('scheduled_exports', exportId) as ExportJob;
    if (!job || !job.recurring?.enabled) {
      logger.error(`Scheduled export not found or disabled: ${exportId}`);
      return;
    }

    // Create new export job
    const newJob: ExportJob = {
      ...job,
      id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      progress: 0,
      createdAt: new Date()
    };

    await this.dataLayer.firestoreSet('export_jobs', newJob.id, newJob);
    await this.queueExport(newJob);

    // Update next run time
    job.recurring.lastRun = new Date();
    job.recurring.nextRun = this.calculateNextRun(job.recurring.schedule);
    await this.dataLayer.firestoreSet('scheduled_exports', exportId, job);
  }

  private calculateNextRun(schedule: string): Date {
    // Parse cron expression and calculate next run
    // This is a simplified version - would use a proper cron parser
    const now = new Date();
    now.setDate(now.getDate() + 1); // Daily for now
    return now;
  }

  // Notification methods
  private async sendCompletionNotification(job: ExportJob): Promise<void> {
    const shop = await this.dataLayer.firestoreGet('shops', job.shopId);
    if (!shop) return;

    await this.eventBroker.publish('notification-events', 'email.send', {
      to: shop.metadata?.email,
      subject: `エクスポートが完了しました - ${job.type}`,
      template: 'export_completed',
      data: {
        exportType: job.type,
        exportFormat: job.format,
        recordCount: job.options?.recordCount || 'N/A',
        downloadUrl: await this.dataLayer.storageGenerateSignedUrl(
          this.config.bucketName,
          job.fileUrl!.replace(`gs://${this.config.bucketName}/`, ''),
          24 * 60 // 24 hours
        )
      }
    });
  }

  // Scheduled exports
  private async handleCreateScheduledExport(req: express.Request, res: express.Response): Promise<void> {
    try {
      const scheduledExport = req.body;
      
      // Validate
      if (!scheduledExport.schedule || !scheduledExport.type) {
        res.status(400).json({ error: 'Invalid scheduled export' });
        return;
      }

      // Calculate next run
      scheduledExport.recurring = {
        schedule: scheduledExport.schedule,
        enabled: true,
        nextRun: this.calculateNextRun(scheduledExport.schedule)
      };

      // Save
      await this.dataLayer.firestoreSet('scheduled_exports', scheduledExport.id, scheduledExport);

      // Schedule task
      await this.eventBroker.registerScheduledTask({
        id: `scheduled_export_${scheduledExport.id}`,
        name: `Scheduled Export: ${scheduledExport.name}`,
        schedule: scheduledExport.schedule,
        handler: async () => {
          await this.processScheduledExport({
            data: { exportId: scheduledExport.id }
          });
        },
        timezone: 'Asia/Tokyo',
        enabled: true
      });

      res.status(201).json(scheduledExport);
    } catch (error) {
      logger.error('Create scheduled export error', { error });
      res.status(500).json({ error: 'Failed to create scheduled export' });
    }
  }

  private async handleListScheduledExports(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { shopId } = req.query;

      const filters = [];
      if (shopId) {
        filters.push({ field: 'shopId', operator: '==', value: shopId });
      }

      const scheduledExports = await this.dataLayer.firestoreQuery('scheduled_exports', {
        where: filters,
        orderBy: [{ field: 'createdAt', direction: 'desc' }]
      });

      res.json(scheduledExports);
    } catch (error) {
      logger.error('List scheduled exports error', { error });
      res.status(500).json({ error: 'Failed to list scheduled exports' });
    }
  }

  private async handleUpdateScheduledExport(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const scheduledExport = await this.dataLayer.firestoreGet('scheduled_exports', id);
      if (!scheduledExport) {
        res.status(404).json({ error: 'Scheduled export not found' });
        return;
      }

      // Update
      Object.assign(scheduledExport, updates);
      await this.dataLayer.firestoreSet('scheduled_exports', id, scheduledExport);

      res.json(scheduledExport);
    } catch (error) {
      logger.error('Update scheduled export error', { error });
      res.status(500).json({ error: 'Failed to update scheduled export' });
    }
  }

  private async handleDeleteScheduledExport(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;

      await this.dataLayer.firestoreSet('scheduled_exports', id, null);
      res.status(204).end();
    } catch (error) {
      logger.error('Delete scheduled export error', { error });
      res.status(500).json({ error: 'Failed to delete scheduled export' });
    }
  }

  // Service lifecycle
  async start(port: number = 3007): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        logger.info(`Export service started on port ${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await this.dataLayer.close();
    await this.monitoring.close();
  }
}