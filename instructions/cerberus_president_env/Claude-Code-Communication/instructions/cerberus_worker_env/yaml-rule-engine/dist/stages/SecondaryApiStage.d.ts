/**
 * Stage 2: セカンダリAPI
 * バックアップAPIサービス
 */
import { IFallbackStage, FallbackResult } from '../interfaces/IFallbackService';
export interface SecondaryApiConfig {
    baseUrl: string;
    apiKey?: string;
    headers?: Record<string, string>;
    timeout?: number;
    transformResponse?: (data: any) => any;
}
export declare class SecondaryApiStage implements IFallbackStage {
    name: string;
    priority: number;
    timeout: number;
    retryCount: number;
    private client;
    private transformResponse?;
    constructor(config: SecondaryApiConfig);
    private setupInterceptors;
    execute(input: any): Promise<FallbackResult>;
    private parseInput;
    private mapToSecondaryEndpoint;
    private transformRequestData;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=SecondaryApiStage.d.ts.map