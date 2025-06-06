/**
 * MultiLLM Meeting API サービス
 */

import { backendAPI } from './backend-api';

export interface MeetingUploadResponse {
  id: string;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
  message?: string;
  uploadedAt: string;
}

export interface MeetingStatus {
  id: string;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
  progress?: number;
  message?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface MeetingResult {
  id: string;
  status: 'completed';
  metadata: {
    duration: number;
    language: string;
    speakers: number;
  };
  transcript: {
    text: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
      speaker?: string;
    }>;
  };
  summary?: {
    title: string;
    overview: string;
    keyPoints: string[];
    actionItems?: string[];
    decisions?: string[];
  };
  analysis?: {
    sentiment: 'positive' | 'neutral' | 'negative';
    topics: string[];
    keywords: string[];
  };
}

export interface ExportOptions {
  format: 'json' | 'txt' | 'pdf' | 'docx' | 'srt';
  includeTimestamps?: boolean;
  includeSpeakers?: boolean;
  includeSummary?: boolean;
  includeAnalysis?: boolean;
}

class MeetingAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_MULTILLM_API_URL || 'http://localhost:8000';
  }

  /**
   * ミーティングファイルをアップロード
   */
  async uploadMeeting(file: File, options?: {
    language?: string;
    speakerCount?: number;
    generateSummary?: boolean;
    analyzeContent?: boolean;
  }): Promise<MeetingUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, String(value));
        }
      });
    }

    const response = await fetch(`${this.baseURL}/api/v2/multillm/meeting/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        // Content-Typeは自動設定されるため指定しない
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * ミーティング処理ステータスを取得
   */
  async getStatus(meetingId: string): Promise<MeetingStatus> {
    const response = await fetch(`${this.baseURL}/api/v2/multillm/meeting/${meetingId}/status`);
    
    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * ミーティング処理結果を取得
   */
  async getResult(meetingId: string): Promise<MeetingResult> {
    const response = await fetch(`${this.baseURL}/api/v2/multillm/meeting/${meetingId}/result`);
    
    if (response.status === 202) {
      throw new Error('Meeting is still being processed');
    }
    
    if (!response.ok) {
      throw new Error(`Result fetch failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * ミーティング結果をエクスポート
   */
  async exportMeeting(meetingId: string, options: ExportOptions): Promise<Blob | unknown> {
    const response = await fetch(`${this.baseURL}/api/v2/multillm/meeting/${meetingId}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }

    if (options.format === 'json') {
      return response.json();
    } else {
      return response.blob();
    }
  }

  /**
   * ポーリングで処理完了を待つ
   */
  async waitForCompletion(
    meetingId: string, 
    options?: {
      pollingInterval?: number;
      maxAttempts?: number;
      onProgress?: (status: MeetingStatus) => void;
    }
  ): Promise<MeetingResult> {
    const { 
      pollingInterval = 5000, 
      maxAttempts = 60,
      onProgress 
    } = options || {};

    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await this.getStatus(meetingId);
      
      if (onProgress) {
        onProgress(status);
      }

      if (status.status === 'completed') {
        return this.getResult(meetingId);
      }

      if (status.status === 'error') {
        throw new Error(status.error || 'Processing failed');
      }

      await new Promise(resolve => setTimeout(resolve, pollingInterval));
      attempts++;
    }

    throw new Error('Processing timeout exceeded');
  }
}

// シングルトンインスタンス
export const meetingAPI = new MeetingAPI();

export default MeetingAPI;