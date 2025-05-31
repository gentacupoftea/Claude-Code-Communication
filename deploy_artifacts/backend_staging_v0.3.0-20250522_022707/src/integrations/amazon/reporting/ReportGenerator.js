/**
 * Amazon Report Generator
 * 統合レポート生成機能
 */

const AmazonAPIClient = require('../client/AmazonAPIClient');
const MarketingAnalyticsProcessor = require('../marketing/MarketingAnalyticsProcessor');
const { logger } = require('../../../utils/logger');
const { cache } = require('../../../utils/cache');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

class ReportGenerator {
  constructor(config) {
    this.client = new AmazonAPIClient(config);
    this.marketingProcessor = new MarketingAnalyticsProcessor(config);
    this.cache = cache.namespace('amazon-reports');
    this.reportTypes = {
      // Sales reports
      SALES_SUMMARY: 'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL',
      SALES_DETAIL: 'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_LAST_UPDATE_GENERAL',
      
      // Inventory reports
      INVENTORY_SUMMARY: 'GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA',
      INVENTORY_HEALTH: 'GET_FBA_INVENTORY_HEALTH',
      INVENTORY_AGE: 'GET_FBA_INVENTORY_AGED_DATA',
      
      // Financial reports
      SETTLEMENT_REPORT: 'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE',
      PAYMENT_REPORT: 'GET_FLAT_FILE_PAYMENT_REPORT_DATA',
      
      // Performance reports
      PERFORMANCE_METRICS: 'GET_V1_SELLER_PERFORMANCE_REPORT',
      CUSTOMER_FEEDBACK: 'GET_SELLER_FEEDBACK_DATA',
      
      // Product reports
      LISTING_REPORT: 'GET_MERCHANT_LISTINGS_ALL_DATA',
      COMPETITIVE_PRICING: 'GET_COMPETITIVE_PRICING_FILE',
      
      // FBA reports
      FBA_SHIPMENTS: 'GET_FBA_FULFILLMENT_CURRENT_INVENTORY_DATA',
      FBA_RETURNS: 'GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA',
      FBA_FEES: 'GET_FBA_ESTIMATED_FBA_FEES_TXT_DATA',
      
      // Custom reports
      MULTI_CHANNEL_SALES: 'GET_AFN_INVENTORY_DATA',
      VAT_REPORT: 'GET_VAT_TRANSACTION_DATA'
    };
  }

  /**
   * Generate integrated report
   * 統合レポートを生成
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Report result
   */
  async generateIntegratedReport(options = {}) {
    const startTime = Date.now();
    
    try {
      logger.info('Generating integrated report', options);
      
      // Determine report components
      const components = this.determineReportComponents(options);
      
      // Fetch data for each component
      const reportData = {};
      for (const component of components) {
        reportData[component] = await this.fetchReportData(component, options);
      }
      
      // Analyze and combine data
      const analysis = await this.analyzeReportData(reportData, options);
      
      // Generate report in requested format
      const report = await this.formatReport(analysis, options);
      
      const duration = Date.now() - startTime;
      logger.info(`Report generated in ${duration}ms`);
      
      return {
        reportId: this.generateReportId(),
        generatedAt: new Date(),
        duration,
        format: options.format || 'pdf',
        data: report
      };
    } catch (error) {
      logger.error('Failed to generate report', error);
      throw error;
    }
  }

  /**
   * Determine report components based on options
   * @param {Object} options - Report options
   * @returns {Array} Report components
   */
  determineReportComponents(options) {
    const components = [];
    
    if (options.includeSales !== false) {
      components.push('sales');
    }
    
    if (options.includeInventory) {
      components.push('inventory');
    }
    
    if (options.includeFinancial) {
      components.push('financial');
    }
    
    if (options.includePerformance) {
      components.push('performance');
    }
    
    if (options.includeFBA) {
      components.push('fba');
    }
    
    if (options.includeComparative) {
      components.push('comparative'); // Compare with Shopify/Rakuten
    }
    
    // New marketing components
    if (options.includeMarketing) {
      components.push('marketing');
    }
    
    if (options.includeAdvertising) {
      components.push('advertising');
    }
    
    if (options.includeOrganic) {
      components.push('organic');
    }
    
    if (options.includeCustomers) {
      components.push('customers');
    }
    
    return components;
  }

