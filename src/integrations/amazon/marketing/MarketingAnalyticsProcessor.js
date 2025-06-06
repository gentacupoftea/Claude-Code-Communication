/**
 * Amazon Marketing Analytics Processor
 * マーケティング分析処理統合
 */

import AmazonAdvertisingClient from './AmazonAdvertisingClient';
import BrandAnalyticsClient from '../analytics/BrandAnalyticsClient';
import { logger  } from '../../../utils/logger';
import { cache  } from '../../../utils/cache';
import EventEmitter from 'events';

class MarketingAnalyticsProcessor extends EventEmitter {
  constructor(config) {
    super();
    this.advertisingClient = new AmazonAdvertisingClient(config);
    this.analyticsClient = new BrandAnalyticsClient(config);
    this.cache = cache.namespace('amazon-marketing-analytics');
    this.config = config;
  }

  /**
   * Get comprehensive marketing performance
   * 包括的なマーケティングパフォーマンス取得
   * @param {Object} params - Analysis parameters
   * @returns {Promise<Object>} Marketing performance data
   */
  async getComprehensivePerformance(params = {}) {
    const startTime = Date.now();
    
    try {
      logger.info('Starting comprehensive marketing performance analysis');
      
      // Fetch data in parallel
      const [
        advertisingMetrics,
        organicMetrics,
        customerInsights,
        competitiveAnalysis
      ] = await Promise.all([
        this.getAdvertisingPerformance(params),
        this.getOrganicPerformance(params),
        this.getCustomerInsights(params),
        this.getCompetitiveAnalysis(params)
      ]);
      
      // Combine and analyze
      const analysis = {
        period: {
          startDate: params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: params.endDate || new Date()
        },
        advertising: advertisingMetrics,
        organic: organicMetrics,
        customers: customerInsights,
        competition: competitiveAnalysis,
        roi: this.calculateROI(advertisingMetrics, organicMetrics),
        recommendations: this.generateRecommendations({
          advertising: advertisingMetrics,
          organic: organicMetrics,
          customers: customerInsights,
          competition: competitiveAnalysis
        })
      };
      
      const duration = Date.now() - startTime;
      logger.info(`Marketing performance analysis completed in ${duration}ms`);
      
      return analysis;
    } catch (error) {
      logger.error('Failed to get comprehensive performance', error);
      throw error;
    }
  }

