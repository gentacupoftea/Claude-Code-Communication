import Bull from 'bull';
import { logger } from '../utils/logger';
import { personaAnalysisService } from './personaAnalysisService';

// 分析ジョブキューの作成
export const analysisQueue = new Bull('persona-analysis', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

// ジョブプロセッサーの定義
analysisQueue.process('analyze', async (job) => {
  const { analysisId, userId, files, options, targetAudience } = job.data;
  
  logger.info(`Processing analysis job: ${analysisId}`);
  
  try {
    // 分析処理を実行
    await personaAnalysisService.processAnalysis(
      analysisId,
      userId,
      files,
      options,
      targetAudience
    );
    
    logger.info(`Analysis job completed: ${analysisId}`);
    return { success: true, analysisId };
  } catch (error) {
    logger.error(`Analysis job failed: ${analysisId}`, error);
    throw error;
  }
});

// ジョブイベントハンドラー
analysisQueue.on('completed', (job, result) => {
  logger.info(`Job ${job.id} completed with result:`, result);
});

analysisQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed with error:`, err);
});

analysisQueue.on('stalled', (job) => {
  logger.warn(`Job ${job.id} stalled and will be retried`);
});

// キューの初期化
export const initializeQueues = async () => {
  try {
    // キューのヘルスチェック
    await analysisQueue.isReady();
    logger.info('Queue service initialized successfully');
    
    // 古いジョブのクリーンアップ
    await analysisQueue.clean(24 * 60 * 60 * 1000, 'completed'); // 24時間以上前の完了ジョブ
    await analysisQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // 7日以上前の失敗ジョブ
  } catch (error) {
    logger.error('Failed to initialize queue service:', error);
    throw error;
  }
};

// キューの統計情報を取得
export const getQueueStats = async () => {
  const [
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused
  ] = await Promise.all([
    analysisQueue.getWaitingCount(),
    analysisQueue.getActiveCount(),
    analysisQueue.getCompletedCount(),
    analysisQueue.getFailedCount(),
    analysisQueue.getDelayedCount(),
    analysisQueue.getPausedCount()
  ]);
  
  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused
  };
};

// ジョブの手動リトライ
export const retryJob = async (jobId: string) => {
  const job = await analysisQueue.getJob(jobId);
  if (job) {
    await job.retry();
    return true;
  }
  return false;
};

// グレースフルシャットダウン
export const shutdownQueues = async () => {
  logger.info('Shutting down queue service...');
  await analysisQueue.close();
  logger.info('Queue service shut down successfully');
};