  /**
   * Fetch report data for a component
   * @param {string} component - Report component
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Component data
   */
  async fetchReportData(component, options) {
    const cacheKey = `report:${component}:${JSON.stringify(options)}`;
    
    // Check cache
    const cached = await this.cache.get(cacheKey);
    if (cached && !options.forceRefresh) {
      return cached;
    }
    
    let data = {};
    
    switch (component) {
      case 'sales':
        data = await this.fetchSalesData(options);
        break;
      case 'inventory':
        data = await this.fetchInventoryData(options);
        break;
      case 'financial':
        data = await this.fetchFinancialData(options);
        break;
      case 'performance':
        data = await this.fetchPerformanceData(options);
        break;
      case 'fba':
        data = await this.fetchFBAData(options);
        break;
      case 'comparative':
        data = await this.fetchComparativeData(options);
        break;
      case 'marketing':
        data = await this.fetchMarketingData(options);
        break;
      case 'advertising':
        data = await this.fetchAdvertisingData(options);
        break;
      case 'organic':
        data = await this.fetchOrganicData(options);
        break;
      case 'customers':
        data = await this.fetchCustomerData(options);
        break;
    }
    
    // Cache data
    await this.cache.set(cacheKey, data, 3600); // 1 hour
    
    return data;
  }

  /**
   * Fetch marketing data (comprehensive)
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Marketing data
   */
  async fetchMarketingData(options) {
    try {
      const marketingPerformance = await this.marketingProcessor.getComprehensivePerformance(options);
      return marketingPerformance;
    } catch (error) {
      logger.error('Failed to fetch marketing data', error);
      return {};
    }
  }

  /**
   * Fetch advertising data
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Advertising data
   */
  async fetchAdvertisingData(options) {
    try {
      const advertisingPerformance = await this.marketingProcessor.getAdvertisingPerformance(options);
      return advertisingPerformance;
    } catch (error) {
      logger.error('Failed to fetch advertising data', error);
      return {};
    }
  }

  /**
   * Fetch organic traffic data
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Organic data
   */
  async fetchOrganicData(options) {
    try {
      const organicPerformance = await this.marketingProcessor.getOrganicPerformance(options);
      return organicPerformance;
    } catch (error) {
      logger.error('Failed to fetch organic data', error);
      return {};
    }
  }

  /**
   * Fetch customer data
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Customer data
   */
  async fetchCustomerData(options) {
    try {
      const customerInsights = await this.marketingProcessor.getCustomerInsights(options);
      return customerInsights;
    } catch (error) {
      logger.error('Failed to fetch customer data', error);
      return {};
    }
  }

  /**
   * Fetch sales data
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Sales data
   */
  async fetchSalesData(options) {
    try {
      // Request sales report
      const reportId = await this.requestReport(
        this.reportTypes.SALES_SUMMARY,
        options
      );
      
      // Wait for and download report
      const reportData = await this.downloadAndParseReport(reportId);
      
      // Aggregate sales data
      const sales = {
        totalRevenue: 0,
        orderCount: 0,
        unitsSold: 0,
        byDate: {},
        byProduct: {},
        byCategory: {},
        byMarketplace: {}
      };
      
      reportData.forEach(row => {
        const date = row.purchaseDate?.split('T')[0];
        const revenue = parseFloat(row.itemPrice) || 0;
        
        sales.totalRevenue += revenue;
        sales.orderCount++;
        sales.unitsSold += parseInt(row.quantity) || 1;
        
        // Aggregate by date
        if (date) {
          if (!sales.byDate[date]) {
            sales.byDate[date] = { revenue: 0, orders: 0, units: 0 };
          }
          sales.byDate[date].revenue += revenue;
          sales.byDate[date].orders++;
          sales.byDate[date].units += parseInt(row.quantity) || 1;
        }
        
        // Aggregate by product
        const asin = row.asin;
        if (asin) {
          if (!sales.byProduct[asin]) {
            sales.byProduct[asin] = { 
              title: row.productName,
              revenue: 0, 
              units: 0 
            };
          }
          sales.byProduct[asin].revenue += revenue;
          sales.byProduct[asin].units += parseInt(row.quantity) || 1;
        }
      });
      
      return sales;
    } catch (error) {
      logger.error('Failed to fetch sales data', error);
      return {};
    }
  }

