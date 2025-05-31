/**
 * Google Search Console分析プロセッサー
 * SEOデータの高度な分析とインサイト生成
 * 
 * @module AnalyticsProcessor
 * @requires events
 */

const { EventEmitter } = require('events');
const logger = require('../../../utils/logger').child({ module: 'GSCAnalyticsProcessor' });
const QueryData = require('../models/QueryData');
const PerformanceData = require('../models/PerformanceData');
const cache = require('../../../utils/cache');

/**
 * SEO分析プロセッサークラス
 * 検索データの分析、トレンド検出、インサイト生成を実行
 * 
 * @class AnalyticsProcessor
 * @extends EventEmitter
 */
class AnalyticsProcessor extends EventEmitter {
  constructor() {
    super();
    
    // 分析設定
    this.config = {
      minImpressionsForAnalysis: 10,
      significantChangeThreshold: 0.2, // 20%
      trendPeriodDays: 30,
      correlationThreshold: 0.7,
      rankingBuckets: [
        { name: 'Top 3', min: 1, max: 3 },
        { name: 'Top 10', min: 4, max: 10 },
        { name: 'Page 2', min: 11, max: 20 },
        { name: 'Page 3+', min: 21, max: 100 }
      ]
    };
    
    this.initialize();
  }

  /**
   * プロセッサーを初期化
   * @private
   */
  initialize() {
    logger.info('Analytics Processorが初期化されました');
    this.emit('initialized');
  }

  /**
   * 包括的な分析を実行
   * @param {Object} params - 分析パラメータ
   * @returns {Object} 分析結果
   */
  async performComprehensiveAnalysis(params) {
    const {
      siteUrl,
      startDate,
      endDate,
      previousStartDate,
      previousEndDate
    } = params;
    
    try {
      logger.info('包括的な分析を開始します', params);
      
      const results = {
        overview: await this.analyzeOverview(params),
        keywords: await this.analyzeKeywords(params),
        pages: await this.analyzePages(params),
        devices: await this.analyzeDevices(params),
        countries: await this.analyzeCountries(params),
        trends: await this.analyzeTrends(params),
        opportunities: await this.identifyOpportunities(params),
        correlations: await this.analyzeCorrelations(params),
        seasonality: await this.analyzeSeasonality(params),
        recommendations: await this.generateRecommendations(params)
      };
      
      logger.info('包括的な分析が完了しました');
      this.emit('analysisComplete', results);
      
      return results;
      
    } catch (error) {
      logger.error('包括的な分析でエラーが発生しました', { error });
      this.emit('analysisError', error);
      throw error;
    }
  }

  /**
   * 概要分析を実行
   * @private
   */
  async analyzeOverview(params) {
    const { siteUrl, startDate, endDate, previousStartDate, previousEndDate } = params;
    
    try {
      // 現在期間の統計
      const currentStats = await PerformanceData.getStatistics({
        siteUrl,
        startDate,
        endDate
      });
      
      // 前期間の統計
      const previousStats = await PerformanceData.getStatistics({
        siteUrl,
        startDate: previousStartDate,
        endDate: previousEndDate
      });
      
      // 変化率を計算
      const changes = this.calculateChanges(currentStats, previousStats);
      
      return {
        current: currentStats,
        previous: previousStats,
        changes,
        summary: this.generateOverviewSummary(currentStats, changes)
      };
      
    } catch (error) {
      logger.error('概要分析でエラーが発生しました', { error });
      throw error;
    }
  }

