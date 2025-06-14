/**
 * Stage 5: 静的デフォルト値
 * 最終手段として事前定義された静的データを返す
 */
import { IFallbackStage, FallbackResult } from '../interfaces/IFallbackService';
export interface StaticDefaultConfig {
    defaults: Record<string, any>;
    fallbackFile?: string;
    useSmartDefaults?: boolean;
}
export declare class StaticDefaultStage implements IFallbackStage {
    name: string;
    priority: number;
    timeout: number;
    retryCount: number;
    private config;
    private smartDefaults;
    constructor(config: StaticDefaultConfig);
    private initializeSmartDefaults;
    execute(input: any): Promise<FallbackResult>;
    private loadFromFile;
    private generateDefaultData;
    private generateDefaultForEndpoint;
    private generateDefaultForObject;
    private inferDefaultValue;
    private applySmartDefaults;
    private getEmergencyDefault;
    private generateId;
    private generateUUID;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=StaticDefaultStage.d.ts.map