  /**
   * Get advertising performance metrics
   * 広告パフォーマンス指標取得
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Advertising metrics
   */
  async getAdvertisingPerformance(params = {}) {
    try {
      // Get campaigns data
      const campaigns = await this.advertisingClient.getCampaigns(params);
      
      // Get detailed metrics for each campaign
      const campaignMetrics = await Promise.all(
        campaigns.map(campaign => 
          this.advertisingClient.getCampaignMetrics(campaign.campaignId, params)
        )
      );
      
      // Get search term report
      const searchTerms = await this.advertisingClient.getSearchTermReport(params);
      
      // Get budget utilization
      const budgetUtilization = await this.advertisingClient.getBudgetUtilization(params);
      
      // Aggregate metrics
      const aggregated = {
        summary: {
          totalSpend: 0,
          totalRevenue: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          roas: 0,
          ctr: 0,
          cvr: 0,
          cpc: 0,
          cpa: 0
        },
        byChannel: {},
        byCampaignType: {},
        topPerformers: [],
        underperformers: [],
        searchTermPerformance: this.analyzeSearchTerms(searchTerms),
        budgetHealth: this.analyzeBudgetHealth(budgetUtilization)
      };
      
      // Process campaign metrics
      campaignMetrics.forEach((metrics, index) => {
        const campaign = campaigns[index];
        
        // Aggregate totals
        aggregated.summary.totalSpend += metrics.cost || 0;
        aggregated.summary.totalRevenue += metrics.attributedSales7d || 0;
        aggregated.summary.totalImpressions += metrics.impressions || 0;
        aggregated.summary.totalClicks += metrics.clicks || 0;
        aggregated.summary.totalConversions += metrics.attributedConversions7d || 0;
        
        // By campaign type
        const type = campaign.campaignType;
        if (!aggregated.byCampaignType[type]) {
          aggregated.byCampaignType[type] = {
            spend: 0,
            revenue: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0
          };
        }
        aggregated.byCampaignType[type].spend += metrics.cost || 0;
        aggregated.byCampaignType[type].revenue += metrics.attributedSales7d || 0;
        aggregated.byCampaignType[type].impressions += metrics.impressions || 0;
        aggregated.byCampaignType[type].clicks += metrics.clicks || 0;
        aggregated.byCampaignType[type].conversions += metrics.attributedConversions7d || 0;
        
        // Identify top/under performers
        const performance = {
          campaignId: campaign.campaignId,
          campaignName: campaign.name,
          type: campaign.campaignType,
          roas: (metrics.attributedSales7d || 0) / (metrics.cost || 1),
          spend: metrics.cost,
          revenue: metrics.attributedSales7d
        };
        
        if (performance.roas > 3) {
          aggregated.topPerformers.push(performance);
        } else if (performance.roas < 1) {
          aggregated.underperformers.push(performance);
        }
      });
      
      // Calculate summary metrics
      if (aggregated.summary.totalSpend > 0) {
        aggregated.summary.roas = aggregated.summary.totalRevenue / aggregated.summary.totalSpend;
      }
      if (aggregated.summary.totalImpressions > 0) {
        aggregated.summary.ctr = (aggregated.summary.totalClicks / aggregated.summary.totalImpressions) * 100;
      }
      if (aggregated.summary.totalClicks > 0) {
        aggregated.summary.cvr = (aggregated.summary.totalConversions / aggregated.summary.totalClicks) * 100;
        aggregated.summary.cpc = aggregated.summary.totalSpend / aggregated.summary.totalClicks;
      }
      if (aggregated.summary.totalConversions > 0) {
        aggregated.summary.cpa = aggregated.summary.totalSpend / aggregated.summary.totalConversions;
      }
      
      // Sort performers
      aggregated.topPerformers.sort((a, b) => b.roas - a.roas);
      aggregated.underperformers.sort((a, b) => a.roas - b.roas);
      
      return aggregated;
    } catch (error) {
      logger.error('Failed to get advertising performance', error);
      throw error;
    }
  }