  /**
   * キーワード分析を実行
   * @private
   */
  async analyzeKeywords(params) {
    const { siteUrl, startDate, endDate } = params;
    
    try {
      // トップキーワード
      const topKeywords = await QueryData.getTopQueries({
        siteUrl,
        startDate,
        endDate,
        limit: 50
      });
      
      // キーワードカテゴリー分析
      const categories = await this.categorizeKeywords(topKeywords);
      
      // ロングテールキーワード分析
      const longTailAnalysis = await this.analyzeLongTailKeywords({
        siteUrl,
        startDate,
        endDate
      });
      
      // ブランドキーワード分析
      const brandAnalysis = await this.analyzeBrandKeywords({
        siteUrl,
        startDate,
        endDate
      });
      
      // キーワード機会
      const opportunities = await this.identifyKeywordOpportunities(topKeywords);
      
      return {
        topKeywords,
        categories,
        longTailAnalysis,
        brandAnalysis,
        opportunities,
        insights: this.generateKeywordInsights(topKeywords, categories)
      };
      
    } catch (error) {
      logger.error('キーワード分析でエラーが発生しました', { error });
      throw error;
    }
  }

  /**
   * ページ分析を実行
   * @private
   */
  async analyzePages(params) {
    const { siteUrl, startDate, endDate } = params;
    
    try {
      // ページパフォーマンス
      const pagePerformance = await QueryData.getPagePerformance({
        siteUrl,
        startDate,
        endDate,
        limit: 100
      });
      
      // ページランキング分布
      const rankingDistribution = await this.analyzePageRankings(pagePerformance);
      
      // ページ機会
      const opportunities = await this.identifyPageOpportunities(pagePerformance);
      
      // ページ問題の検出
      const issues = await this.detectPageIssues(pagePerformance);
      
      return {
        topPages: pagePerformance.slice(0, 20),
        rankingDistribution,
        opportunities,
        issues,
        insights: this.generatePageInsights(pagePerformance)
      };
      
    } catch (error) {
      logger.error('ページ分析でエラーが発生しました', { error });
      throw error;
    }
  }

  /**
   * キーワードをカテゴリー分類
   * @private
   */
  async categorizeKeywords(keywords) {
    const categories = {
      informational: [],
      transactional: [],
      navigational: [],
      commercial: [],
      branded: []
    };
    
    const patterns = {
      informational: ['とは', 'どうやって', '方法', '意味', '違い'],
      transactional: ['購入', '買う', '価格', '値段', '最安'],
      navigational: ['ログイン', 'サイト', 'ホームページ'],
      commercial: ['おすすめ', 'ランキング', '評価', 'レビュー']
    };
    
    for (const keyword of keywords) {
      let categorized = false;
      
      for (const [category, keywordPatterns] of Object.entries(patterns)) {
        if (keywordPatterns.some(pattern => keyword.query.includes(pattern))) {
          categories[category].push(keyword);
          categorized = true;
          break;
        }
      }
      
      if (!categorized) {
        // デフォルトカテゴリーを決定
        if (keyword.avgPosition <= 10) {
          categories.commercial.push(keyword);
        } else {
          categories.informational.push(keyword);
        }
      }
    }
    
    return categories;
  }

