/**
 * サーキットブレーカーの実装
 * 障害を検知して自動的にサービスを遮断し、復旧を試みる
 */

import { EventEmitter } from 'events';
import { CircuitBreakerState } from '../interfaces/IFallbackService';
import { logger } from './logger';

export interface CircuitBreakerConfig {
  threshold: number;      // 失敗回数の閾値
  timeout: number;        // タイムアウト時間（ミリ秒）
  resetTimeout: number;   // リセットまでの時間（ミリ秒）
  halfOpenRetries: number; // ハーフオープン状態での最大リトライ数
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState;
  private config: CircuitBreakerConfig;
  private halfOpenAttempts: number = 0;

  constructor(config: CircuitBreakerConfig) {
    super();
    this.config = {
      halfOpenRetries: 3,
      ...config
    };
    
    this.state = {
      state: 'CLOSED',
      failures: 0,
      lastFailureTime: 0,
      nextRetryTime: 0,
      successCount: 0
    };
  }

  canExecute(): boolean {
    switch (this.state.state) {
      case 'CLOSED':
        return true;
        
      case 'OPEN':
        if (Date.now() >= this.state.nextRetryTime) {
          this.transitionToHalfOpen();
          return true;
        }
        return false;
        
      case 'HALF_OPEN':
        return this.halfOpenAttempts < this.config.halfOpenRetries;
        
      default:
        return false;
    }
  }

  recordSuccess(): void {
    switch (this.state.state) {
      case 'CLOSED':
        this.state.successCount++;
        break;
        
      case 'HALF_OPEN':
        this.state.successCount++;
        if (this.state.successCount >= this.config.halfOpenRetries) {
          this.transitionToClosed();
        }
        break;
        
      case 'OPEN':
        // Should not happen, but handle gracefully
        logger.warn('Success recorded in OPEN state');
        break;
    }
  }

  recordFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();

    switch (this.state.state) {
      case 'CLOSED':
        if (this.state.failures >= this.config.threshold) {
          this.transitionToOpen();
        }
        break;
        
      case 'HALF_OPEN':
        this.halfOpenAttempts++;
        if (this.halfOpenAttempts >= this.config.halfOpenRetries) {
          this.transitionToOpen();
        }
        break;
        
      case 'OPEN':
        // Already open, update next retry time
        this.state.nextRetryTime = Date.now() + this.config.resetTimeout;
        break;
    }
  }

  private transitionToOpen(): void {
    this.state.state = 'OPEN';
    this.state.nextRetryTime = Date.now() + this.config.resetTimeout;
    this.halfOpenAttempts = 0;
    
    logger.warn('Circuit breaker opened', {
      failures: this.state.failures,
      nextRetryTime: new Date(this.state.nextRetryTime)
    });
    
    this.emit('open', this.state);
  }

  private transitionToHalfOpen(): void {
    this.state.state = 'HALF_OPEN';
    this.state.successCount = 0;
    this.halfOpenAttempts = 0;
    
    logger.info('Circuit breaker half-open');
    this.emit('halfOpen', this.state);
  }

  private transitionToClosed(): void {
    this.state.state = 'CLOSED';
    this.state.failures = 0;
    this.state.successCount = 0;
    this.halfOpenAttempts = 0;
    
    logger.info('Circuit breaker closed');
    this.emit('closed', this.state);
  }

  reset(): void {
    this.state = {
      state: 'CLOSED',
      failures: 0,
      lastFailureTime: 0,
      nextRetryTime: 0,
      successCount: 0
    };
    this.halfOpenAttempts = 0;
    
    logger.info('Circuit breaker manually reset');
    this.emit('reset', this.state);
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  // 統計情報の取得
  getStats(): {
    state: string;
    totalFailures: number;
    uptime: number;
    availability: number;
  } {
    const now = Date.now();
    const uptime = this.state.state === 'CLOSED' ? 
      (this.state.lastFailureTime > 0 ? now - this.state.lastFailureTime : Infinity) : 0;
    
    const totalRequests = this.state.failures + this.state.successCount;
    const availability = totalRequests > 0 ? 
      (this.state.successCount / totalRequests) * 100 : 100;

    return {
      state: this.state.state,
      totalFailures: this.state.failures,
      uptime,
      availability
    };
  }
}