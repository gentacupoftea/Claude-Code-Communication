const { searchConsole, searchConsoleConfig } = require('../config/search-console');

class SearchConsoleService {
  /**
   * 検索パフォーマンスデータを取得
   */
  async getSearchAnalytics(startDate, endDate, dimensions = ['query', 'page', 'country', 'device']) {
    try {
      const response = await searchConsole.searchanalytics.query({
        siteUrl: searchConsoleConfig.siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions,
          rowLimit: 1000,
          startRow: 0,
        },
      });

      return {
        rows: response.data.rows || [],
        responseAggregationType: response.data.responseAggregationType,
      };
    } catch (error) {
      console.error('Search Console検索分析エラー:', error);
      throw error;
    }
  }

  /**
   * トップクエリを取得
   */
  async getTopQueries(startDate, endDate, limit = 10) {
    try {
      const response = await searchConsole.searchanalytics.query({
        siteUrl: searchConsoleConfig.siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['query'],
          rowLimit: limit,
          startRow: 0,
          orderBy: 'impressions',
          orderDirection: 'descending',
        },
      });

      return response.data.rows || [];
    } catch (error) {
      console.error('トップクエリ取得エラー:', error);
      throw error;
    }
  }

  /**
   * ページ別パフォーマンスを取得
   */
  async getPagePerformance(startDate, endDate, limit = 20) {
    try {
      const response = await searchConsole.searchanalytics.query({
        siteUrl: searchConsoleConfig.siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['page'],
          rowLimit: limit,
          startRow: 0,
          orderBy: 'clicks',
          orderDirection: 'descending',
        },
      });

      return response.data.rows || [];
    } catch (error) {
      console.error('ページパフォーマンス取得エラー:', error);
      throw error;
    }
  }

  /**
   * サイトマップステータスを取得
   */
  async getSitemaps() {
    try {
      const response = await searchConsole.sitemaps.list({
        siteUrl: searchConsoleConfig.siteUrl,
      });

      return response.data.sitemap || [];
    } catch (error) {
      console.error('サイトマップ取得エラー:', error);
      throw error;
    }
  }
}

module.exports = new SearchConsoleService();