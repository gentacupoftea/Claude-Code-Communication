import { createClient } from 'redis';
import { logger } from '../utils/logger';

class RedisClient {
  private client: any;
  private isConnected: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379/0';
    
    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            logger.error('Max Redis reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    this.client.on('error', (err: Error) => {
      logger.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Redis Client Disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  async get(key: string): Promise<string | null> {
    await this.ensureConnected();
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    await this.ensureConnected();
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.ensureConnected();
    await this.client.setEx(key, ttl, value);
  }

  async del(key: string): Promise<void> {
    await this.ensureConnected();
    await this.client.del(key);
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.ensureConnected();
    await this.client.zAdd(key, { score, value: member });
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    await this.ensureConnected();
    return this.client.zRevRange(key, start, stop);
  }

  async zcard(key: string): Promise<number> {
    await this.ensureConnected();
    return this.client.zCard(key);
  }

  async zrem(key: string, member: string): Promise<void> {
    await this.ensureConnected();
    await this.client.zRem(key, member);
  }

  async ping(): Promise<string> {
    await this.ensureConnected();
    return this.client.ping();
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }
}

// シングルトンインスタンス
export const redisClient = new RedisClient();

// 初期接続
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
  }
})();