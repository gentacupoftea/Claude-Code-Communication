/**
 * Amazon Brand Analytics Client
 * ブランド分析・アクセスデータクライアント
 */

const AmazonAPIClient = require('../client/AmazonAPIClient');
const { logger } = require('../../../utils/logger');
const { cache } = require('../../../utils/cache');

class BrandAnalyticsClient extends AmazonAPIClient {
  constructor(config) {
    super(config);
    this.cache = cache.namespace('amazon-brand-analytics');
    
    // Brand Analytics report types
    this.reportTypes = {
      SEARCH_CATALOG_PERFORMANCE: 'SEARCH_CATALOG_PERFORMANCE',
      MARKET_BASKET_ANALYSIS: 'MARKET_BASKET_ANALYSIS',
      ITEM_COMPARISON: 'ITEM_COMPARISON_AND_ALTERNATE_PURCHASE',
      REPEAT_PURCHASE: 'REPEAT_PURCHASE',
      SEARCH_QUERY_PERFORMANCE: 'SEARCH_QUERY_PERFORMANCE',
      BRAND_PERFORMANCE: 'BRAND_PERFORMANCE',
      CUSTOMER_DEMOGRAPHICS: 'CUSTOMER_DEMOGRAPHICS',
      CUSTOMER_BEHAVIOR: 'CUSTOMER_BEHAVIOR',
      TRAFFIC_DIAGNOSTICS: 'TRAFFIC_DIAGNOSTICS'
    };
  }

  /**
   * Get search catalog performance report
   * 検索カタログパフォーマンスレポート取得
   * @param {Object} params - Report parameters
   * @returns {Promise<Object>} Search performance data
   */
  async getSearchCatalogPerformance(params = {}) {
    const reportConfig = {
      reportType: this.reportTypes.SEARCH_CATALOG_PERFORMANCE,
      reportOptions: {
        dateGranularity: params.dateGranularity || 'WEEK',
        asin: params.asin
      },
      dataStartTime: params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dataEndTime: params.endDate || new Date(),
      marketplaceIds: [this.auth.marketplaceId]
    };
    
    return this.createAndWaitForReport(reportConfig);
  }

  /**
   * Get market basket analysis
   * マーケットバスケット分析（一緒に購入される商品）
   * @param {Object} params - Report parameters
   * @returns {Promise<Object>} Market basket data
   */
  async getMarketBasketAnalysis(params = {}) {
    const reportConfig = {
      reportType: this.reportTypes.MARKET_BASKET_ANALYSIS,
      reportOptions: {
        dateGranularity: params.dateGranularity || 'WEEK',
        asin: params.asin
      },
      dataStartTime: params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dataEndTime: params.endDate || new Date(),
      marketplaceIds: [this.auth.marketplaceId]
    };
    
    return this.createAndWaitForReport(reportConfig);
  }

  /**
   * Get item comparison and alternate purchase report
   * 商品比較・代替購入レポート
   * @param {Object} params - Report parameters
   * @returns {Promise<Object>} Item comparison data
   */
  async getItemComparison(params = {}) {
    const reportConfig = {
      reportType: this.reportTypes.ITEM_COMPARISON,
      reportOptions: {
        dateGranularity: params.dateGranularity || 'WEEK',
        asin: params.asin
      },
      dataStartTime: params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dataEndTime: params.endDate || new Date(),
      marketplaceIds: [this.auth.marketplaceId]
    };
    
    return this.createAndWaitForReport(reportConfig);
  }

  /**
   * Get repeat purchase behavior
   * リピート購入行動分析
   * @param {Object} params - Report parameters
   * @returns {Promise<Object>} Repeat purchase data
   */
  async getRepeatPurchaseBehavior(params = {}) {
    const reportConfig = {
      reportType: this.reportTypes.REPEAT_PURCHASE,
      reportOptions: {
        dateGranularity: params.dateGranularity || 'MONTH',
        asin: params.asin
      },
      dataStartTime: params.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      dataEndTime: params.endDate || new Date(),
      marketplaceIds: [this.auth.marketplaceId]
    };
    
    return this.createAndWaitForReport(reportConfig);
  }

