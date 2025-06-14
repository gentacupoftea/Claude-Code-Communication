/**
 * フォールバックシステムの設定ファイル
 */
import { FallbackConfig } from '../interfaces/IFallbackService';
export declare const defaultFallbackConfig: FallbackConfig;
export declare const getEnvironmentConfig: () => Partial<FallbackConfig>;
export declare const apiConfigs: {
    primary: {
        baseUrl: string;
        apiKey: string | undefined;
        timeout: number;
        headers: {
            'X-Client-ID': string;
        };
    };
    secondary: {
        baseUrl: string;
        apiKey: string | undefined;
        timeout: number;
        headers: {
            'X-Client-ID': string;
        };
    };
};
export declare const llmConfig: {
    provider: "openai" | "anthropic" | "ollama";
    apiKey: string | undefined;
    model: string | undefined;
    baseURL: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
};
export declare const staticDefaultConfig: {
    defaults: {
        status: string;
        message: string;
        timestamp: null;
        data: {};
        error: null;
    };
    fallbackFile: string | undefined;
    useSmartDefaults: boolean;
};
export declare const createFallbackConfig: () => FallbackConfig;
//# sourceMappingURL=fallback.config.d.ts.map