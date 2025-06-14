/**
 * サーキットブレーカーの実装
 * 障害を検知して自動的にサービスを遮断し、復旧を試みる
 */
import { EventEmitter } from 'events';
import { CircuitBreakerState } from '../interfaces/IFallbackService';
export interface CircuitBreakerConfig {
    threshold: number;
    timeout: number;
    resetTimeout: number;
    halfOpenRetries: number;
}
export declare class CircuitBreaker extends EventEmitter {
    private state;
    private config;
    private halfOpenAttempts;
    constructor(config: CircuitBreakerConfig);
    canExecute(): boolean;
    recordSuccess(): void;
    recordFailure(): void;
    private transitionToOpen;
    private transitionToHalfOpen;
    private transitionToClosed;
    reset(): void;
    getState(): CircuitBreakerState;
    getStats(): {
        state: string;
        totalFailures: number;
        uptime: number;
        availability: number;
    };
}
//# sourceMappingURL=CircuitBreaker.d.ts.map