  /**
   * Get search query performance
   * 検索クエリパフォーマンス（どんな検索ワードで表示されているか）
   * @param {Object} params - Report parameters
   * @returns {Promise<Object>} Search query data
   */
  async getSearchQueryPerformance(params = {}) {
    const reportConfig = {
      reportType: this.reportTypes.SEARCH_QUERY_PERFORMANCE,
      reportOptions: {
        dateGranularity: params.dateGranularity || 'WEEK',
        asin: params.asin,
        department: params.department
      },
      dataStartTime: params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dataEndTime: params.endDate || new Date(),
      marketplaceIds: [this.auth.marketplaceId]
    };
    
    return this.createAndWaitForReport(reportConfig);
  }

  /**
   * Get brand performance metrics
   * ブランドパフォーマンス指標
   * @param {Object} params - Report parameters
   * @returns {Promise<Object>} Brand performance data
   */
  async getBrandPerformance(params = {}) {
    const reportConfig = {
      reportType: this.reportTypes.BRAND_PERFORMANCE,
      reportOptions: {
        dateGranularity: params.dateGranularity || 'WEEK',
        brandName: params.brandName || this.config.brandName
      },
      dataStartTime: params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dataEndTime: params.endDate || new Date(),
      marketplaceIds: [this.auth.marketplaceId]
    };
    
    return this.createAndWaitForReport(reportConfig);
  }

  /**
   * Get customer demographics
   * 顧客属性分析
   * @param {Object} params - Report parameters
   * @returns {Promise<Object>} Demographics data
   */
  async getCustomerDemographics(params = {}) {
    const reportConfig = {
      reportType: this.reportTypes.CUSTOMER_DEMOGRAPHICS,
      reportOptions: {
        dateGranularity: params.dateGranularity || 'MONTH',
        asin: params.asin
      },
      dataStartTime: params.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      dataEndTime: params.endDate || new Date(),
      marketplaceIds: [this.auth.marketplaceId]
    };
    
    return this.createAndWaitForReport(reportConfig);
  }

  /**
   * Get customer behavior insights
   * 顧客行動インサイト
   * @param {Object} params - Report parameters
   * @returns {Promise<Object>} Behavior data
   */
  async getCustomerBehavior(params = {}) {
    const reportConfig = {
      reportType: this.reportTypes.CUSTOMER_BEHAVIOR,
      reportOptions: {
        dateGranularity: params.dateGranularity || 'WEEK',
        asin: params.asin,
        metricType: params.metricType || 'CONVERSION_RATE'
      },
      dataStartTime: params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dataEndTime: params.endDate || new Date(),
      marketplaceIds: [this.auth.marketplaceId]
    };
    
    return this.createAndWaitForReport(reportConfig);
  }

  /**
   * Get traffic diagnostics
   * トラフィック診断（アクセス数、離脱率等）
   * @param {Object} params - Report parameters
   * @returns {Promise<Object>} Traffic data
   */
  async getTrafficDiagnostics(params = {}) {
    const reportConfig = {
      reportType: this.reportTypes.TRAFFIC_DIAGNOSTICS,
      reportOptions: {
        dateGranularity: params.dateGranularity || 'DAY',
        asin: params.asin,
        metrics: params.metrics || [
          'page_views',
          'sessions',
          'buy_box_percentage',
          'unit_session_percentage',
          'featured_offer_percent'
        ]
      },
      dataStartTime: params.startDate || new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      dataEndTime: params.endDate || new Date(),
      marketplaceIds: [this.auth.marketplaceId]
    };
    
    return this.createAndWaitForReport(reportConfig);
  }

