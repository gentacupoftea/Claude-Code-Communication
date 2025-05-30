const { analyticsDataClient, googleAnalyticsConfig } = require('../config/google-analytics');

class GoogleAnalyticsService {
  /**
   * 基本的なレポートデータを取得
   */
  async getBasicReport(startDate, endDate, metrics = ['sessions', 'totalUsers', 'screenPageViews'], dimensions = ['date']) {
    try {
      const [response] = await analyticsDataClient.runReport({
        property: `properties/${googleAnalyticsConfig.propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: dimensions.map(name => ({ name })),
        metrics: metrics.map(name => ({ name })),
      });

      return this.formatReportResponse(response);
    } catch (error) {
      console.error('GA4レポート取得エラー:', error);
      throw error;
    }
  }

  /**
   * ECコマースデータを取得
   */
  async getEcommerceData(startDate, endDate) {
    try {
      const [response] = await analyticsDataClient.runReport({
        property: `properties/${googleAnalyticsConfig.propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'date' },
          { name: 'itemName' },
          { name: 'itemCategory' },
        ],
        metrics: [
          { name: 'itemRevenue' },
          { name: 'itemsPurchased' },
          { name: 'itemsViewed' },
          { name: 'cartToViewRate' },
          { name: 'purchaseToViewRate' },
        ],
      });

      return this.formatReportResponse(response);
    } catch (error) {
      console.error('ECコマースデータ取得エラー:', error);
      throw error;
    }
  }

  /**
   * リアルタイムデータを取得
   */
  async getRealtimeData() {
    try {
      const [response] = await analyticsDataClient.runRealtimeReport({
        property: `properties/${googleAnalyticsConfig.propertyId}`,
        dimensions: [
          { name: 'country' },
          { name: 'deviceCategory' },
        ],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
        ],
      });

      return this.formatReportResponse(response);
    } catch (error) {
      console.error('リアルタイムデータ取得エラー:', error);
      throw error;
    }
  }

  /**
   * レスポンスをフォーマット
   */
  formatReportResponse(response) {
    const headers = [
      ...(response.dimensionHeaders || []).map(header => header.name),
      ...(response.metricHeaders || []).map(header => header.name),
    ];

    const rows = (response.rows || []).map(row => {
      const values = [
        ...(row.dimensionValues || []).map(value => value.value),
        ...(row.metricValues || []).map(value => value.value),
      ];

      return headers.reduce((acc, header, index) => {
        acc[header] = values[index];
        return acc;
      }, {});
    });

    return {
      headers,
      rows,
      rowCount: response.rowCount,
      metadata: response.metadata,
    };
  }
}

module.exports = new GoogleAnalyticsService();