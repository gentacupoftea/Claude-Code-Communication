import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { personaAnalysisService } from '../services/personaAnalysisService';
import { analysisQueue } from '../services/queueService';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export const createAnalysis = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id || 'test-user';
    const analysisId = uuidv4();
    
    // ファイルの取得
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const videos = files.videos || [];
    const transcript = files.transcript?.[0];
    const survey = files.survey?.[0];
    const purchaseData = files.purchase_data?.[0];
    
    // オプションの取得
    const options = req.body.options ? JSON.parse(req.body.options) : {};
    const targetAudience = req.body.targetAudience || '';

    // 分析ジョブをキューに追加
    const job = await analysisQueue.add('analyze', {
      analysisId,
      userId,
      files: {
        videos: videos.map(f => ({
          originalname: f.originalname,
          buffer: f.buffer,
          mimetype: f.mimetype,
          size: f.size
        })),
        transcript: transcript ? {
          originalname: transcript.originalname,
          buffer: transcript.buffer,
          mimetype: transcript.mimetype,
          size: transcript.size
        } : null,
        survey: survey ? {
          originalname: survey.originalname,
          buffer: survey.buffer,
          mimetype: survey.mimetype,
          size: survey.size
        } : null,
        purchaseData: purchaseData ? {
          originalname: purchaseData.originalname,
          buffer: purchaseData.buffer,
          mimetype: purchaseData.mimetype,
          size: purchaseData.size
        } : null
      },
      options,
      targetAudience
    });

    // 初期レスポンス
    res.status(202).json({
      id: analysisId,
      status: 'processing',
      progress: 0,
      createdAt: new Date().toISOString(),
      jobId: job.id
    });
  } catch (error) {
    logger.error('Error creating analysis:', error);
    next(new AppError('Failed to create analysis', 500));
  }
};

export const getAnalysis = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'test-user';
    
    const analysis = await personaAnalysisService.getAnalysis(id, userId);
    
    if (!analysis) {
      return next(new AppError('Analysis not found', 404));
    }
    
    res.json(analysis);
  } catch (error) {
    logger.error('Error getting analysis:', error);
    next(new AppError('Failed to get analysis', 500));
  }
};

export const listAnalyses = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id || 'test-user';
    const { page = 1, limit = 10 } = req.query;
    
    const analyses = await personaAnalysisService.listAnalyses(
      userId,
      Number(page),
      Number(limit)
    );
    
    res.json(analyses);
  } catch (error) {
    logger.error('Error listing analyses:', error);
    next(new AppError('Failed to list analyses', 500));
  }
};

export const getAnalysisStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'test-user';
    
    const status = await personaAnalysisService.getAnalysisStatus(id, userId);
    
    if (!status) {
      return next(new AppError('Analysis not found', 404));
    }
    
    res.json(status);
  } catch (error) {
    logger.error('Error getting analysis status:', error);
    next(new AppError('Failed to get analysis status', 500));
  }
};

export const deleteAnalysis = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'test-user';
    
    await personaAnalysisService.deleteAnalysis(id, userId);
    
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting analysis:', error);
    next(new AppError('Failed to delete analysis', 500));
  }
};

export const downloadReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'test-user';
    
    const reportPath = await personaAnalysisService.getReportPath(id, userId);
    
    if (!reportPath) {
      return next(new AppError('Report not found', 404));
    }
    
    res.download(reportPath, `persona-analysis-${id}.pdf`);
  } catch (error) {
    logger.error('Error downloading report:', error);
    next(new AppError('Failed to download report', 500));
  }
};