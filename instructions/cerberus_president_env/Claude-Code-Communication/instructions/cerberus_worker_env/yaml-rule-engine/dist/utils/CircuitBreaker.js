"use strict";
/**
 * サーキットブレーカーの実装
 * 障害を検知して自動的にサービスを遮断し、復旧を試みる
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = void 0;
const events_1 = require("events");
const logger_1 = require("./logger");
class CircuitBreaker extends events_1.EventEmitter {
    state;
    config;
    halfOpenAttempts = 0;
    constructor(config) {
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
    canExecute() {
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
    recordSuccess() {
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
                logger_1.logger.warn('Success recorded in OPEN state');
                break;
        }
    }
    recordFailure() {
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
    transitionToOpen() {
        this.state.state = 'OPEN';
        this.state.nextRetryTime = Date.now() + this.config.resetTimeout;
        this.halfOpenAttempts = 0;
        logger_1.logger.warn('Circuit breaker opened', {
            failures: this.state.failures,
            nextRetryTime: new Date(this.state.nextRetryTime)
        });
        this.emit('open', this.state);
    }
    transitionToHalfOpen() {
        this.state.state = 'HALF_OPEN';
        this.state.successCount = 0;
        this.halfOpenAttempts = 0;
        logger_1.logger.info('Circuit breaker half-open');
        this.emit('halfOpen', this.state);
    }
    transitionToClosed() {
        this.state.state = 'CLOSED';
        this.state.failures = 0;
        this.state.successCount = 0;
        this.halfOpenAttempts = 0;
        logger_1.logger.info('Circuit breaker closed');
        this.emit('closed', this.state);
    }
    reset() {
        this.state = {
            state: 'CLOSED',
            failures: 0,
            lastFailureTime: 0,
            nextRetryTime: 0,
            successCount: 0
        };
        this.halfOpenAttempts = 0;
        logger_1.logger.info('Circuit breaker manually reset');
        this.emit('reset', this.state);
    }
    getState() {
        return { ...this.state };
    }
    // 統計情報の取得
    getStats() {
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
exports.CircuitBreaker = CircuitBreaker;
