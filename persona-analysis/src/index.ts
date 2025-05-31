import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './middleware/rateLimit';
import personaRoutes from './routes/persona';
import healthRoutes from './routes/health';
import { initializeQueues } from './services/queueService';
import { validateEnv } from './config/validateEnv';

// 環境変数の読み込み
dotenv.config();

// 環境変数の検証
validateEnv();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8002;

// ミドルウェアの設定
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// リクエストロギング
app.use(requestLogger);

// レート制限
app.use('/api', rateLimiter);

// ルート設定
app.use('/api/persona-analysis', personaRoutes);
app.use('/health', healthRoutes);

// 404ハンドラー
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Resource not found'
  });
});

// エラーハンドリング
app.use(errorHandler);

// サーバー起動
const startServer = async () => {
  try {
    // キューシステムの初期化
    await initializeQueues();
    
    server.listen(PORT, () => {
      logger.info(`Persona Analysis Service is running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

startServer();