  /**
   * Get organic performance metrics
   * オーガニック（自然検索）パフォーマンス指標取得
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Organic metrics
   */
  async getOrganicPerformance(params = {}) {
    try {
      // Get traffic and search performance
      const [traffic, searchPerformance] = await Promise.all([
        this.analyticsClient.getTrafficDiagnostics(params),
        this.analyticsClient.getSearchQueryPerformance(params)
      ]);
      
      // Process traffic data
      const trafficAnalysis = {
        summary: {
          totalPageViews: 0,
          totalSessions: 0,
          averageSessionDuration: 0,
          bounceRate: 0,
          conversionRate: 0,
          organicTrafficShare: 0
        },
        trends: [],
        peakPeriods: [],
        sources: {},
        devices: {}
      };
      
      if (traffic && traffic.reportData) {
        traffic.reportData.forEach(item => {
          trafficAnalysis.summary.totalPageViews += item.pageViews || 0;
          trafficAnalysis.summary.totalSessions += item.sessions || 0;
          
          trafficAnalysis.trends.push({
            date: item.date,
            pageViews: item.pageViews,
            sessions: item.sessions,
            conversionRate: item.unitSessionPercentage
          });
          
          // Identify peak periods
          if (item.pageViews > trafficAnalysis.summary.totalPageViews / traffic.reportData.length * 1.5) {
            trafficAnalysis.peakPeriods.push({
              date: item.date,
              pageViews: item.pageViews,
              factor: item.pageViews / (trafficAnalysis.summary.totalPageViews / traffic.reportData.length)
            });
          }
        });
      }
      
      // Process search data
      const searchAnalysis = {
        summary: {
          totalQueries: 0,
          uniqueQueries: 0,
          totalImpressions: 0,
          totalClicks: 0,
          averagePosition: 0,
          ctr: 0
        },
        topQueries: [],
        risingQueries: [],
        categories: {},
        brandedVsNonBranded: {
          branded: { queries: 0, impressions: 0, clicks: 0 },
          nonBranded: { queries: 0, impressions: 0, clicks: 0 }
        }
      };
      
      if (searchPerformance && searchPerformance.reportData) {
        searchAnalysis.summary.uniqueQueries = searchPerformance.reportData.length;
        
        searchPerformance.reportData.forEach(query => {
          searchAnalysis.summary.totalImpressions += query.impressions || 0;
          searchAnalysis.summary.totalClicks += query.clicks || 0;
          searchAnalysis.summary.averagePosition += (query.rank || 0) * (query.impressions || 0);
          
          // Top queries
          searchAnalysis.topQueries.push({
            query: query.searchTerm,
            impressions: query.impressions,
            clicks: query.clicks,
            ctr: ((query.clicks || 0) / (query.impressions || 1)) * 100,
            position: query.rank
          });
          
          // Branded vs non-branded
          const isBranded = this.isBrandedQuery(query.searchTerm);
          const queryType = isBranded ? 'branded' : 'nonBranded';
          searchAnalysis.brandedVsNonBranded[queryType].queries++;
          searchAnalysis.brandedVsNonBranded[queryType].impressions += query.impressions || 0;
          searchAnalysis.brandedVsNonBranded[queryType].clicks += query.clicks || 0;
          
          // Categories
          const category = this.categorizeQuery(query.searchTerm);
          if (!searchAnalysis.categories[category]) {
            searchAnalysis.categories[category] = {
              queries: 0,
              impressions: 0,
              clicks: 0
            };
          }
          searchAnalysis.categories[category].queries++;
          searchAnalysis.categories[category].impressions += query.impressions || 0;
          searchAnalysis.categories[category].clicks += query.clicks || 0;
        });
        
        // Calculate averages
        if (searchAnalysis.summary.totalImpressions > 0) {
          searchAnalysis.summary.averagePosition /= searchAnalysis.summary.totalImpressions;
          searchAnalysis.summary.ctr = (searchAnalysis.summary.totalClicks / searchAnalysis.summary.totalImpressions) * 100;
        }
        
        // Sort top queries
        searchAnalysis.topQueries.sort((a, b) => b.impressions - a.impressions);
        searchAnalysis.topQueries = searchAnalysis.topQueries.slice(0, 20);
      }
      
      return {
        traffic: trafficAnalysis,
        search: searchAnalysis,
        visibility: this.calculateVisibilityScore(searchAnalysis),
        opportunities: this.identifyOrganicOpportunities(searchAnalysis, trafficAnalysis)
      };
    } catch (error) {
      logger.error('Failed to get organic performance', error);
      throw error;
    }
  }

  /**
   * Get customer insights
   * 顧客インサイト取得
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Customer insights
   */
  async getCustomerInsights(params = {}) {
    try {
      const [demographics, behavior, repeatPurchase] = await Promise.all([
        this.analyticsClient.getCustomerDemographics(params),
        this.analyticsClient.getCustomerBehavior(params),
        this.analyticsClient.getRepeatPurchaseBehavior(params)
      ]);
      
      return {
        demographics: this.analyzeDemographics(demographics),
        behavior: this.analyzeBehavior(behavior),
        loyalty: this.analyzeLoyalty(repeatPurchase),
        segments: this.identifyCustomerSegments({
          demographics,
          behavior,
          repeatPurchase
        }),
        lifetime: this.calculateLifetimeMetrics(repeatPurchase)
      };
    } catch (error) {
      logger.error('Failed to get customer insights', error);
      throw error;
    }
  }

