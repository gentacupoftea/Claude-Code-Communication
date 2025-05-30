import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { redisClient } from './redisClient';
import { aiAnalysisService } from './aiAnalysisService';
import { reportGeneratorService } from './reportGeneratorService';

interface AnalysisData {
  id: string;
  userId: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  completedAt?: string;
  reportUrl?: string;
  summary?: {
    dominantPersonality: string;
    keyInsights: string[];
    recommendations: string[];
  };
  error?: string;
}

class PersonaAnalysisService {
  private readonly ANALYSIS_PREFIX = 'analysis:';
  private readonly USER_ANALYSES_PREFIX = 'user:analyses:';
  private readonly TTL = 7 * 24 * 60 * 60; // 7日間

  async saveAnalysis(analysis: AnalysisData): Promise<void> {
    const key = `${this.ANALYSIS_PREFIX}${analysis.id}`;
    await redisClient.setex(key, this.TTL, JSON.stringify(analysis));
    
    // ユーザーの分析リストに追加
    const userKey = `${this.USER_ANALYSES_PREFIX}${analysis.userId}`;
    await redisClient.zadd(userKey, Date.now(), analysis.id);
  }

  async getAnalysis(id: string, userId: string): Promise<AnalysisData | null> {
    const key = `${this.ANALYSIS_PREFIX}${id}`;
    const data = await redisClient.get(key);
    
    if (!data) return null;
    
    const analysis = JSON.parse(data) as AnalysisData;
    
    // ユーザーIDの確認
    if (analysis.userId !== userId) return null;
    
    return analysis;
  }

  async updateAnalysisStatus(
    id: string,
    status: 'processing' | 'completed' | 'failed',
    progress: number,
    additionalData?: Partial<AnalysisData>
  ): Promise<void> {
    const key = `${this.ANALYSIS_PREFIX}${id}`;
    const data = await redisClient.get(key);
    
    if (!data) {
      throw new Error('Analysis not found');
    }
    
    const analysis = JSON.parse(data) as AnalysisData;
    analysis.status = status;
    analysis.progress = progress;
    
    if (status === 'completed') {
      analysis.completedAt = new Date().toISOString();
    }
    
    if (additionalData) {
      Object.assign(analysis, additionalData);
    }
    
    await redisClient.setex(key, this.TTL, JSON.stringify(analysis));
  }

  async listAnalyses(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    analyses: AnalysisData[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const userKey = `${this.USER_ANALYSES_PREFIX}${userId}`;
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    
    // 分析IDリストを取得（新しい順）
    const analysisIds = await redisClient.zrevrange(userKey, start, end);
    const total = await redisClient.zcard(userKey);
    
    // 各分析の詳細を取得
    const analyses: AnalysisData[] = [];
    for (const id of analysisIds) {
      const analysis = await this.getAnalysis(id, userId);
      if (analysis) {
        analyses.push(analysis);
      }
    }
    
    return {
      analyses,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getAnalysisStatus(id: string, userId: string): Promise<{
    status: string;
    progress: number;
  } | null> {
    const analysis = await this.getAnalysis(id, userId);
    
    if (!analysis) return null;
    
    return {
      status: analysis.status,
      progress: analysis.progress
    };
  }

  async deleteAnalysis(id: string, userId: string): Promise<void> {
    const analysis = await this.getAnalysis(id, userId);
    
    if (!analysis) {
      throw new Error('Analysis not found');
    }
    
    // Redisから削除
    const key = `${this.ANALYSIS_PREFIX}${id}`;
    await redisClient.del(key);
    
    // ユーザーのリストから削除
    const userKey = `${this.USER_ANALYSES_PREFIX}${userId}`;
    await redisClient.zrem(userKey, id);
    
    // レポートファイルが存在する場合は削除
    if (analysis.reportUrl) {
      try {
        const reportPath = this.getReportPathFromUrl(analysis.reportUrl);
        await fs.unlink(reportPath);
      } catch (error) {
        logger.error('Error deleting report file:', error);
      }
    }
  }

  async getReportPath(id: string, userId: string): Promise<string | null> {
    const analysis = await this.getAnalysis(id, userId);
    
    if (!analysis || !analysis.reportUrl) return null;
    
    return this.getReportPathFromUrl(analysis.reportUrl);
  }

  private getReportPathFromUrl(reportUrl: string): string {
    const reportDir = process.env.REPORT_OUTPUT_DIR || './reports';
    const filename = path.basename(reportUrl);
    return path.join(reportDir, filename);
  }

  async processAnalysis(
    analysisId: string,
    userId: string,
    files: any,
    options: any,
    targetAudience: string
  ): Promise<void> {
    try {
      // 初期データを保存
      await this.saveAnalysis({
        id: analysisId,
        userId,
        status: 'processing',
        progress: 0,
        createdAt: new Date().toISOString()
      });

      // Step 1: ファイル処理とデータ抽出 (20%)
      await this.updateAnalysisStatus(analysisId, 'processing', 20);
      const extractedData = await this.extractDataFromFiles(files);

      // Step 2: AI分析 (60%)
      await this.updateAnalysisStatus(analysisId, 'processing', 60);
      const analysisResults = await aiAnalysisService.analyzePersona(
        extractedData,
        options,
        targetAudience
      );

      // Step 3: レポート生成 (80%)
      await this.updateAnalysisStatus(analysisId, 'processing', 80);
      const reportPath = await reportGeneratorService.generateReport(
        analysisId,
        analysisResults
      );

      // Step 4: 完了 (100%)
      await this.updateAnalysisStatus(analysisId, 'completed', 100, {
        reportUrl: `/reports/${path.basename(reportPath)}`,
        summary: analysisResults.summary
      });

      logger.info(`Analysis completed: ${analysisId}`);
    } catch (error) {
      logger.error(`Analysis failed: ${analysisId}`, error);
      await this.updateAnalysisStatus(analysisId, 'failed', 0, {
        error: error.message
      });
    }
  }

  private async extractDataFromFiles(files: any): Promise<any> {
    // ファイルからデータを抽出する処理
    // 実際の実装では、動画の文字起こし、CSVパース、JSONパースなどを行う
    return {
      videos: files.videos || [],
      transcript: files.transcript,
      survey: files.survey,
      purchaseData: files.purchaseData
    };
  }
}

export const personaAnalysisService = new PersonaAnalysisService();