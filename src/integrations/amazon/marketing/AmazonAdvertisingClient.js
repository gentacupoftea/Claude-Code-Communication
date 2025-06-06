/**
 * Amazon Advertising API Client
 * Amazon広告APIクライアント
 */

import axios from 'axios';
import axiosRetry from 'axios-retry';
import { logger  } from '../../../utils/logger';
import { cache  } from '../../../utils/cache';
import AmazonAuth from '../auth/AmazonAuth';

class AmazonAdvertisingClient {
  constructor(config) {
    this.config = config;
    this.auth = new AmazonAuth(config);
    
    // Advertising API endpoints
    this.baseURL = config.advertisingBaseURL || 'https://advertising-api-fe.amazon.com';
    this.sandboxURL = 'https://advertising-api-test.amazon.com';
    this.region = config.region || 'FE'; // Far East for Japan
    
    // API versions
    this.apiVersions = {
      campaigns: 'v3',
      reports: 'v3',
      keywords: 'sp/v3',
      products: 'sp/v3',
      brands: 'v2',
      stores: 'v1',
      dsp: 'v1'
    };
    
    // Initialize axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 120000, // 2 minutes for large reports
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Amazon-Advertising-API-MarketplaceId': config.marketplaceId || 'A1VC38T7YXB528'
      }
    });
    
    // Configure retry mechanism
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               error.response?.status === 429 ||
               error.response?.status === 503;
      }
    });
    
    this.setupInterceptors();
    this.cache = cache.namespace('amazon-advertising');
  }

  /**
   * Setup axios interceptors
   */
  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        // Get advertising access token
        const token = await this.getAdvertisingToken();
        config.headers['Authorization'] = `Bearer ${token}`;
        
        // Add profile ID if available
        if (this.config.profileId) {
          config.headers['Amazon-Advertising-API-ProfileId'] = this.config.profileId;
        }
        
        // Add client info
        config.headers['Amazon-Advertising-API-ClientId'] = `ShopifyMCPServer:1.0`;
        
        logger.debug(`Amazon Advertising API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Request interceptor error', error);
        return Promise.reject(error);
      }
    );
    
    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Log rate limit info
        if (response.headers['x-amzn-ratelimit-limit']) {
          logger.info('Advertising API rate limit', {
            limit: response.headers['x-amzn-ratelimit-limit'],
            remaining: response.headers['x-amzn-ratelimit-remaining']
          });
        }
        
        return response;
      },
      async (error) => {
        logger.error('Advertising API error', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get advertising-specific access token
   * @returns {Promise<string>} Access token
   */
  async getAdvertisingToken() {
    const cacheKey = 'advertising-token';
    const cached = await this.cache.get(cacheKey);
    
    if (cached && cached.expires_at > Date.now()) {
      return cached.token;
    }
    
    // Exchange SP-API token for Advertising API token
    const _spToken = await this.auth.getAccessToken();
    
    try {
      const response = await axios.post('https://api.amazon.com/auth/o2/token', {
        grant_type: 'refresh_token',
        refresh_token: this.config.advertisingRefreshToken || this.config.refreshToken,
        client_id: this.config.advertisingClientId || this.config.clientId,
        client_secret: this.config.advertisingClientSecret || this.config.clientSecret,
        scope: 'advertising::campaign_management'
      });
      
      const tokenData = {
        token: response.data.access_token,
        expires_at: Date.now() + (response.data.expires_in * 1000) - 60000
      };
      
      await this.cache.set(cacheKey, tokenData, response.data.expires_in - 60);
      return tokenData.token;
    } catch (error) {
      logger.error('Failed to get advertising token', error);
      throw error;
    }
  }

  /**
   * Get advertising profiles
   * @returns {Promise<Array>} Advertising profiles
   */
  async getProfiles() {
    try {
      const response = await this.client.get('/v2/profiles');
      return response.data;
    } catch (error) {
      logger.error('Failed to get advertising profiles', error);
      throw error;
    }
  }

  /**
   * Get campaigns
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Campaigns data
   */
  async getCampaigns(params = {}) {
    try {
      const response = await this.client.get(`/${this.apiVersions.campaigns}/campaigns`, {
        params: {
          ...params,
          count: params.count || 100
        }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get campaigns', error);
      throw error;
    }
  }

  /**
   * Get campaign performance metrics
   * @param {string} campaignId - Campaign ID
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Performance metrics
   */
  async getCampaignMetrics(campaignId, params = {}) {
    try {
      const response = await this.client.get(
        `/${this.apiVersions.campaigns}/campaigns/${campaignId}/metrics`,
        { params }
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to get metrics for campaign ${campaignId}`, error);
      throw error;
    }
  }

  /**
   * Create advertising report
   * @param {Object} reportConfig - Report configuration
   * @returns {Promise<Object>} Report response
   */
  async createReport(reportConfig) {
    try {
      const response = await this.client.post(
        `/${this.apiVersions.reports}/reports`,
        reportConfig
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to create advertising report', error);
      throw error;
    }
  }

  /**
   * Get report status
   * @param {string} reportId - Report ID
   * @returns {Promise<Object>} Report status
   */
  async getReportStatus(reportId) {
    try {
      const response = await this.client.get(
        `/${this.apiVersions.reports}/reports/${reportId}`
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to get report status for ${reportId}`, error);
      throw error;
    }
  }

  /**
   * Download report
   * @param {string} reportUrl - Report download URL
   * @returns {Promise<Object>} Report data
   */
  async downloadReport(reportUrl) {
    try {
      const response = await axios.get(reportUrl, {
        responseType: 'arraybuffer',
        headers: {
          'Accept-Encoding': 'gzip'
        }
      });
      
      // Decompress if needed
      import zlib from 'zlib';
      const data = zlib.gunzipSync(response.data);
      
      return JSON.parse(data.toString());
    } catch (error) {
      logger.error('Failed to download advertising report', error);
      throw error;
    }
  }

  /**
   * Get search term report
   * @param {Object} params - Report parameters
   * @returns {Promise<Object>} Search term data
   */
  async getSearchTermReport(params = {}) {
    const reportConfig = {
      name: 'Search Term Report',
      startDate: params.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: params.endDate || new Date(),
      configuration: {
        adProduct: 'SPONSORED_PRODUCTS',
        groupBy: ['searchTerm'],
        columns: [
          'impressions',
          'clicks',
          'cost',
          'attributedSales7d',
          'attributedConversions7d',
          'attributedUnitsOrdered7d'
        ],
        reportTypeId: 'spSearchTerm',
        timeUnit: 'DAILY',
        format: 'JSON'
      }
    };
    
    const report = await this.createReport(reportConfig);
    return this.waitForReport(report.reportId);
  }

  /**
   * Get keyword performance
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Keyword performance data
   */
  async getKeywordPerformance(params = {}) {
    try {
      const response = await this.client.get(
        `/${this.apiVersions.keywords}/keywords/performance`,
        { params }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to get keyword performance', error);
      throw error;
    }
  }

  /**
   * Get product targeting performance
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Product targeting data
   */
  async getProductTargeting(params = {}) {
    try {
      const response = await this.client.get(
        `/${this.apiVersions.products}/productTargeting`,
        { params }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to get product targeting', error);
      throw error;
    }
  }

  /**
   * Get brand metrics
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Brand metrics
   */
  async getBrandMetrics(params = {}) {
    try {
      const response = await this.client.get(
        `/${this.apiVersions.brands}/brands/metrics`,
        { params }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to get brand metrics', error);
      throw error;
    }
  }

  /**
   * Get store insights
   * @param {string} storeId - Store ID
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Store insights
   */
  async getStoreInsights(storeId, params = {}) {
    try {
      const response = await this.client.get(
        `/${this.apiVersions.stores}/stores/${storeId}/insights`,
        { params }
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to get store insights for ${storeId}`, error);
      throw error;
    }
  }

  /**
   * Get DSP (Demand Side Platform) metrics
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} DSP metrics
   */
  async getDSPMetrics(params = {}) {
    try {
      const response = await this.client.get(
        `/${this.apiVersions.dsp}/dsp/metrics`,
        { params }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to get DSP metrics', error);
      throw error;
    }
  }

  /**
   * Wait for report to complete
   * @param {string} reportId - Report ID
   * @returns {Promise<Object>} Report data
   */
  async waitForReport(reportId, maxWaitTime = 300000) {
    const startTime = Date.now();
    const checkInterval = 5000;
    
    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getReportStatus(reportId);
      
      if (status.status === 'COMPLETED') {
        return await this.downloadReport(status.location);
      }
      
      if (status.status === 'FAILED') {
        throw new Error(`Report ${reportId} failed: ${status.failureReason}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error(`Report ${reportId} timed out`);
  }

  /**
   * Get advertising spend by campaign type
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Spend data
   */
  async getSpendByType(params = {}) {
    const campaigns = await this.getCampaigns(params);
    const spendByType = {};
    
    for (const campaign of campaigns) {
      const type = campaign.campaignType;
      if (!spendByType[type]) {
        spendByType[type] = {
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0
        };
      }
      
      const metrics = await this.getCampaignMetrics(campaign.campaignId, params);
      spendByType[type].spend += metrics.cost || 0;
      spendByType[type].impressions += metrics.impressions || 0;
      spendByType[type].clicks += metrics.clicks || 0;
      spendByType[type].conversions += metrics.attributedConversions7d || 0;
      spendByType[type].revenue += metrics.attributedSales7d || 0;
    }
    
    return spendByType;
  }

  /**
   * Get budget utilization
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Budget utilization data
   */
  async getBudgetUtilization(params = {}) {
    const campaigns = await this.getCampaigns(params);
    const utilization = [];
    
    for (const campaign of campaigns) {
      const metrics = await this.getCampaignMetrics(campaign.campaignId, params);
      utilization.push({
        campaignId: campaign.campaignId,
        campaignName: campaign.name,
        budget: campaign.budget,
        spent: metrics.cost || 0,
        utilizationRate: ((metrics.cost || 0) / campaign.budget) * 100,
        status: campaign.state,
        performance: {
          roas: (metrics.attributedSales7d || 0) / (metrics.cost || 1),
          ctr: ((metrics.clicks || 0) / (metrics.impressions || 1)) * 100,
          cvr: ((metrics.attributedConversions7d || 0) / (metrics.clicks || 1)) * 100
        }
      });
    }
    
    return utilization;
  }
}

module.exports = AmazonAdvertisingClient;