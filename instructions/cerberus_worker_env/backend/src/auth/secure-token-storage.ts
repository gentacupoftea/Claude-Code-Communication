import * as crypto from 'crypto';
import { Redis } from 'ioredis';

interface StoredToken {
  tokenHash: string;
  userId: string;
  clientId?: string;
  scope: string[];
  issuedAt: Date;
  expiresAt: Date;
  lastUsed?: Date;
  metadata?: Record<string, any>;
}

interface EncryptedData {
  iv: string;
  authTag: string;
  encrypted: string;
}

/**
 * Secure token storage with encryption at rest
 */
export class SecureTokenStorage {
  private redis: Redis;
  private encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private readonly tokenPrefix = 'token:';
  private readonly userTokensPrefix = 'user:tokens:';
  private readonly clientTokensPrefix = 'client:tokens:';

  constructor(redisConfig?: { host: string; port: number }) {
    this.redis = new Redis(redisConfig || {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      keyPrefix: 'auth:',
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });

    // Derive encryption key from master secret
    const masterSecret = process.env.TOKEN_ENCRYPTION_SECRET || 'default-encryption-secret';
    this.encryptionKey = crypto.pbkdf2Sync(masterSecret, 'token-storage-salt', 100000, 32, 'sha256');
  }

  /**
   * Store token securely with encryption
   */
  async storeToken(
    token: string,
    userId: string,
    expiresAt: Date,
    metadata?: {
      clientId?: string;
      scope?: string[];
      [key: string]: any;
    }
  ): Promise<void> {
    // Hash token for storage key
    const tokenHash = this.hashToken(token);
    
    // Prepare token data
    const tokenData: StoredToken = {
      tokenHash,
      userId,
      clientId: metadata?.clientId,
      scope: metadata?.scope || [],
      issuedAt: new Date(),
      expiresAt,
      metadata: metadata || {}
    };

    // Encrypt sensitive data
    const encryptedData = this.encrypt(JSON.stringify(tokenData));
    
    // Calculate TTL
    const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    
    if (ttl > 0) {
      // Store encrypted token
      await this.redis.setex(
        this.tokenPrefix + tokenHash,
        ttl,
        JSON.stringify(encryptedData)
      );

      // Add to user's token set
      await this.redis.sadd(this.userTokensPrefix + userId, tokenHash);
      await this.redis.expire(this.userTokensPrefix + userId, ttl);

      // Add to client's token set if applicable
      if (metadata?.clientId) {
        await this.redis.sadd(this.clientTokensPrefix + metadata.clientId, tokenHash);
        await this.redis.expire(this.clientTokensPrefix + metadata.clientId, ttl);
      }
    }
  }

  /**
   * Retrieve token data
   */
  async getToken(token: string): Promise<StoredToken | null> {
    const tokenHash = this.hashToken(token);
    const encryptedData = await this.redis.get(this.tokenPrefix + tokenHash);
    
    if (!encryptedData) {
      return null;
    }

    try {
      const encrypted = JSON.parse(encryptedData) as EncryptedData;
      const decrypted = this.decrypt(encrypted);
      const tokenData = JSON.parse(decrypted) as StoredToken;
      
      // Update last used timestamp
      tokenData.lastUsed = new Date();
      const updatedEncrypted = this.encrypt(JSON.stringify(tokenData));
      const ttl = await this.redis.ttl(this.tokenPrefix + tokenHash);
      
      if (ttl > 0) {
        await this.redis.setex(
          this.tokenPrefix + tokenHash,
          ttl,
          JSON.stringify(updatedEncrypted)
        );
      }
      
      return tokenData;
    } catch (error) {
      console.error('Failed to decrypt token data:', error);
      return null;
    }
  }

  /**
   * Revoke token
   */
  async revokeToken(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const tokenData = await this.getToken(token);
    
    if (!tokenData) {
      return false;
    }

    // Remove from storage
    await this.redis.del(this.tokenPrefix + tokenHash);
    
    // Remove from user's token set
    await this.redis.srem(this.userTokensPrefix + tokenData.userId, tokenHash);
    
    // Remove from client's token set if applicable
    if (tokenData.clientId) {
      await this.redis.srem(this.clientTokensPrefix + tokenData.clientId, tokenHash);
    }
    
    return true;
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeUserTokens(userId: string): Promise<number> {
    const tokenHashes = await this.redis.smembers(this.userTokensPrefix + userId);
    
    if (tokenHashes.length === 0) {
      return 0;
    }

    const pipeline = this.redis.pipeline();
    
    for (const tokenHash of tokenHashes) {
      pipeline.del(this.tokenPrefix + tokenHash);
    }
    
    pipeline.del(this.userTokensPrefix + userId);
    
    await pipeline.exec();
    
    return tokenHashes.length;
  }

  /**
   * Revoke all tokens for a client
   */
  async revokeClientTokens(clientId: string): Promise<number> {
    const tokenHashes = await this.redis.smembers(this.clientTokensPrefix + clientId);
    
    if (tokenHashes.length === 0) {
      return 0;
    }

    const pipeline = this.redis.pipeline();
    
    for (const tokenHash of tokenHashes) {
      pipeline.del(this.tokenPrefix + tokenHash);
    }
    
    pipeline.del(this.clientTokensPrefix + clientId);
    
    await pipeline.exec();
    
    return tokenHashes.length;
  }

  /**
   * Clean up expired tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    // Redis automatically removes expired keys
    // This method can be used for additional cleanup if needed
    return 0;
  }

  /**
   * Get token statistics for monitoring
   */
  async getTokenStats(): Promise<{
    totalTokens: number;
    userCount: number;
    clientCount: number;
  }> {
    const [totalTokens, userKeys, clientKeys] = await Promise.all([
      this.redis.eval(
        `return #redis.call('keys', '${this.tokenPrefix}*')`,
        0
      ) as Promise<number>,
      this.redis.eval(
        `return #redis.call('keys', '${this.userTokensPrefix}*')`,
        0
      ) as Promise<number>,
      this.redis.eval(
        `return #redis.call('keys', '${this.clientTokensPrefix}*')`,
        0
      ) as Promise<number>
    ]);

    return {
      totalTokens,
      userCount: userKeys,
      clientCount: clientKeys
    };
  }

  /**
   * Hash token using HMAC-SHA256
   */
  private hashToken(token: string): string {
    return crypto
      .createHmac('sha256', this.encryptionKey)
      .update(token)
      .digest('hex');
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private encrypt(data: string): EncryptedData {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private decrypt(encryptedData: EncryptedData): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}