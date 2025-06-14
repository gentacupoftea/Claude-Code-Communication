"use strict";
/**
 * Stage 2: セカンダリAPI
 * バックアップAPIサービス
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecondaryApiStage = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class SecondaryApiStage {
    name = 'secondary-api';
    priority = 2;
    timeout;
    retryCount = 1;
    client;
    transformResponse;
    constructor(config) {
        this.timeout = config.timeout || 8000; // プライマリより長めのタイムアウト
        this.transformResponse = config.transformResponse;
        this.client = axios_1.default.create({
            baseURL: config.baseUrl,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...(config.apiKey && { 'X-API-Key': config.apiKey }),
                ...config.headers
            }
        });
        this.setupInterceptors();
    }
    setupInterceptors() {
        this.client.interceptors.request.use((config) => {
            config.metadata = { startTime: Date.now() };
            logger_1.logger.debug('Secondary API request', {
                method: config.method,
                url: config.url
            });
            return config;
        }, (error) => {
            logger_1.logger.error('Secondary API request error', error);
            return Promise.reject(error);
        });
        this.client.interceptors.response.use((response) => {
            const duration = Date.now() - response.config.metadata.startTime;
            logger_1.logger.debug('Secondary API response', {
                status: response.status,
                duration
            });
            // レスポンス変換が設定されている場合
            if (this.transformResponse && response.data) {
                try {
                    response.data = this.transformResponse(response.data);
                }
                catch (error) {
                    logger_1.logger.error('Response transformation failed', error);
                }
            }
            return response;
        }, (error) => {
            if (error.config?.metadata) {
                const duration = Date.now() - error.config.metadata.startTime;
                logger_1.logger.error('Secondary API response error', {
                    status: error.response?.status,
                    duration,
                    error: error.message
                });
            }
            return Promise.reject(error);
        });
    }
    async execute(input) {
        const startTime = Date.now();
        try {
            const { endpoint, method = 'GET', data, params } = this.parseInput(input);
            // セカンダリAPIは異なるエンドポイント構造を持つ可能性がある
            const secondaryEndpoint = this.mapToSecondaryEndpoint(endpoint);
            const response = await this.client.request({
                url: secondaryEndpoint,
                method,
                data: this.transformRequestData(data),
                params
            });
            return {
                success: true,
                data: response.data,
                stage: this.name,
                duration: Date.now() - startTime,
                metadata: {
                    source: 'secondary-api',
                    statusCode: response.status,
                    transformed: !!this.transformResponse
                }
            };
        }
        catch (error) {
            const axiosError = error;
            logger_1.logger.error('Secondary API execution failed', {
                message: axiosError.message,
                code: axiosError.code,
                status: axiosError.response?.status
            });
            return {
                success: false,
                error: new Error(`Secondary API failed: ${axiosError.message}`),
                stage: this.name,
                duration: Date.now() - startTime,
                metadata: {
                    source: 'secondary-api',
                    error: axiosError.message
                }
            };
        }
    }
    parseInput(input) {
        if (typeof input === 'string') {
            return { endpoint: input };
        }
        if (typeof input === 'object' && input !== null) {
            return {
                endpoint: input.endpoint || '/',
                method: input.method,
                data: input.data,
                params: input.params
            };
        }
        return { endpoint: '/' };
    }
    mapToSecondaryEndpoint(primaryEndpoint) {
        // エンドポイントマッピングのロジック
        // 例: /users -> /api/v2/accounts
        const endpointMap = {
            '/users': '/api/v2/accounts',
            '/products': '/api/v2/items',
            '/orders': '/api/v2/purchases'
        };
        return endpointMap[primaryEndpoint] || primaryEndpoint;
    }
    transformRequestData(data) {
        if (!data)
            return data;
        // セカンダリAPIの形式に合わせてデータを変換
        // 例: { name: 'John' } -> { userName: 'John' }
        const transformed = { ...data };
        // フィールドマッピング
        const fieldMap = {
            'name': 'userName',
            'email': 'emailAddress',
            'phone': 'phoneNumber'
        };
        for (const [oldField, newField] of Object.entries(fieldMap)) {
            if (oldField in transformed) {
                transformed[newField] = transformed[oldField];
                delete transformed[oldField];
            }
        }
        return transformed;
    }
    async healthCheck() {
        try {
            const response = await this.client.get('/status', {
                timeout: 3000
            });
            return response.status === 200 || response.status === 204;
        }
        catch (error) {
            return false;
        }
    }
}
exports.SecondaryApiStage = SecondaryApiStage;