  /**
   * Fetch inventory data
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Inventory data
   */
  async fetchInventoryData(options) {
    try {
      // Request inventory reports
      const summaryReportId = await this.requestReport(
        this.reportTypes.INVENTORY_SUMMARY,
        options
      );
      
      const healthReportId = await this.requestReport(
        this.reportTypes.INVENTORY_HEALTH,
        options
      );
      
      // Download reports
      const summaryData = await this.downloadAndParseReport(summaryReportId);
      const healthData = await this.downloadAndParseReport(healthReportId);
      
      // Aggregate inventory data
      const inventory = {
        totalValue: 0,
        totalUnits: 0,
        byProduct: {},
        byCondition: {},
        byFulfillmentCenter: {},
        healthMetrics: {
          excessInventory: 0,
          strandedInventory: 0,
          agedInventory: {}
        }
      };
      
      // Process summary data
      summaryData.forEach(item => {
        const units = parseInt(item.quantity) || 0;
        const value = parseFloat(item.yourPrice) || 0;
        
        inventory.totalUnits += units;
        inventory.totalValue += units * value;
        
        // By product
        const asin = item.asin;
        if (asin) {
          inventory.byProduct[asin] = {
            sku: item.sku,
            units: units,
            value: units * value,
            condition: item.condition
          };
        }
        
        // By condition
        const condition = item.condition || 'Unknown';
        if (!inventory.byCondition[condition]) {
          inventory.byCondition[condition] = { units: 0, value: 0 };
        }
        inventory.byCondition[condition].units += units;
        inventory.byCondition[condition].value += units * value;
      });
      
      // Process health data
      healthData.forEach(item => {
        if (item.inventoryHealth === 'EXCESS') {
          inventory.healthMetrics.excessInventory += parseInt(item.quantity) || 0;
        }
        if (item.inventoryHealth === 'STRANDED') {
          inventory.healthMetrics.strandedInventory += parseInt(item.quantity) || 0;
        }
      });
      
      return inventory;
    } catch (error) {
      logger.error('Failed to fetch inventory data', error);
      return {};
    }
  }

  /**
   * Fetch financial data
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Financial data
   */
  async fetchFinancialData(options) {
    try {
      // Get settlement report
      const settlementReportId = await this.requestReport(
        this.reportTypes.SETTLEMENT_REPORT,
        options
      );
      
      const settlementData = await this.downloadAndParseReport(settlementReportId);
      
      // Aggregate financial data
      const financial = {
        totalRevenue: 0,
        totalFees: 0,
        netProfit: 0,
        byType: {},
        feeBreakdown: {},
        settlements: []
      };
      
      settlementData.forEach(transaction => {
        const amount = parseFloat(transaction.totalAmount) || 0;
        const type = transaction.transactionType;
        
        if (type === 'Order') {
          financial.totalRevenue += amount;
        } else if (type.includes('Fee')) {
          financial.totalFees += Math.abs(amount);
          
          // Fee breakdown
          if (!financial.feeBreakdown[type]) {
            financial.feeBreakdown[type] = 0;
          }
          financial.feeBreakdown[type] += Math.abs(amount);
        }
        
        // By transaction type
        if (!financial.byType[type]) {
          financial.byType[type] = { count: 0, amount: 0 };
        }
        financial.byType[type].count++;
        financial.byType[type].amount += amount;
      });
      
      financial.netProfit = financial.totalRevenue - financial.totalFees;
      
      return financial;
    } catch (error) {
      logger.error('Failed to fetch financial data', error);
      return {};
    }
  }