  /**
   * Get comprehensive product analytics
   * 包括的な商品分析データ
   * @param {string} asin - Product ASIN
   * @param {Object} params - Analysis parameters
   * @returns {Promise<Object>} Comprehensive analytics
   */
  async getComprehensiveProductAnalytics(asin, params = {}) {
    try {
      // Fetch multiple reports in parallel
      const [
        traffic,
        searchPerformance,
        marketBasket,
        itemComparison,
        customerBehavior,
        demographics
      ] = await Promise.all([
        this.getTrafficDiagnostics({ asin, ...params }),
        this.getSearchQueryPerformance({ asin, ...params }),
        this.getMarketBasketAnalysis({ asin, ...params }),
        this.getItemComparison({ asin, ...params }),
        this.getCustomerBehavior({ asin, ...params }),
        this.getCustomerDemographics({ asin, ...params })
      ]);
      
      return {
        asin,
        period: {
          startDate: params.startDate,
          endDate: params.endDate
        },
        traffic: this.normalizeTrafficData(traffic),
        search: this.normalizeSearchData(searchPerformance),
        crossSelling: this.normalizeMarketBasketData(marketBasket),
        competition: this.normalizeCompetitionData(itemComparison),
        customerInsights: {
          behavior: this.normalizeBehaviorData(customerBehavior),
          demographics: this.normalizeDemographicsData(demographics)
        }
      };
    } catch (error) {
      logger.error(`Failed to get comprehensive analytics for ${asin}`, error);
      throw error;
    }
  }

  /**
   * Normalize traffic data
   * @param {Object} data - Raw traffic data
   * @returns {Object} Normalized traffic data
   */
  normalizeTrafficData(data) {
    const normalized = {
      summary: {
        totalPageViews: 0,
        totalSessions: 0,
        averageSessionDuration: 0,
        bounceRate: 0,
        conversionRate: 0
      },
      trend: [],
      sources: {},
      devices: {}
    };
    
    if (data && data.reportData) {
      data.reportData.forEach(item => {
        normalized.summary.totalPageViews += item.pageViews || 0;
        normalized.summary.totalSessions += item.sessions || 0;
        
        normalized.trend.push({
          date: item.date,
          pageViews: item.pageViews,
          sessions: item.sessions,
          buyBoxPercentage: item.buyBoxPercentage,
          unitSessionPercentage: item.unitSessionPercentage
        });
      });
      
      // Calculate averages
      if (normalized.summary.totalSessions > 0) {
        normalized.summary.conversionRate = 
          (normalized.summary.totalPageViews / normalized.summary.totalSessions) * 100;
      }
    }
    
    return normalized;
  }

  /**
   * Normalize search data
   * @param {Object} data - Raw search data
   * @returns {Object} Normalized search data
   */
  normalizeSearchData(data) {
    const normalized = {
      topQueries: [],
      totalImpressions: 0,
      totalClicks: 0,
      averageCTR: 0,
      queryCategories: {}
    };
    
    if (data && data.reportData) {
      // Sort by impressions and get top queries
      const sortedQueries = data.reportData
        .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
        .slice(0, 50);
      
      sortedQueries.forEach(query => {
        normalized.totalImpressions += query.impressions || 0;
        normalized.totalClicks += query.clicks || 0;
        
        normalized.topQueries.push({
          query: query.searchTerm,
          impressions: query.impressions,
          clicks: query.clicks,
          ctr: ((query.clicks || 0) / (query.impressions || 1)) * 100,
          conversionRate: query.conversionRate,
          clickShare: query.clickShare,
          rank: query.rank
        });
        
        // Categorize queries
        const category = this.categorizeSearchQuery(query.searchTerm);
        if (!normalized.queryCategories[category]) {
          normalized.queryCategories[category] = {
            count: 0,
            impressions: 0,
            clicks: 0
          };
        }
        normalized.queryCategories[category].count++;
        normalized.queryCategories[category].impressions += query.impressions || 0;
        normalized.queryCategories[category].clicks += query.clicks || 0;
      });
      
      // Calculate average CTR
      if (normalized.totalImpressions > 0) {
        normalized.averageCTR = (normalized.totalClicks / normalized.totalImpressions) * 100;
      }
    }
    
    return normalized;
  }

