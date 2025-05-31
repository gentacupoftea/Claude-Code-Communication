/**
 * ダッシュボードコンテキストサービス
 * カレンダーモジュールと他のモジュール間の連携を管理
 */

class DashboardContextService {
  constructor() {
    // ダッシュボードごとのコンテキストを保存
    this.dashboardContexts = new Map();
  }

  /**
   * ダッシュボードコンテキストを設定
   */
  setContext(dashboardId, context) {
    this.dashboardContexts.set(dashboardId, {
      ...this.getContext(dashboardId),
      ...context,
      updatedAt: new Date()
    });
  }

  /**
   * ダッシュボードコンテキストを取得
   */
  getContext(dashboardId) {
    return this.dashboardContexts.get(dashboardId) || {
      dateRange: {
        start: null,
        end: null
      },
      filters: {},
      refreshInterval: 300000 // 5分
    };
  }

  /**
   * カレンダーの日付範囲を設定
   */
  setDateRange(dashboardId, startDate, endDate) {
    const context = this.getContext(dashboardId);
    context.dateRange = {
      start: startDate,
      end: endDate
    };
    this.setContext(dashboardId, context);

    // 日付変更をブロードキャスト
    this.broadcastDateChange(dashboardId, startDate, endDate);
  }

  /**
   * 日付変更を関連モジュールにブロードキャスト
   */
  broadcastDateChange(dashboardId, startDate, endDate) {
    // WebSocketやSSEで接続中のクライアントに通知
    // この実装では、次回のAPIリクエスト時に反映される
    console.log(`📅 Date range updated for dashboard ${dashboardId}: ${startDate} - ${endDate}`);
  }

  /**
   * APIリクエストに日付フィルターを適用
   */
  applyDateFilter(dashboardId, query) {
    const context = this.getContext(dashboardId);
    const { dateRange } = context;

    if (!dateRange.start || !dateRange.end) {
      return query;
    }

    // クエリパラメータに日付範囲を追加
    return {
      ...query,
      startDate: dateRange.start,
      endDate: dateRange.end,
      dateFilter: true
    };
  }

  /**
   * BigQueryクエリに日付条件を追加
   */
  buildDateCondition(dashboardId) {
    const context = this.getContext(dashboardId);
    const { dateRange } = context;

    if (!dateRange.start || !dateRange.end) {
      return '';
    }

    // BigQuery用の日付条件を生成
    return `
      AND DATE(created_at) >= DATE('${dateRange.start}')
      AND DATE(created_at) <= DATE('${dateRange.end}')
    `;
  }

  /**
   * チャートデータを日付範囲でフィルタリング
   */
  filterChartData(dashboardId, chartData) {
    const context = this.getContext(dashboardId);
    const { dateRange } = context;

    if (!dateRange.start || !dateRange.end) {
      return chartData;
    }

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    // データポイントをフィルタリング
    const filteredData = chartData.dataPoints.filter(point => {
      if (point.date || point.timestamp) {
        const pointDate = new Date(point.date || point.timestamp);
        return pointDate >= startDate && pointDate <= endDate;
      }
      return true; // 日付情報がない場合は含める
    });

    return {
      ...chartData,
      dataPoints: filteredData,
      dateFiltered: true,
      dateRange: dateRange
    };
  }

  /**
   * 集計期間を調整
   */
  adjustAggregationPeriod(dashboardId, originalPeriod) {
    const context = this.getContext(dashboardId);
    const { dateRange } = context;

    if (!dateRange.start || !dateRange.end) {
      return originalPeriod;
    }

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    // 期間に応じて最適な集計単位を選択
    if (daysDiff <= 7) {
      return 'daily';
    } else if (daysDiff <= 31) {
      return 'daily';
    } else if (daysDiff <= 90) {
      return 'weekly';
    } else if (daysDiff <= 365) {
      return 'monthly';
    } else {
      return 'yearly';
    }
  }

  /**
   * コンテキストをクリア
   */
  clearContext(dashboardId) {
    this.dashboardContexts.delete(dashboardId);
  }
}

module.exports = DashboardContextService;