  /**
   * Analyze report data
   * @param {Object} reportData - Report data
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeReportData(reportData, options) {
    const analysis = {
      summary: {},
      trends: {},
      insights: [],
      recommendations: []
    };
    
    // Sales analysis
    if (reportData.sales) {
      analysis.summary.sales = {
        totalRevenue: reportData.sales.totalRevenue,
        orderCount: reportData.sales.orderCount,
        averageOrderValue: reportData.sales.totalRevenue / reportData.sales.orderCount,
        topProducts: this.getTopItems(reportData.sales.byProduct, 10)
      };
      
      // Sales trends
      analysis.trends.sales = this.analyzeTrends(reportData.sales.byDate);
    }
    
    // Inventory analysis
    if (reportData.inventory) {
      analysis.summary.inventory = {
        totalValue: reportData.inventory.totalValue,
        totalUnits: reportData.inventory.totalUnits,
        turnoverRate: this.calculateTurnoverRate(reportData),
        healthScore: this.calculateInventoryHealthScore(reportData.inventory)
      };
      
      // Inventory insights
      if (reportData.inventory.healthMetrics.excessInventory > 100) {
        analysis.insights.push({
          type: 'warning',
          message: `${reportData.inventory.healthMetrics.excessInventory}個の過剰在庫が検出されました`,
          recommendation: '価格調整やプロモーションを検討してください'
        });
      }
    }
    
    // Financial analysis
    if (reportData.financial) {
      analysis.summary.financial = {
        netProfit: reportData.financial.netProfit,
        profitMargin: (reportData.financial.netProfit / reportData.financial.totalRevenue) * 100,
        feeRatio: (reportData.financial.totalFees / reportData.financial.totalRevenue) * 100,
        topFees: this.getTopItems(reportData.financial.feeBreakdown, 5)
      };
    }
    
    // Marketing analysis
    if (reportData.marketing) {
      analysis.summary.marketing = {
        advertisingROAS: reportData.marketing.advertising?.summary?.roas || 0,
        organicTraffic: reportData.marketing.organic?.traffic?.summary?.totalPageViews || 0,
        customerSegments: reportData.marketing.customers?.segments || {},
        competitivePosition: reportData.marketing.competition?.marketPosition || {}
      };
      
      // Add marketing insights
      if (reportData.marketing.recommendations) {
        analysis.recommendations.push(...reportData.marketing.recommendations);
      }
    }
    
    // Generate additional recommendations
    analysis.recommendations.push(...this.generateRecommendations(analysis));
    
    return analysis;
  }

  /**
   * Format report in requested format
   * @param {Object} analysis - Analysis results
   * @param {Object} options - Report options
   * @returns {Promise<Buffer>} Formatted report
   */
  async formatReport(analysis, options) {
    const format = options.format || 'pdf';
    
    switch (format) {
      case 'pdf':
        return this.generatePDFReport(analysis, options);
      case 'excel':
        return this.generateExcelReport(analysis, options);
      case 'json':
        return Buffer.from(JSON.stringify(analysis, null, 2));
      case 'csv':
        return this.generateCSVReport(analysis, options);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate PDF report
   * @param {Object} analysis - Analysis results
   * @param {Object} options - Report options
   * @returns {Promise<Buffer>} PDF report
   */
  async generatePDFReport(analysis, options) {
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      }
    });
    
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    
    // Title page
    doc.fontSize(24)
       .text('Amazon統合レポート', { align: 'center' })
       .fontSize(14)
       .text(new Date().toLocaleDateString('ja-JP'), { align: 'center' })
       .moveDown(2);
    
    // Executive summary
    doc.fontSize(18)
       .text('エグゼクティブサマリー', { underline: true })
       .moveDown();
    
    if (analysis.summary.sales) {
      doc.fontSize(12)
         .text(`総売上: ¥${analysis.summary.sales.totalRevenue.toLocaleString()}`)
         .text(`注文数: ${analysis.summary.sales.orderCount.toLocaleString()}`)
         .text(`平均注文額: ¥${analysis.summary.sales.averageOrderValue.toFixed(2)}`)
         .moveDown();
    }
    
    if (analysis.summary.inventory) {
      doc.text(`在庫総額: ¥${analysis.summary.inventory.totalValue.toLocaleString()}`)
         .text(`在庫数: ${analysis.summary.inventory.totalUnits.toLocaleString()}`)
         .text(`在庫健全性スコア: ${analysis.summary.inventory.healthScore}/100`)
         .moveDown();
    }
    
    if (analysis.summary.financial) {
      doc.text(`純利益: ¥${analysis.summary.financial.netProfit.toLocaleString()}`)
         .text(`利益率: ${analysis.summary.financial.profitMargin.toFixed(2)}%`)
         .text(`手数料率: ${analysis.summary.financial.feeRatio.toFixed(2)}%`)
         .moveDown();
    }
    
    if (analysis.summary.marketing) {
      doc.text(`広告ROAS: ${analysis.summary.marketing.advertisingROAS.toFixed(2)}x`)
         .text(`オーガニックトラフィック: ${analysis.summary.marketing.organicTraffic.toLocaleString()} PV`)
         .moveDown();
    }
    