  /**
   * Normalize market basket data
   * @param {Object} data - Raw market basket data
   * @returns {Object} Normalized market basket data
   */
  normalizeMarketBasketData(data) {
    const normalized = {
      frequentlyBoughtTogether: [],
      crossSellOpportunities: [],
      bundleSuggestions: []
    };
    
    if (data && data.reportData) {
      data.reportData.forEach(item => {
        const product = {
          asin: item.purchasedAsin,
          title: item.purchasedProductTitle,
          frequency: item.combinationPercentage,
          revenue: item.combinedRevenue
        };
        
        normalized.frequentlyBoughtTogether.push(product);
        
        // Identify cross-sell opportunities
        if (item.combinationPercentage > 10) {
          normalized.crossSellOpportunities.push({
            ...product,
            estimatedRevenueLift: item.combinedRevenue * 0.1
          });
        }
        
        // Bundle suggestions
        if (item.combinationPercentage > 20) {
          normalized.bundleSuggestions.push({
            products: [item.asin, item.purchasedAsin],
            frequency: item.combinationPercentage,
            potentialRevenue: item.combinedRevenue * 1.15
          });
        }
      });
    }
    
    return normalized;
  }

  /**
   * Normalize competition data
   * @param {Object} data - Raw competition data
   * @returns {Object} Normalized competition data
   */
  normalizeCompetitionData(data) {
    const normalized = {
      mainCompetitors: [],
      alternativePurchases: [],
      competitivePosition: {},
      lostSales: []
    };
    
    if (data && data.reportData) {
      data.reportData.forEach(item => {
        const competitor = {
          asin: item.comparedAsin,
          title: item.comparedProductTitle,
          lossRate: item.comparisonPercentage,
          priceDifference: item.priceDifference,
          ratingDifference: item.ratingDifference
        };
        
        normalized.mainCompetitors.push(competitor);
        
        // Alternative purchases
        if (item.alternativePurchasePercentage > 5) {
          normalized.alternativePurchases.push({
            ...competitor,
            alternativePurchaseRate: item.alternativePurchasePercentage
          });
        }
        
        // Lost sales analysis
        if (item.comparisonPercentage > 15) {
          normalized.lostSales.push({
            ...competitor,
            estimatedLostRevenue: item.estimatedLostRevenue
          });
        }
      });
      
      // Calculate competitive position
      const avgLossRate = normalized.mainCompetitors
        .reduce((sum, comp) => sum + comp.lossRate, 0) / normalized.mainCompetitors.length;
      
      normalized.competitivePosition = {
        averageLossRate: avgLossRate,
        position: avgLossRate < 10 ? 'strong' : avgLossRate < 20 ? 'moderate' : 'weak',
        improvementAreas: this.identifyImprovementAreas(normalized.mainCompetitors)
      };
    }
    
    return normalized;
  }

  /**
   * Normalize behavior data
   * @param {Object} data - Raw behavior data
   * @returns {Object} Normalized behavior data
   */
  normalizeBehaviorData(data) {
    const normalized = {
      purchasePatterns: {},
      sessionBehavior: {},
      conversionFunnel: {},
      abandonment: {}
    };
    
    if (data && data.reportData) {
      data.reportData.forEach(item => {
        // Purchase patterns
        if (!normalized.purchasePatterns[item.timeOfDay]) {
          normalized.purchasePatterns[item.timeOfDay] = {
            sessions: 0,
            conversions: 0,
            averageOrderValue: 0
          };
        }
        normalized.purchasePatterns[item.timeOfDay].sessions += item.sessions || 0;
        normalized.purchasePatterns[item.timeOfDay].conversions += item.conversions || 0;
        
        // Session behavior
        normalized.sessionBehavior = {
          averageSessionDuration: item.averageSessionDuration,
          pagesPerSession: item.pagesPerSession,
          bounceRate: item.bounceRate,
          repeatVisitRate: item.repeatVisitRate
        };
        
        // Conversion funnel
        normalized.conversionFunnel = {
          viewToCart: item.viewToCartRate,
          cartToCheckout: item.cartToCheckoutRate,
          checkoutToOrder: item.checkoutToOrderRate,
          overallConversion: item.overallConversionRate
        };
        
        // Abandonment analysis
        normalized.abandonment = {
          cartAbandonment: item.cartAbandonmentRate,
          checkoutAbandonment: item.checkoutAbandonmentRate,
          reasons: item.abandonmentReasons || []
        };
      });
    }
    
    return normalized;
  }

