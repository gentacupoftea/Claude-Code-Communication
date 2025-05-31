import { Router } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'persona-analysis',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

router.get('/ready', async (req, res) => {
  try {
    // Redis接続チェック
    const redis = await import('../services/redisClient');
    await redis.client.ping();
    
    res.json({
      status: 'ready',
      services: {
        redis: 'connected'
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'not ready',
      error: error.message
    });
  }
});

export default router;