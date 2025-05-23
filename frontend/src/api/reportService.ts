/**
 * Report API Service
 * Handles all report-related API calls
 */
import axios from 'axios';
import { API_BASE_URL } from './environment';

const API_URL = `${API_BASE_URL}/api/reports`;

export interface ReportConfig {
  name: string;
  type: 'sales' | 'inventory' | 'customer' | 'seo' | 'custom';
  platforms: string[];
  dateRange: { start: Date; end: Date };
  format: 'pdf' | 'excel' | 'csv';
  options?: {
    includeCharts?: boolean;
    includeRawData?: boolean;
  };
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    recipients: string[];
  };
}

export interface Report {
  id: string;
  name: string;
  type: string;
  platforms: string[];
  dateRange: { start: Date; end: Date };
  format: string;
  status: 'completed' | 'processing' | 'scheduled' | 'failed';
  createdAt: Date;
  fileSize?: number;
  downloadUrl?: string;
  progress?: number;
  schedule?: {
    frequency: string;
    nextRun: Date;
    recipients?: string[];
  };
}

class ReportService {
  /**
   * Get all reports
   */
  async getReports(): Promise<Report[]> {
    try {
      const response = await axios.get(API_URL);
      return response.data.map((report: any) => ({
        ...report,
        dateRange: {
          start: new Date(report.dateRange.start),
          end: new Date(report.dateRange.end),
        },
        createdAt: new Date(report.createdAt),
        schedule: report.schedule ? {
          ...report.schedule,
          nextRun: new Date(report.schedule.nextRun),
        } : undefined,
      }));
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      throw error;
    }
  }

  /**
   * Generate a new report
   */
  async generateReport(config: ReportConfig): Promise<Report> {
    try {
      const response = await axios.post(`${API_URL}/generate`, config);
      return {
        ...response.data,
        dateRange: {
          start: new Date(response.data.dateRange.start),
          end: new Date(response.data.dateRange.end),
        },
        createdAt: new Date(response.data.createdAt),
      };
    } catch (error) {
      console.error('Failed to generate report:', error);
      throw error;
    }
  }

  /**
   * Get report generation progress
   */
  async getReportProgress(reportId: string): Promise<{ progress: number; status: string }> {
    try {
      const response = await axios.get(`${API_URL}/${reportId}/progress`);
      return response.data;
    } catch (error) {
      console.error('Failed to get report progress:', error);
      throw error;
    }
  }

  /**
   * Download a report
   */
  async downloadReport(reportId: string): Promise<Blob> {
    try {
      const response = await axios.get(`${API_URL}/${reportId}/download`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Failed to download report:', error);
      throw error;
    }
  }

  /**
   * Schedule a report
   */
  async scheduleReport(config: ReportConfig): Promise<Report> {
    try {
      const response = await axios.post(`${API_URL}/schedule`, config);
      return {
        ...response.data,
        dateRange: {
          start: new Date(response.data.dateRange.start),
          end: new Date(response.data.dateRange.end),
        },
        createdAt: new Date(response.data.createdAt),
        schedule: {
          ...response.data.schedule,
          nextRun: new Date(response.data.schedule.nextRun),
        },
      };
    } catch (error) {
      console.error('Failed to schedule report:', error);
      throw error;
    }
  }

  /**
   * Update scheduled report
   */
  async updateScheduledReport(reportId: string, config: Partial<ReportConfig>): Promise<Report> {
    try {
      const response = await axios.put(`${API_URL}/${reportId}/schedule`, config);
      return {
        ...response.data,
        dateRange: {
          start: new Date(response.data.dateRange.start),
          end: new Date(response.data.dateRange.end),
        },
        createdAt: new Date(response.data.createdAt),
        schedule: {
          ...response.data.schedule,
          nextRun: new Date(response.data.schedule.nextRun),
        },
      };
    } catch (error) {
      console.error('Failed to update scheduled report:', error);
      throw error;
    }
  }

  /**
   * Delete a report
   */
  async deleteReport(reportId: string): Promise<void> {
    try {
      await axios.delete(`${API_URL}/${reportId}`);
    } catch (error) {
      console.error('Failed to delete report:', error);
      throw error;
    }
  }

  /**
   * Get report templates
   */
  async getReportTemplates(): Promise<any[]> {
    try {
      const response = await axios.get(`${API_URL}/templates`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch report templates:', error);
      throw error;
    }
  }
}

export const reportService = new ReportService();