    // Insights
    if (analysis.insights.length > 0) {
      doc.addPage()
         .fontSize(18)
         .text('インサイト', { underline: true })
         .moveDown();
      
      analysis.insights.forEach(insight => {
        doc.fontSize(12)
           .fillColor(insight.type === 'warning' ? 'orange' : 'black')
           .text(`• ${insight.message}`)
           .fillColor('black')
           .text(`  推奨: ${insight.recommendation}`, { indent: 20 })
           .moveDown();
      });
    }
    
    // Recommendations
    if (analysis.recommendations.length > 0) {
      doc.addPage()
         .fontSize(18)
         .text('推奨事項', { underline: true })
         .moveDown();
      
      analysis.recommendations.forEach((rec, index) => {
        doc.fontSize(12)
           .text(`${index + 1}. ${rec.title}`)
           .text(rec.description, { indent: 20 })
           .moveDown();
      });
    }
    
    // Marketing analytics section
    if (analysis.summary.marketing) {
      doc.addPage()
         .fontSize(18)
         .text('マーケティング分析', { underline: true })
         .moveDown();
      
      doc.fontSize(14)
         .text('広告パフォーマンス', { underline: true })
         .fontSize(12)
         .text(`ROAS: ${analysis.summary.marketing.advertisingROAS.toFixed(2)}x`)
         .moveDown();
      
      doc.fontSize(14)
         .text('オーガニックトラフィック', { underline: true })
         .fontSize(12)
         .text(`総ページビュー: ${analysis.summary.marketing.organicTraffic.toLocaleString()}`)
         .moveDown();
    }
    
    // Finalize PDF
    doc.end();
    