  /**
   * Normalize demographics data
   * @param {Object} data - Raw demographics data
   * @returns {Object} Normalized demographics data
   */
  normalizeDemographicsData(data) {
    const normalized = {
      ageGroups: {},
      gender: {},
      location: {},
      income: {},
      interests: []
    };
    
    if (data && data.reportData) {
      data.reportData.forEach(item => {
        // Age groups
        if (item.ageGroup) {
          normalized.ageGroups[item.ageGroup] = {
            percentage: item.percentage,
            averageOrderValue: item.averageOrderValue,
            frequency: item.purchaseFrequency
          };
        }
        
        // Gender distribution
        if (item.gender) {
          normalized.gender[item.gender] = {
            percentage: item.percentage,
            averageOrderValue: item.averageOrderValue
          };
        }
        
        // Location data
        if (item.region) {
          normalized.location[item.region] = {
            percentage: item.percentage,
            topCities: item.topCities || []
          };
        }
        
        // Income levels
        if (item.incomeLevel) {
          normalized.income[item.incomeLevel] = {
            percentage: item.percentage,
            averageOrderValue: item.averageOrderValue
          };
        }
        
        // Interests and affinities
        if (item.interests) {
          normalized.interests = item.interests;
        }
      });
    }
    
    return normalized;
  }

  /**
   * Categorize search query
   * @param {string} query - Search query
   * @returns {string} Category
   */
  categorizeSearchQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('brand') || lowerQuery.includes('ブランド')) {
      return 'brand';
    } else if (lowerQuery.includes('price') || lowerQuery.includes('価格') || lowerQuery.includes('安い')) {
      return 'price';
    } else if (lowerQuery.includes('quality') || lowerQuery.includes('品質') || lowerQuery.includes('高級')) {
      return 'quality';
    } else if (lowerQuery.includes('size') || lowerQuery.includes('サイズ') || lowerQuery.includes('大きい')) {
      return 'size';
    } else {
      return 'general';
    }
  }

  /**
   * Identify improvement areas
   * @param {Array} competitors - Competitor data
   * @returns {Array} Improvement areas
   */
  identifyImprovementAreas(competitors) {
    const areas = [];
    
    competitors.forEach(comp => {
      if (comp.priceDifference > 0) {
        areas.push({
          area: 'pricing',
          message: `価格が競合より${comp.priceDifference}円高い`,
          impact: 'high'
        });
      }
      
      if (comp.ratingDifference < 0) {
        areas.push({
          area: 'quality',
          message: `評価が競合より${Math.abs(comp.ratingDifference)}ポイント低い`,
          impact: 'high'
        });
      }
    });
    
    return areas;
  }

  /**
   * Create report and wait for completion
   * @param {Object} reportConfig - Report configuration
   * @returns {Promise<Object>} Report data
   */
  async createAndWaitForReport(reportConfig) {
    try {
      const report = await this.createReport(reportConfig);
      const reportData = await this.waitForReport(report.reportId);
      return reportData;
    } catch (error) {
      logger.error('Failed to create and wait for report', error);
      throw error;
    }
  }

  /**
   * Wait for report completion
   * @param {string} reportId - Report ID
   * @returns {Promise<Object>} Report data
   */
  async waitForReport(reportId, maxWaitTime = 300000) {
    const startTime = Date.now();
    const checkInterval = 10000;
    
    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getReportStatus(reportId);
      
      if (status.processingStatus === 'DONE') {
        return await this.downloadReport(status.reportDocumentId);
      }
      
      if (status.processingStatus === 'FATAL' || status.processingStatus === 'CANCELLED') {
        throw new Error(`Report processing failed: ${status.processingStatus}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error(`Report ${reportId} timed out`);
  }
}

module.exports = BrandAnalyticsClient;