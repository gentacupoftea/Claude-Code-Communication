/**
 * ロガーユーティリティ
 * Winston を使用した構造化ログ
 */
export declare const logger: any;
export declare const logPerformance: (operation: string, duration: number, metadata?: any) => void;
export declare const logError: (error: Error, context?: any) => void;
export declare const requestLogger: (req: any, res: any, duration: number) => void;
//# sourceMappingURL=logger.d.ts.map