  /**
   * Get competitive analysis
   * 競合分析取得
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Competitive analysis
   */
  async getCompetitiveAnalysis(params = {}) {
    try {
      const [itemComparison, marketBasket] = await Promise.all([
        this.analyticsClient.getItemComparison(params),
        this.analyticsClient.getMarketBasketAnalysis(params)
      ]);
      
      return {
        directCompetitors: this.analyzeDirectCompetitors(itemComparison),
        marketPosition: this.analyzeMarketPosition(itemComparison),
        substitutes: this.analyzeSubstitutes(itemComparison),
        crossSelling: this.analyzeCrossSelling(marketBasket),
        competitiveAdvantages: this.identifyAdvantages(itemComparison),
        threats: this.identifyThreats(itemComparison)
      };
    } catch (error) {
      logger.error('Failed to get competitive analysis', error);
      throw error;
    }
  }

  /**
   * Calculate ROI across channels
   * チャネル横断的なROI計算
   * @param {Object} advertising - Advertising metrics
   * @param {Object} organic - Organic metrics
   * @returns {Object} ROI analysis
   */
  calculateROI(advertising, _organic) {
    const roi = {
      overall: {
        spend: advertising.summary.totalSpend,
        revenue: advertising.summary.totalRevenue,
        roi: 0,
        roas: advertising.summary.roas
      },
      byChannel: {},
      attribution: {
        lastClick: {},
        firstTouch: {},
        linear: {}
      }
    };
    
    // Calculate overall ROI
    if (roi.overall.spend > 0) {
      roi.overall.roi = ((roi.overall.revenue - roi.overall.spend) / roi.overall.spend) * 100;
    }
    
    // ROI by channel
    Object.entries(advertising.byCampaignType).forEach(([type, metrics]) => {
      roi.byChannel[type] = {
        spend: metrics.spend,
        revenue: metrics.revenue,
        roi: metrics.spend > 0 ? ((metrics.revenue - metrics.spend) / metrics.spend) * 100 : 0,
        roas: metrics.spend > 0 ? metrics.revenue / metrics.spend : 0
      };
    });
    
    // Add organic channel
    roi.byChannel.organic = {
      spend: 0,
      revenue: 0, // Would need transaction data to calculate
      roi: 0,
      roas: 0
    };
    
    return roi;
  }

