// BigQuery API Service

import { SaveChartRequest, SaveChartResponse, DashboardData } from '../types/bigquery.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class BigQueryApiService {
  /**
   * チャートを保存
   */
  static async saveChart(data: SaveChartRequest): Promise<SaveChartResponse> {
    const response = await fetch(`${API_BASE_URL}/api/charts/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': localStorage.getItem('userId') || 'demo-user'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Failed to save chart');
    }

    return response.json();
  }

  /**
   * チャートをダッシュボードに追加
   */
  static async addToDashboard(chartId: string, dashboardId?: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/charts/${chartId}/add-to-dashboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': localStorage.getItem('userId') || 'demo-user'
      },
      body: JSON.stringify({ dashboardId })
    });

    if (!response.ok) {
      throw new Error('Failed to add to dashboard');
    }

    const result = await response.json();
    return result.dashboardId;
  }

  /**
   * ダッシュボードを読み込み
   */
  static async loadDashboard(dashboardId?: string): Promise<DashboardData | null> {
    const url = dashboardId 
      ? `${API_BASE_URL}/api/dashboards/${dashboardId}`
      : `${API_BASE_URL}/api/dashboards`;

    try {
      const response = await fetch(url, {
        headers: {
          'x-user-id': localStorage.getItem('userId') || 'demo-user'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load dashboard');
      }

      const result = await response.json();
      return result.dashboard;
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      return null;
    }
  }

  /**
   * BigQueryヘルスチェック
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/bigquery/health`);
      const result = await response.json();
      return result.enabled;
    } catch (error) {
      console.error('BigQuery health check failed:', error);
      return false;
    }
  }
}