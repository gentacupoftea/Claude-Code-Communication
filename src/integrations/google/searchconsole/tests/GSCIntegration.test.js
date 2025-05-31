/**
 * Google Search Console統合テスト
 * 各モジュールの単体テストと統合テスト
 * 
 * @module GSCIntegrationTest
 * @requires mocha
 * @requires chai
 * @requires sinon
 */

const { expect } = require('chai');
const sinon = require('sinon');
const GSCAuth = require('../auth/GSCAuth');
const GSCApiClient = require('../api/GSCApiClient');
const QueryData = require('../models/QueryData');
const PerformanceData = require('../models/PerformanceData');
const DataFetchProcessor = require('../processors/DataFetchProcessor');
const AnalyticsProcessor = require('../processors/AnalyticsProcessor');
const DataVisualizer = require('../visualizers/DataVisualizer');

describe('Google Search Console Integration Tests', () => {
  let sandbox;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  describe('GSCAuth', () => {
    it('should initialize with environment variables', () => {
      expect(GSCAuth).to.exist;
      expect(GSCAuth.isAuthenticated).to.be.false;
    });
    
    it('should emit authenticated event on successful auth', (done) => {
      GSCAuth.once('authenticated', (data) => {
        expect(data.authType).to.be.oneOf(['oauth2', 'service_account']);
        done();
      });
      
      // モック認証
      GSCAuth.isAuthenticated = true;
      GSCAuth.emit('authenticated', { authType: 'service_account' });
    });
    
    it('should handle authentication errors', (done) => {
      GSCAuth.once('authError', (error) => {
        expect(error).to.be.instanceOf(Error);
        done();
      });
      
      GSCAuth.emit('authError', new Error('認証失敗'));
    });
  });
  
  describe('GSCApiClient', () => {
    beforeEach(() => {
      sandbox.stub(GSCAuth, 'isAuthValid').returns(true);
      sandbox.stub(GSCAuth, 'getClient').returns({
        searchanalytics: {
          query: sandbox.stub().resolves({ data: { rows: [] } })
        }
      });
    });
    
    it('should fetch search analytics data', async () => {
      const params = {
        siteUrl: 'https://example.com',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      
      const result = await GSCApiClient.getSearchAnalytics(params);
      
      expect(result).to.have.property('rows');
      expect(result.rows).to.be.an('array');
    });
    
    it('should handle rate limiting', async () => {
      const stub = sandbox.stub(GSCApiClient.rateLimiter, 'checkLimit').resolves();
      
      await GSCApiClient.getSearchAnalytics({
        siteUrl: 'https://example.com',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      
      expect(stub.calledOnce).to.be.true;
    });
    
    it('should cache API responses', async () => {
      const cacheStub = sandbox.stub(GSCApiClient, 'generateCacheKey').returns('test-key');
      
      await GSCApiClient.getSearchAnalytics({
        siteUrl: 'https://example.com',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      
      expect(cacheStub.calledOnce).to.be.true;
    });
  });
  
  describe('QueryData Model', () => {
    it('should save query data', async () => {
      const queryData = [{
        site_url: 'https://example.com',
        keys: ['2024-01-01', 'test keyword', 'https://example.com/page', 'jpn', 'MOBILE'],
        clicks: 100,
        impressions: 1000,
        ctr: 0.1,
        position: 5
      }];
      
      const saveStub = sandbox.stub(QueryData, 'save').resolves({
        total: 1,
        saved: 1,
        errors: 0
      });
      
      const result = await QueryData.save(queryData);
      
      expect(result.saved).to.equal(1);
      expect(result.errors).to.equal(0);
    });
    
    it('should find queries with filters', async () => {
      const findStub = sandbox.stub(QueryData, 'find').resolves([
        { query: 'test keyword', clicks: 100 }
      ]);
      
      const results = await QueryData.find({
        siteUrl: 'https://example.com',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      
      expect(results).to.be.an('array');
      expect(results).to.have.lengthOf(1);
    });
    
    it('should get top queries', async () => {
      const topQueriesStub = sandbox.stub(QueryData, 'getTopQueries').resolves([
        { query: 'top keyword', totalClicks: 500 }
      ]);
      
      const results = await QueryData.getTopQueries({
        siteUrl: 'https://example.com',
        limit: 10
      });
      
      expect(results).to.be.an('array');
      expect(results[0]).to.have.property('totalClicks');
    });
  });
  
  describe('PerformanceData Model', () => {
    it('should save performance data', async () => {
      const performanceData = [{
        site_url: 'https://example.com',
        date: '2024-01-01',
        data_type: 'total',
        clicks: 1000,
        impressions: 10000,
        ctr: 0.1,
        position: 10
      }];
      
      const saveStub = sandbox.stub(PerformanceData, 'save').resolves({
        total: 1,
        saved: 1,
        errors: 0
      });
      
      const result = await PerformanceData.save(performanceData);
      
      expect(result.saved).to.equal(1);
    });
    
    it('should get daily performance', async () => {
      const dailyStub = sandbox.stub(PerformanceData, 'getDailyPerformance').resolves([
        { date: '2024-01-01', clicks: 100 }
      ]);
      
      const results = await PerformanceData.getDailyPerformance({
        siteUrl: 'https://example.com'
      });
      
      expect(results).to.be.an('array');
    });
    
    it('should analyze trends', async () => {
      const trendStub = sandbox.stub(PerformanceData, 'analyzeTrends').resolves({
        trend: 'up',
        changeRate: 15.5
      });
      
      const result = await PerformanceData.analyzeTrends({
        siteUrl: 'https://example.com'
      });
      
      expect(result).to.have.property('trend');
      expect(result.trend).to.be.oneOf(['up', 'down', 'stable']);
    });
  });
  
  describe('DataFetchProcessor', () => {
    beforeEach(() => {
      sandbox.stub(GSCApiClient, 'getAllSearchAnalytics').resolves({
        rows: [{ test: 'data' }]
      });
      sandbox.stub(QueryData, 'save').resolves({ saved: 1 });
      sandbox.stub(PerformanceData, 'save').resolves({ saved: 1 });
    });
    
    it('should sync all data types', async () => {
      const syncStub = sandbox.stub(DataFetchProcessor, 'syncAllData').resolves({
        totalTasks: 4,
        completed: 4,
        failed: 0
      });
      
      const result = await DataFetchProcessor.syncAllData({
        siteUrl: 'https://example.com',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      
      expect(result.completed).to.equal(4);
      expect(result.failed).to.equal(0);
    });
    
    it('should handle incremental sync', async () => {
      const incrementalStub = sandbox.stub(DataFetchProcessor, 'incrementalSync').resolves({
        totalTasks: 2,
        completed: 2,
        failed: 0
      });
      
      const result = await DataFetchProcessor.incrementalSync({
        siteUrl: 'https://example.com',
        daysBack: 7
      });
      
      expect(result.completed).to.equal(2);
    });
    
    it('should split date ranges for batch processing', () => {
      const ranges = DataFetchProcessor.splitDateRange('2024-01-01', '2024-03-31');
      
      expect(ranges).to.be.an('array');
      expect(ranges.length).to.be.greaterThan(2);
    });
  });
  
  describe('AnalyticsProcessor', () => {
    beforeEach(() => {
      sandbox.stub(QueryData, 'getTopQueries').resolves([
        { query: 'test', totalClicks: 100 }
      ]);
      sandbox.stub(PerformanceData, 'getStatistics').resolves({
        totalClicks: 1000,
        avgCtr: 0.05
      });
    });
    
    it('should perform comprehensive analysis', async () => {
      const analysisStub = sandbox.stub(AnalyticsProcessor, 'performComprehensiveAnalysis').resolves({
        overview: {},
        keywords: {},
        pages: {},
        trends: {}
      });
      
      const result = await AnalyticsProcessor.performComprehensiveAnalysis({
        siteUrl: 'https://example.com',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      
      expect(result).to.have.property('overview');
      expect(result).to.have.property('keywords');
    });
    
    it('should identify keyword opportunities', async () => {
      const opportunitiesStub = sandbox.stub(AnalyticsProcessor, 'identifyKeywordOpportunities').resolves([
        { type: 'low_ctr', keyword: 'test', potentialClicks: 50 }
      ]);
      
      const keywords = [{ query: 'test', totalImpressions: 1000, avgCtr: 0.01 }];
      const opportunities = await AnalyticsProcessor.identifyKeywordOpportunities(keywords);
      
      expect(opportunities).to.be.an('array');
    });
    
    it('should generate recommendations', async () => {
      const recommendations = await AnalyticsProcessor.generateRecommendations({
        keywords: { opportunities: [{ test: 'data' }] }
      });
      
      expect(recommendations).to.be.an('array');
    });
  });
  
  describe('DataVisualizer', () => {
    it('should generate charts', async () => {
      const chartStub = sandbox.stub(DataVisualizer, 'createOverviewChart').resolves({
        buffer: Buffer.from('test'),
        url: 'https://example.com/chart'
      });
      
      const result = await DataVisualizer.createOverviewChart({
        current: { totalClicks: 100 },
        previous: { totalClicks: 80 },
        changes: { totalClicks: 25 }
      });
      
      expect(result).to.have.property('buffer');
      expect(result).to.have.property('url');
    });
    
    it('should generate HTML reports', async () => {
      const htmlStub = sandbox.stub(DataVisualizer, 'generateHtmlReport').resolves('<html>test</html>');
      
      const html = await DataVisualizer.generateHtmlReport({
        siteUrl: 'https://example.com',
        analysisData: { overview: {} },
        charts: {}
      });
      
      expect(html).to.be.a('string');
      expect(html).to.include('<html>');
    });
    
    it('should generate dashboard data', async () => {
      const dashboardStub = sandbox.stub(DataVisualizer, 'generateDashboardData').resolves({
        overview: {},
        topKeywords: [],
        devices: []
      });
      
      const data = await DataVisualizer.generateDashboardData({
        siteUrl: 'https://example.com'
      });
      
      expect(data).to.have.property('overview');
      expect(data).to.have.property('topKeywords');
    });
  });
  
  describe('Integration Flow', () => {
    it('should complete full data sync and analysis flow', async () => {
      // フルフローのモック
      const authStub = sandbox.stub(GSCAuth, 'isAuthValid').returns(true);
      const syncStub = sandbox.stub(DataFetchProcessor, 'syncAllData').resolves({
        completed: 4,
        failed: 0
      });
      const analysisStub = sandbox.stub(AnalyticsProcessor, 'performComprehensiveAnalysis').resolves({
        overview: {},
        recommendations: []
      });
      const reportStub = sandbox.stub(DataVisualizer, 'generateComprehensiveReport').resolves({
        reportId: 'test-report',
        htmlPath: '/path/to/report.html'
      });
      
      // 実行
      const syncResult = await DataFetchProcessor.syncAllData({
        siteUrl: 'https://example.com',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      
      const analysisResult = await AnalyticsProcessor.performComprehensiveAnalysis({
        siteUrl: 'https://example.com',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      
      const reportResult = await DataVisualizer.generateComprehensiveReport({
        siteUrl: 'https://example.com',
        analysisData: analysisResult
      });
      
      // 検証
      expect(syncResult.completed).to.be.greaterThan(0);
      expect(analysisResult).to.have.property('overview');
      expect(reportResult).to.have.property('reportId');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const errorStub = sandbox.stub(GSCApiClient, 'getSearchAnalytics').rejects(new Error('API Error'));
      
      try {
        await GSCApiClient.getSearchAnalytics({
          siteUrl: 'https://example.com'
        });
      } catch (error) {
        expect(error.message).to.equal('API Error');
      }
    });
    
    it('should handle database errors', async () => {
      const dbErrorStub = sandbox.stub(QueryData, 'save').rejects(new Error('DB Error'));
      
      try {
        await QueryData.save([]);
      } catch (error) {
        expect(error.message).to.equal('DB Error');
      }
    });
  });
  
  describe('Japanese Language Support', () => {
    it('should handle Japanese keywords', async () => {
      const japaneseKeyword = {
        query: 'テストキーワード',
        clicks: 100
      };
      
      const saveStub = sandbox.stub(QueryData, 'save').resolves({
        saved: 1
      });
      
      const result = await QueryData.save([{
        site_url: 'https://example.com',
        keys: ['2024-01-01', japaneseKeyword.query, 'https://example.com', 'jpn', 'MOBILE']
      }]);
      
      expect(result.saved).to.equal(1);
    });
    
    it('should generate reports in Japanese', async () => {
      const htmlReport = await DataVisualizer.generateHtmlReport({
        siteUrl: 'https://example.com',
        analysisData: {
          overview: {
            current: { totalClicks: 100 },
            changes: { totalClicks: 10 },
            summary: ['テスト要約']
          },
          keywords: { insights: [] },
          pages: { insights: [] },
          recommendations: []
        },
        charts: {}
      });
      
      expect(htmlReport).to.include('総クリック数');
      expect(htmlReport).to.include('インプレッション数');
    });
  });
});

// E2Eテスト
describe('Google Search Console E2E Tests', () => {
  // 実際のAPIを使用するE2Eテストは環境変数が設定されている場合のみ実行
  if (process.env.GSC_E2E_TEST === 'true') {
    it('should authenticate and fetch real data', async function() {
      this.timeout(30000); // 30秒のタイムアウト
      
      // 実際の認証とデータ取得
      await GSCAuth.initializeAuth();
      
      const sites = await GSCAuth.getSites();
      expect(sites).to.be.an('array');
      
      if (sites.length > 0) {
        const siteUrl = sites[0].siteUrl;
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const data = await GSCApiClient.getSearchAnalytics({
          siteUrl,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          dimensions: ['query'],
          rowLimit: 10
        });
        
        expect(data.rows).to.be.an('array');
      }
    });
  }
});