  /**
   * Generate marketing recommendations
   * マーケティング推奨事項生成
   * @param {Object} data - Analysis data
   * @returns {Array} Recommendations
   */
  generateRecommendations(data) {
    const recommendations = [];
    
    // Advertising recommendations
    if (data.advertising) {
      // Budget reallocation
      if (data.advertising.underperformers.length > 0 && data.advertising.topPerformers.length > 0) {
        recommendations.push({
          category: 'budget',
          priority: 'high',
          title: '予算の再配分を推奨',
          description: `低パフォーマンスキャンペーンから高パフォーマンスキャンペーンへ予算を移動することで、ROAS を ${Math.round(data.advertising.summary.roas * 1.2)}x に改善できる可能性があります`,
          action: {
            from: data.advertising.underperformers[0].campaignName,
            to: data.advertising.topPerformers[0].campaignName,
            amount: data.advertising.underperformers[0].spend * 0.5
          }
        });
      }
      
      // Search term optimization
      if (data.advertising.searchTermPerformance) {
        const lowCTRTerms = data.advertising.searchTermPerformance.lowPerformers;
        if (lowCTRTerms && lowCTRTerms.length > 0) {
          recommendations.push({
            category: 'keywords',
            priority: 'medium',
            title: '検索キーワードの最適化',
            description: `CTRが低い検索キーワードを除外またはビッド調整することで、CPCを ${Math.round(data.advertising.summary.cpc * 0.8)}円に削減できます`,
            keywords: lowCTRTerms.slice(0, 5)
          });
        }
      }
    }
    
    // Organic recommendations
    if (data.organic) {
      const opportunities = data.organic.opportunities;
      if (opportunities && opportunities.length > 0) {
        recommendations.push({
          category: 'seo',
          priority: 'high',
          title: 'SEO改善の機会',
          description: `特定のキーワードでのランキング改善により、オーガニックトラフィックを ${Math.round(data.organic.traffic.summary.totalPageViews * 1.3).toLocaleString()} PVに増加できます`,
          opportunities: opportunities.slice(0, 3)
        });
      }
    }
    
    // Customer insights recommendations
    if (data.customers) {
      const segments = data.customers.segments;
      if (segments && segments.highValue) {
        recommendations.push({
          category: 'targeting',
          priority: 'medium',
          title: '高価値顧客セグメントへのフォーカス',
          description: `高価値顧客セグメント（全体の${segments.highValue.percentage}%）が売上の${segments.highValue.revenueShare}%を占めています。このセグメントに特化したキャンペーンを作成してください`,
          segment: segments.highValue
        });
      }
    }
    
    // Competitive recommendations
    if (data.competition) {
      const threats = data.competition.threats;
      if (threats && threats.length > 0) {
        recommendations.push({
          category: 'competitive',
          priority: 'high',
          title: '競合対策の強化',
          description: `主要競合${threats[0].competitorName}への流出を防ぐため、価格またはプロモーション戦略の見直しが必要です`,
          competitor: threats[0],
          suggestedActions: [
            '価格マッチング',
            'バンドル販売',
            '独自特典の追加'
          ]
        });
      }
    }
    
    // Sort by priority
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    return recommendations;
  }

  /**
   * Analyze search terms
   * @param {Object} searchTermData - Search term data
   * @returns {Object} Search term analysis
   */
  analyzeSearchTerms(searchTermData) {
    const analysis = {
      topPerformers: [],
      lowPerformers: [],
      risingTerms: [],
      negativeKeywords: []
    };
    
    if (searchTermData && searchTermData.length > 0) {
      // Sort by performance
      const sortedByROAS = [...searchTermData].sort((a, b) => {
        const roasA = (a.attributedSales7d || 0) / (a.cost || 1);
        const roasB = (b.attributedSales7d || 0) / (b.cost || 1);
        return roasB - roasA;
      });
      
      // Top performers
      analysis.topPerformers = sortedByROAS.slice(0, 10).map(term => ({
        query: term.searchTerm,
        impressions: term.impressions,
        clicks: term.clicks,
        cost: term.cost,
        revenue: term.attributedSales7d,
        roas: (term.attributedSales7d || 0) / (term.cost || 1)
      }));
      
      // Low performers (high cost, low revenue)
      analysis.lowPerformers = sortedByROAS
        .filter(term => term.cost > 0 && term.attributedSales7d < term.cost)
        .slice(-10)
        .map(term => ({
          query: term.searchTerm,
          cost: term.cost,
          revenue: term.attributedSales7d,
          loss: term.cost - term.attributedSales7d
        }));
      
      // Rising terms (comparing periods)
      // This would require historical data comparison
      
      // Negative keyword candidates
      analysis.negativeKeywords = searchTermData
        .filter(term => 
          term.clicks > 5 && 
          term.attributedConversions7d === 0 &&
          term.cost > 0
        )
        .map(term => ({
          query: term.searchTerm,
          wastedSpend: term.cost,
          clicks: term.clicks
        }));
    }
    
    return analysis;
  }

  /**
   * Check if query is branded
   * @param {string} query - Search query
   * @returns {boolean} Is branded
   */
  isBrandedQuery(query) {
    const brandTerms = this.config.brandNames || [];
    const lowerQuery = query.toLowerCase();
    
    return brandTerms.some(brand => lowerQuery.includes(brand.toLowerCase()));
  }