  /**
   * ロングテールキーワードを分析
   * @private
   */
  async analyzeLongTailKeywords(params) {
    const { siteUrl, startDate, endDate } = params;
    
    try {
      const allKeywords = await QueryData.find({
        siteUrl,
        startDate,
        endDate,
        minImpressions: 1
      });
      
      const longTail = allKeywords.filter(kw => {
        const wordCount = kw.query.split(' ').length;
        return wordCount >= 3;
      });
      
      const shortTail = allKeywords.filter(kw => {
        const wordCount = kw.query.split(' ').length;
        return wordCount <= 2;
      });
      
      return {
        longTailCount: longTail.length,
        shortTailCount: shortTail.length,
        longTailPercentage: (longTail.length / allKeywords.length) * 100,
        longTailClicks: longTail.reduce((sum, kw) => sum + kw.clicks, 0),
        shortTailClicks: shortTail.reduce((sum, kw) => sum + kw.clicks, 0),
        topLongTailKeywords: longTail
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 20)
      };
      
    } catch (error) {
      logger.error('ロングテールキーワード分析でエラーが発生しました', { error });
      throw error;
    }
  }

  /**
   * ブランドキーワードを分析
   * @private
   */
  async analyzeBrandKeywords(params) {
    const { siteUrl, startDate, endDate } = params;
    const brandTerms = process.env.BRAND_KEYWORDS?.split(',') || [];
    
    try {
      const allKeywords = await QueryData.find({
        siteUrl,
        startDate,
        endDate
      });
      
      const brandKeywords = allKeywords.filter(kw =>
        brandTerms.some(term => kw.query.toLowerCase().includes(term.toLowerCase()))
      );
      
      const nonBrandKeywords = allKeywords.filter(kw =>
        !brandTerms.some(term => kw.query.toLowerCase().includes(term.toLowerCase()))
      );
      
      return {
        brandCount: brandKeywords.length,
        nonBrandCount: nonBrandKeywords.length,
        brandPercentage: (brandKeywords.length / allKeywords.length) * 100,
        brandClicks: brandKeywords.reduce((sum, kw) => sum + kw.clicks, 0),
        nonBrandClicks: nonBrandKeywords.reduce((sum, kw) => sum + kw.clicks, 0),
        brandCTR: this.calculateAverageCTR(brandKeywords),
        nonBrandCTR: this.calculateAverageCTR(nonBrandKeywords),
        topBrandKeywords: brandKeywords
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 10)
      };
      
    } catch (error) {
      logger.error('ブランドキーワード分析でエラーが発生しました', { error });
      throw error;
    }
  }

  /**
   * キーワード機会を特定
   * @private
   */
  async identifyKeywordOpportunities(keywords) {
    const opportunities = [];
    
    for (const keyword of keywords) {
      // 高印象数・低CTRのキーワード
      if (keyword.totalImpressions > 1000 && keyword.avgCtr < 0.02) {
        opportunities.push({
          type: 'low_ctr',
          keyword: keyword.query,
          impressions: keyword.totalImpressions,
          ctr: keyword.avgCtr,
          position: keyword.avgPosition,
          potentialClicks: Math.round(keyword.totalImpressions * 0.05)
        });
      }
      
      // ランキング4-10位のキーワード（改善余地あり）
      if (keyword.avgPosition >= 4 && keyword.avgPosition <= 10) {
        opportunities.push({
          type: 'ranking_improvement',
          keyword: keyword.query,
          currentPosition: keyword.avgPosition,
          targetPosition: 3,
          currentClicks: keyword.totalClicks,
          potentialClicks: Math.round(keyword.totalClicks * 2)
        });
      }
      
      // 11-20位で高印象数のキーワード
      if (keyword.avgPosition >= 11 && keyword.avgPosition <= 20 && keyword.totalImpressions > 500) {
        opportunities.push({
          type: 'page2_opportunity',
          keyword: keyword.query,
          currentPosition: keyword.avgPosition,
          impressions: keyword.totalImpressions,
          potentialClicks: Math.round(keyword.totalImpressions * 0.1)
        });
      }
    }
    
    return opportunities.sort((a, b) => b.potentialClicks - a.potentialClicks);
  }

  /**
   * ページランキングを分析
   * @private
   */
  async analyzePageRankings(pages) {
    const distribution = {};
    
    for (const bucket of this.config.rankingBuckets) {
      distribution[bucket.name] = pages.filter(page =>
        page.avgPosition >= bucket.min && page.avgPosition <= bucket.max
      ).length;
    }
    
    return distribution;
  }

  /**
   * トレンド分析を実行
   * @private
   */
  async analyzeTrends(params) {
    const { siteUrl, startDate, endDate } = params;
    
    try {
      // 全体的なトレンド
      const overallTrend = await PerformanceData.analyzeTrends({
        siteUrl,
        startDate,
        endDate,
        metric: 'clicks'
      });
      
      // トップキーワードのトレンド
      const topKeywords = await QueryData.getTopQueries({
        siteUrl,
        startDate,
        endDate,
        limit: 10
      });
      
      const keywordTrends = [];
      for (const keyword of topKeywords) {
        const trend = await QueryData.analyzeTrends({
          siteUrl,
          query: keyword.query,
          startDate,
          endDate
        });
        
        keywordTrends.push({
          keyword: keyword.query,
          trend: trend
        });
      }
      
      // デバイス別トレンド
      const deviceTrends = await this.analyzeDeviceTrends({
        siteUrl,
        startDate,
        endDate
      });
      
      return {
        overall: overallTrend,
        keywords: keywordTrends,
        devices: deviceTrends,
        insights: this.generateTrendInsights(overallTrend, keywordTrends)
      };
      
    } catch (error) {
      logger.error('トレンド分析でエラーが発生しました', { error });
      throw error;
    }
  }

  /**
   * 相関分析を実行
   * @private
   */
  async analyzeCorrelations(params) {
    const { siteUrl, startDate, endDate } = params;
    
    try {
      // ポジションとCTRの相関
      const positionCtrCorrelation = await this.calculatePositionCtrCorrelation({
        siteUrl,
        startDate,
        endDate
      });
      
      // 文字数とランキングの相関
      const lengthRankingCorrelation = await this.calculateLengthRankingCorrelation({
        siteUrl,
        startDate,
        endDate
      });
      
      // デバイスとCTRの相関
      const deviceCtrCorrelation = await this.calculateDeviceCtrCorrelation({
        siteUrl,
        startDate,
        endDate
      });
      
      return {
        positionCtr: positionCtrCorrelation,
        lengthRanking: lengthRankingCorrelation,
        deviceCtr: deviceCtrCorrelation,
        insights: this.generateCorrelationInsights({
          positionCtrCorrelation,
          lengthRankingCorrelation,
          deviceCtrCorrelation
        })
      };
      
    } catch (error) {
      logger.error('相関分析でエラーが発生しました', { error });
      throw error;
    }
  }

  /**
   * 季節性を分析
   * @private
   */
  async analyzeSeasonality(params) {
    const { siteUrl } = params;
    
    try {
      // 過去1年分のデータを取得
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
      
      const monthlyData = await PerformanceData.find({
        siteUrl,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
      
      // 月別に集計
      const monthlyAggregates = this.aggregateByMonth(monthlyData);
      
      // 季節指数を計算
      const seasonalityIndex = this.calculateSeasonalityIndex(monthlyAggregates);
      
      // 季節キーワードを特定
      const seasonalKeywords = await this.identifySeasonalKeywords({
        siteUrl,
        monthlyAggregates
      });
      
      return {
        monthlyTrends: monthlyAggregates,
        seasonalityIndex,
        seasonalKeywords,
        insights: this.generateSeasonalityInsights(seasonalityIndex, seasonalKeywords)
      };
      
    } catch (error) {
      logger.error('季節性分析でエラーが発生しました', { error });
      throw error;
    }
  }

  /**
   * 推奨事項を生成
   * @private
   */
  async generateRecommendations(analysisResults) {
    const recommendations = [];
    
    // キーワード関連の推奨事項
    if (analysisResults.keywords?.opportunities?.length > 0) {
      recommendations.push({
        category: 'キーワード最適化',
        priority: 'high',
        action: 'CTRが低いキーワードのメタディスクリプション改善',
        impact: '月間クリック数を20%増加可能',
        details: analysisResults.keywords.opportunities.slice(0, 5)
      });
    }
    
    // ページ関連の推奨事項
    if (analysisResults.pages?.opportunities?.length > 0) {
      recommendations.push({
        category: 'ページ最適化',
        priority: 'medium',
        action: '2ページ目のコンテンツを1ページ目に押し上げる',
        impact: 'オーガニックトラフィック30%増加可能',
        details: analysisResults.pages.opportunities.slice(0, 5)
      });
    }
    
    // トレンド関連の推奨事項
    if (analysisResults.trends?.overall?.trend === 'down') {
      recommendations.push({
        category: 'トレンド改善',
        priority: 'high',
        action: '下降トレンドの原因調査と対策実施',
        impact: 'トラフィック回復',
        details: {
          currentTrend: analysisResults.trends.overall
        }
      });
    }
    
    // デバイス関連の推奨事項
    if (analysisResults.devices?.mobile?.ctr < 0.02) {
      recommendations.push({
        category: 'モバイル最適化',
        priority: 'medium',
        action: 'モバイルユーザー体験の改善',
        impact: 'モバイルCTR50%向上可能',
        details: {
          currentMobileCtr: analysisResults.devices.mobile.ctr
        }
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * 変化率を計算
   * @private
   */
  calculateChanges(current, previous) {
    const changes = {};
    
    for (const metric of ['totalClicks', 'totalImpressions', 'avgCtr', 'avgPosition']) {
      const currentValue = current[metric] || 0;
      const previousValue = previous[metric] || 0;
      
      if (previousValue === 0) {
        changes[metric] = currentValue > 0 ? 100 : 0;
      } else {
        changes[metric] = ((currentValue - previousValue) / previousValue) * 100;
      }
    }
    
    return changes;
  }

  /**
   * 平均CTRを計算
   * @private
   */
  calculateAverageCTR(keywords) {
    if (keywords.length === 0) return 0;
    
    const totalClicks = keywords.reduce((sum, kw) => sum + kw.clicks, 0);
    const totalImpressions = keywords.reduce((sum, kw) => sum + kw.impressions, 0);
    
    return totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  }

  /**
   * キャッシュキーを生成
   * @private
   */
  generateCacheKey(operation, params) {
    return `gsc:analytics:${operation}:${JSON.stringify(params)}`;
  }

  /**
   * 分析結果をキャッシュ
   * @private
   */
  async cacheAnalysisResult(key, result, ttl = 3600) {
    await cache.set(key, JSON.stringify(result), ttl);
  }

  /**
   * インサイトを生成（各種）
   * @private
   */
  generateOverviewSummary(stats, changes) {
    const insights = [];
    
    if (changes.totalClicks > 20) {
      insights.push(`クリック数が${changes.totalClicks.toFixed(1)}%増加しました`);
    } else if (changes.totalClicks < -20) {
      insights.push(`クリック数が${Math.abs(changes.totalClicks).toFixed(1)}%減少しました`);
    }
    
    if (stats.avgPosition < 10) {
      insights.push('平均掲載順位は1ページ目を維持しています');
    }
    
    if (stats.avgCtr > 0.05) {
      insights.push('CTRは業界平均を上回っています');
    }
    
    return insights;
  }

  generateKeywordInsights(keywords, categories) {
    const insights = [];
    
    const topKeyword = keywords[0];
    if (topKeyword) {
      insights.push(`最もパフォーマンスの高いキーワードは「${topKeyword.query}」です`);
    }
    
    const informationalRatio = categories.informational.length / keywords.length;
    if (informationalRatio > 0.5) {
      insights.push('情報検索型のキーワードが多数を占めています');
    }
    
    return insights;
  }

  generatePageInsights(pages) {
    const insights = [];
    
    const topPage = pages[0];
    if (topPage) {
      insights.push(`最もトラフィックの多いページは${topPage.page}です`);
    }
    
    const avgQueries = pages.reduce((sum, page) => sum + page.uniqueQueries, 0) / pages.length;
    if (avgQueries > 50) {
      insights.push('各ページが多様なキーワードでランクインしています');
    }
    
    return insights;
  }

  generateTrendInsights(overall, keywords) {
    const insights = [];
    
    if (overall.trend === 'up') {
      insights.push(`全体的なトラフィックは${overall.changeRate}%増加傾向にあります`);
    } else if (overall.trend === 'down') {
      insights.push(`全体的なトラフィックは${Math.abs(overall.changeRate)}%減少傾向にあります`);
    }
    
    const risingKeywords = keywords.filter(kw => kw.trend.trend === 'up');
    if (risingKeywords.length > 0) {
      insights.push(`${risingKeywords.length}個のキーワードが上昇傾向を示しています`);
    }
    
    return insights;
  }
}

module.exports = new AnalyticsProcessor();