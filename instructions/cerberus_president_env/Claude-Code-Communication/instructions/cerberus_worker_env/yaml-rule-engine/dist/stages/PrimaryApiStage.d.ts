/**
 * Stage 1: プライマリAPI
 * 最も信頼性が高く、最新のデータを提供
 */
import { IFallbackStage, FallbackResult } from '../interfaces/IFallbackService';
export interface PrimaryApiConfig {
    baseUrl: string;
    apiKey?: string;
    headers?: Record<string, string>;
    timeout?: number;
}
export declare class PrimaryApiStage implements IFallbackStage {
    name: string;
    priority: number;
    timeout: number;
    retryCount: number;
    private client;
    constructor(config: PrimaryApiConfig);
    private setupInterceptors;
    execute(input: any): Promise<FallbackResult>;
    private parseInput;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=PrimaryApiStage.d.ts.map