    return Buffer.concat(chunks);
  }

  /**
   * Generate Excel report
   * @param {Object} analysis - Analysis results
   * @param {Object} options - Report options
   * @returns {Promise<Buffer>} Excel report
   */
  async generateExcelReport(analysis, options) {
    const workbook = new ExcelJS.Workbook();
    
    // Summary sheet
    const summarySheet = workbook.addWorksheet('サマリー');
    
    // Add headers
    summarySheet.columns = [
      { header: '項目', key: 'item', width: 30 },
      { header: '値', key: 'value', width: 20 }
    ];
    
    // Add summary data
    const summaryRows = [];
    
    if (analysis.summary.sales) {
      summaryRows.push(
        { item: '総売上', value: `¥${analysis.summary.sales.totalRevenue.toLocaleString()}` },
        { item: '注文数', value: analysis.summary.sales.orderCount },
        { item: '平均注文額', value: `¥${analysis.summary.sales.averageOrderValue.toFixed(2)}` }
      );
    }
    
    if (analysis.summary.inventory) {
      summaryRows.push(
        { item: '在庫総額', value: `¥${analysis.summary.inventory.totalValue.toLocaleString()}` },
        { item: '在庫数', value: analysis.summary.inventory.totalUnits },
        { item: '在庫健全性スコア', value: `${analysis.summary.inventory.healthScore}/100` }
      );
    }
    
    if (analysis.summary.financial) {
      summaryRows.push(
        { item: '純利益', value: `¥${analysis.summary.financial.netProfit.toLocaleString()}` },
        { item: '利益率', value: `${analysis.summary.financial.profitMargin.toFixed(2)}%` },
        { item: '手数料率', value: `${analysis.summary.financial.feeRatio.toFixed(2)}%` }
      );
    }
    
    if (analysis.summary.marketing) {
      summaryRows.push(
        { item: '広告ROAS', value: `${analysis.summary.marketing.advertisingROAS.toFixed(2)}x` },
        { item: 'オーガニックトラフィック', value: `${analysis.summary.marketing.organicTraffic.toLocaleString()} PV` }
      );
    }
    
    summarySheet.addRows(summaryRows);
    
    // Style the header row
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Marketing sheet
    if (analysis.summary.marketing) {
      const marketingSheet = workbook.addWorksheet('マーケティング');
      marketingSheet.columns = [
        { header: '指標', key: 'metric', width: 30 },
        { header: '値', key: 'value', width: 20 },
        { header: '前期比', key: 'change', width: 15 }
      ];
      
      const marketingRows = [
        { metric: '広告支出', value: '¥0', change: '+0%' },
        { metric: '広告収益', value: '¥0', change: '+0%' },
        { metric: 'ROAS', value: analysis.summary.marketing.advertisingROAS.toFixed(2), change: '+0%' },
        { metric: 'オーガニックトラフィック', value: analysis.summary.marketing.organicTraffic, change: '+0%' }
      ];
      
      marketingSheet.addRows(marketingRows);
      
      // Style the header row
      marketingSheet.getRow(1).font = { bold: true };
      marketingSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
    }
    
    // Insights sheet
    if (analysis.insights.length > 0) {
      const insightsSheet = workbook.addWorksheet('インサイト');
      insightsSheet.columns = [
        { header: 'タイプ', key: 'type', width: 15 },
        { header: 'メッセージ', key: 'message', width: 50 },
        { header: '推奨事項', key: 'recommendation', width: 50 }
      ];
      
      insightsSheet.addRows(analysis.insights);
      
      // Style the header row
      insightsSheet.getRow(1).font = { bold: true };
      insightsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
    }
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  /**
   * Generate CSV report
   * @param {Object} analysis - Analysis results
   * @param {Object} options - Report options
   * @returns {Buffer} CSV report
   */
  generateCSVReport(analysis, options) {
    const rows = [];
    
    // Headers
    rows.push(['項目', '値']);
    
    // Summary data
    if (analysis.summary.sales) {
      rows.push(['総売上', analysis.summary.sales.totalRevenue]);
      rows.push(['注文数', analysis.summary.sales.orderCount]);
      rows.push(['平均注文額', analysis.summary.sales.averageOrderValue]);
    }
    
    if (analysis.summary.inventory) {
      rows.push(['在庫総額', analysis.summary.inventory.totalValue]);
      rows.push(['在庫数', analysis.summary.inventory.totalUnits]);
      rows.push(['在庫健全性スコア', analysis.summary.inventory.healthScore]);
    }
    
    if (analysis.summary.financial) {
      rows.push(['純利益', analysis.summary.financial.netProfit]);
      rows.push(['利益率', analysis.summary.financial.profitMargin]);
      rows.push(['手数料率', analysis.summary.financial.feeRatio]);
    }
    
    if (analysis.summary.marketing) {
      rows.push(['広告ROAS', analysis.summary.marketing.advertisingROAS]);
      rows.push(['オーガニックトラフィック', analysis.summary.marketing.organicTraffic]);
    }
    
    // Convert to CSV
    const csv = rows.map(row => row.join(',')).join('\n');
    return Buffer.from(csv, 'utf-8');
  }

  /**
   * Helper: Get top items from object
   * @param {Object} items - Items object
   * @param {number} limit - Top N limit
   * @returns {Array} Top items
   */
  getTopItems(items, limit = 10) {
    return Object.entries(items)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, limit)
      .map(([key, value]) => ({
        key,
        ...value
      }));
  }

  /**
   * Helper: Analyze trends
   * @param {Object} timeSeriesData - Time series data
   * @returns {Object} Trend analysis
   */
  analyzeTrends(timeSeriesData) {
    const dates = Object.keys(timeSeriesData).sort();
    const values = dates.map(date => timeSeriesData[date].revenue);
    
    // Calculate moving average
    const movingAverage = [];
    const window = 7;
    
    for (let i = window - 1; i < values.length; i++) {
      const sum = values.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      movingAverage.push(sum / window);
    }
    
    // Calculate trend direction
    const recentAvg = movingAverage.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const previousAvg = movingAverage.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;
    const trendDirection = recentAvg > previousAvg ? 'up' : 'down';
    const trendPercentage = ((recentAvg - previousAvg) / previousAvg) * 100;
    
    return {
      direction: trendDirection,
      percentage: trendPercentage,
      movingAverage,
      recentAverage: recentAvg
    };
  }

  /**
   * Generate report ID
   * @returns {string} Report ID
   */
  generateReportId() {
    return `AZ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate inventory turnover rate
   * @param {Object} reportData - Report data
   * @returns {number} Turnover rate
   */
  calculateTurnoverRate(reportData) {
    if (!reportData.sales || !reportData.inventory) {
      return 0;
    }
    
    const annualizedRevenue = reportData.sales.totalRevenue * 12; // Assuming monthly data
    const averageInventoryValue = reportData.inventory.totalValue;
    
    return averageInventoryValue > 0 ? annualizedRevenue / averageInventoryValue : 0;
  }

  /**
   * Calculate inventory health score
   * @param {Object} inventory - Inventory data
   * @returns {number} Health score (0-100)
   */
  calculateInventoryHealthScore(inventory) {
    let score = 100;
    
    // Deduct points for excess inventory
    const excessRatio = inventory.healthMetrics.excessInventory / inventory.totalUnits;
    score -= excessRatio * 50;
    
    // Deduct points for stranded inventory
    const strandedRatio = inventory.healthMetrics.strandedInventory / inventory.totalUnits;
    score -= strandedRatio * 30;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate recommendations
   * @param {Object} analysis - Analysis results
   * @returns {Array} Recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];
    
    // Sales recommendations
    if (analysis.trends?.sales?.direction === 'down' && analysis.trends.sales.percentage < -10) {
      recommendations.push({
        title: '売上減少への対策',
        description: '売上が前期比で10%以上減少しています。プロモーション活動の強化や商品ラインナップの見直しを検討してください。',
        category: 'sales',
        priority: 'high'
      });
    }
    
    // Inventory recommendations
    if (analysis.summary?.inventory?.healthScore < 70) {
      recommendations.push({
        title: '在庫健全性の改善',
        description: '在庫健全性スコアが低下しています。過剰在庫の削減と在庫回転率の向上に取り組んでください。',
        category: 'inventory',
        priority: 'medium'
      });
    }
    
    // Financial recommendations
    if (analysis.summary?.financial?.feeRatio > 20) {
      recommendations.push({
        title: '手数料削減の検討',
        description: '手数料率が20%を超えています。FBA料金プランの見直しや自社配送との併用を検討してください。',
        category: 'financial',
        priority: 'medium'
      });
    }
    
    // Marketing recommendations
    if (analysis.summary?.marketing?.advertisingROAS < 2) {
      recommendations.push({
        title: '広告ROASの改善',
        description: '広告のROASが2倍未満です。キーワード最適化、入札戦略の見直し、商品ページの改善を行ってください。',
        category: 'marketing',
        priority: 'high'
      });
    }
    
    return recommendations;
  }

  /**
   * Request report from Amazon
   * @param {string} reportType - Report type
   * @param {Object} options - Report options
   * @returns {Promise<string>} Report ID
   */
  async requestReport(reportType, options) {
    try {
      const reportRequest = {
        reportType,
        dataStartTime: options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        dataEndTime: options.endDate || new Date(),
        marketplaceIds: options.marketplaceIds || ['A1VC38T7YXB528']
      };
      
      const response = await this.client.createReport(reportRequest);
      
      logger.info(`Report requested: ${response.reportId} (${reportType})`);
      return response.reportId;
    } catch (error) {
      logger.error(`Failed to request report ${reportType}`, error);
      throw error;
    }
  }

  /**
   * Download and parse report
   * @param {string} reportId - Report ID
   * @returns {Promise<Array>} Parsed report data
   */
  async downloadAndParseReport(reportId) {
    try {
      // Wait for report
      await this.waitForReport(reportId);
      
      // Get report document
      const reportStatus = await this.client.getReportStatus(reportId);
      
      // Download report
      const reportData = await this.client.downloadReport(reportStatus.reportDocumentId);
      
      // Parse TSV data
      return this.parseTSV(reportData);
    } catch (error) {
      logger.error(`Failed to download report ${reportId}`, error);
      throw error;
    }
  }

  /**
   * Wait for report to be ready
   * @param {string} reportId - Report ID
   * @returns {Promise<void>}
   */
  async waitForReport(reportId, maxWaitTime = 300000) { // 5 minutes
    const startTime = Date.now();
    const checkInterval = 10000; // 10 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.client.getReportStatus(reportId);
      
      if (status.processingStatus === 'DONE') {
        return;
      }
      
      if (status.processingStatus === 'FATAL' || status.processingStatus === 'CANCELLED') {
        throw new Error(`Report processing failed: ${status.processingStatus}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error(`Report ${reportId} timed out`);
  }

  /**
   * Parse TSV data
   * @param {string} tsvData - TSV formatted data
   * @returns {Array} Parsed data
   */
  parseTSV(tsvData) {
    const lines = tsvData.split('\n');
    const headers = lines[0].split('\t');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split('\t');
        const row = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        
        data.push(row);
      }
    }
    
    return data;
  }
}

module.exports = ReportGenerator;