  /**
   * Categorize search query
   * @param {string} query - Search query
   * @returns {string} Category
   */
  categorizeQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    if (this.isBrandedQuery(query)) {
      return 'branded';
    } else if (lowerQuery.match(/買い方|購入|どこで/)) {
      return 'transactional';
    } else if (lowerQuery.match(/とは|方法|なぜ/)) {
      return 'informational';
    } else if (lowerQuery.match(/比較|vs|違い/)) {
      return 'comparison';
    } else {
      return 'general';
    }
  }

  /**
   * Identify customer segments
   * @param {Object} data - Customer data
   * @returns {Object} Customer segments
   */
  identifyCustomerSegments(data) {
    const segments = {
      highValue: {
        criteria: 'Top 20% by purchase value',
        percentage: 20,
        characteristics: {},
        revenueShare: 0
      },
      frequent: {
        criteria: '3+ purchases',
        percentage: 0,
        characteristics: {},
        revenueShare: 0
      },
      new: {
        criteria: 'First purchase in last 30 days',
        percentage: 0,
        characteristics: {},
        revenueShare: 0
      },
      atRisk: {
        criteria: 'No purchase in 90+ days',
        percentage: 0,
        characteristics: {},
        revenueShare: 0
      }
    };
    
    // Analyze demographics for each segment
    if (data.demographics && data.demographics.reportData) {
      // Implementation would analyze demographic data per segment
    }
    
    // Analyze behavior patterns
    if (data.behavior && data.behavior.reportData) {
      // Implementation would analyze behavior per segment
    }
    
    return segments;
  }

  /**
   * Calculate visibility score
   * @param {Object} searchAnalysis - Search analysis data
   * @returns {number} Visibility score (0-100)
   */
  calculateVisibilityScore(searchAnalysis) {
    let score = 0;
    
    // Factor 1: Average position (40%)
    const positionScore = Math.max(0, 100 - (searchAnalysis.summary.averagePosition - 1) * 20);
    score += positionScore * 0.4;
    
    // Factor 2: Click-through rate (30%)
    const ctrScore = Math.min(100, searchAnalysis.summary.ctr * 10);
    score += ctrScore * 0.3;
    
    // Factor 3: Query coverage (30%)
    const coverageScore = Math.min(100, searchAnalysis.summary.uniqueQueries);
    score += coverageScore * 0.3;
    
    return Math.round(score);
  }

  /**
   * Identify organic opportunities
   * @param {Object} searchAnalysis - Search analysis
   * @param {Object} trafficAnalysis - Traffic analysis
   * @returns {Array} Opportunities
   */
  identifyOrganicOpportunities(searchAnalysis, _trafficAnalysis) {
    const opportunities = [];
    
    // Low-hanging fruit: High impressions, low CTR
    const lowCTRQueries = searchAnalysis.topQueries
      .filter(q => q.impressions > 1000 && q.ctr < 2)
      .map(q => ({
        type: 'ctr-improvement',
        query: q.query,
        currentCTR: q.ctr,
        potentialTraffic: Math.round(q.impressions * 0.05), // Assuming 5% CTR improvement
        priority: 'high'
      }));
    
    opportunities.push(...lowCTRQueries);
    
    // Position improvement opportunities
    const positionOpportunities = searchAnalysis.topQueries
      .filter(q => q.position > 3 && q.position < 10)
      .map(q => ({
        type: 'ranking-improvement',
        query: q.query,
        currentPosition: q.position,
        targetPosition: Math.max(1, q.position - 2),
        potentialTraffic: Math.round(q.impressions * 0.2),
        priority: 'medium'
      }));
    
    opportunities.push(...positionOpportunities);
    
    // Sort by potential impact
    opportunities.sort((a, b) => b.potentialTraffic - a.potentialTraffic);
    
    return opportunities.slice(0, 10);
  }
}

module.exports = MarketingAnalyticsProcessor;