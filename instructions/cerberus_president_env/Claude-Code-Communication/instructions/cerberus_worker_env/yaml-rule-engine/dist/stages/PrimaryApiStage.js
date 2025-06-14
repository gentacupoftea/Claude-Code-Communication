"use strict";
/**
 * Stage 1: プライマリAPI
 * 最も信頼性が高く、最新のデータを提供
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimaryApiStage = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class PrimaryApiStage {
    name = 'primary-api';
    priority = 1;
    timeout;
    retryCount = 2;
    client;
    constructor(config) {
        this.timeout = config.timeout || 5000;
        this.client = axios_1.default.create({
            baseURL: config.baseUrl,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
                ...config.headers
            }
        });
        // インターセプターの設定
        this.setupInterceptors();
    }
    setupInterceptors() {
        // リクエストインターセプター
        this.client.interceptors.request.use((config) => {
            config.metadata = { startTime: Date.now() };
            logger_1.logger.debug('Primary API request', {
                method: config.method,
                url: config.url,
                params: config.params
            });
            return config;
        }, (error) => {
            logger_1.logger.error('Primary API request error', error);
            return Promise.reject(error);
        });
        // レスポンスインターセプター
        this.client.interceptors.response.use((response) => {
            const duration = Date.now() - response.config.metadata.startTime;
            logger_1.logger.debug('Primary API response', {
                status: response.status,
                duration,
                url: response.config.url
            });
            return response;
        }, (error) => {
            if (error.config?.metadata) {
                const duration = Date.now() - error.config.metadata.startTime;
                logger_1.logger.error('Primary API response error', {
                    status: error.response?.status,
                    duration,
                    url: error.config.url,
                    error: error.message
                });
            }
            return Promise.reject(error);
        });
    }
    async execute(input) {
        const startTime = Date.now();
        try {
            // inputに基づいてAPIエンドポイントとパラメータを決定
            const { endpoint, method = 'GET', data, params } = this.parseInput(input);
            const response = await this.client.request({
                url: endpoint,
                method,
                data,
                params
            });
            return {
                success: true,
                data: response.data,
                stage: this.name,
                duration: Date.now() - startTime,
                metadata: {
                    source: 'primary-api',
                    statusCode: response.status,
                    headers: response.headers
                }
            };
        }
        catch (error) {
            const axiosError = error;
            // エラーレスポンスの詳細を記録
            const errorDetails = {
                message: axiosError.message,
                code: axiosError.code,
                status: axiosError.response?.status,
                data: axiosError.response?.data
            };
            logger_1.logger.error('Primary API execution failed', errorDetails);
            return {
                success: false,
                error: new Error(`Primary API failed: ${axiosError.message}`),
                stage: this.name,
                duration: Date.now() - startTime,
                metadata: {
                    source: 'primary-api',
                    errorDetails
                }
            };
        }
    }
    parseInput(input) {
        // inputが文字列の場合はエンドポイントとして扱う
        if (typeof input === 'string') {
            return { endpoint: input };
        }
        // オブジェクトの場合は構造化されたリクエストとして扱う
        if (typeof input === 'object' && input !== null) {
            return {
                endpoint: input.endpoint || '/',
                method: input.method,
                data: input.data,
                params: input.params
            };
        }
        // デフォルト
        return { endpoint: '/' };
    }
    // ヘルスチェック用メソッド
    async healthCheck() {
        try {
            const response = await this.client.get('/health', {
                timeout: 2000
            });
            return response.status === 200;
        }
        catch (error) {
            return false;
        }
    }
}
exports.PrimaryApiStage = PrimaryApiStage;
