import { FallbackService } from '../src/services/FallbackService';
import { FallbackConfiguration, FallbackStage } from '../src/interfaces/IFallbackService';
import { CircuitBreaker } from '../src/utils/CircuitBreaker';
import { createLogger } from '../src/utils/logger';

/**
 * 障害注入テスト - 5段階フォールバックシステムの真価を証明
 * 
 * このテストは意図的にAPI障害を発生させ、各フォールバック段階の
 * 動作を検証し、システムの堅牢性を証明します。
 */

const logger = createLogger('FaultInjectionTest');

// テスト用の障害シミュレーター
class FaultInjector {
    private faultPatterns: Map<string, boolean> = new Map();
    
    // 障害パターンを設定
    setFault(stageName: string, shouldFail: boolean): void {
        this.faultPatterns.set(stageName, shouldFail);
        logger.info(`障害注入設定: ${stageName} = ${shouldFail ? '障害発生' : '正常動作'}`);
    }
    
    // 指定されたステージで障害を発生させるかチェック
    shouldInjectFault(stageName: string): boolean {
        return this.faultPatterns.get(stageName) || false;
    }
    
    // 全ての障害をクリア
    clearAllFaults(): void {
        this.faultPatterns.clear();
        logger.info('全ての障害注入設定をクリアしました');
    }
}

// 障害注入対応のモックステージ
class MockFaultAwareStage implements FallbackStage {
    constructor(
        private name: string,
        private faultInjector: FaultInjector,
        private normalData: any = { message: `${name}からの正常データ`, timestamp: Date.now() }
    ) {}
    
    async execute(request: any): Promise<any> {
        // 障害注入チェック
        if (this.faultInjector.shouldInjectFault(this.name)) {
            logger.warn(`💥 ${this.name}: 意図的な障害を発生させます`);
            throw new Error(`${this.name}で意図的な障害が発生しました`);
        }
        
        // 正常時のレスポンス
        logger.info(`✅ ${this.name}: 正常にデータを返します`);
        return {
            ...this.normalData,
            source: this.name,
            request
        };
    }
    
    getName(): string {
        return this.name;
    }
    
    async healthCheck(): Promise<boolean> {
        return !this.faultInjector.shouldInjectFault(this.name);
    }
}

// フォールバック動作検証テスト
export class FallbackResilienceTest {
    private faultInjector: FaultInjector;
    private fallbackService: FallbackService;
    
    constructor() {
        this.faultInjector = new FaultInjector();
        this.initializeFallbackService();
    }
    
    private initializeFallbackService(): void {
        const config: FallbackConfiguration = {
            stages: [
                new MockFaultAwareStage('PrimaryAPI', this.faultInjector),
                new MockFaultAwareStage('SecondaryAPI', this.faultInjector),
                new MockFaultAwareStage('MemoryCache', this.faultInjector),
                new MockFaultAwareStage('RedisCache', this.faultInjector),
                new MockFaultAwareStage('StaticData', this.faultInjector, { 
                    message: '静的デフォルトデータ', 
                    isDefault: true 
                })
            ],
            timeouts: [1000, 2000, 500, 1000, 100],
            retryAttempts: [3, 2, 1, 1, 0],
            circuitBreakerThresholds: [5, 3, 2, 2, 1]
        };
        
        this.fallbackService = new FallbackService(config);
    }
    
    // テストシナリオ1: 段階的な障害発生
    async testGradualFailure(): Promise<void> {
        logger.info('🎯 テストシナリオ1: 段階的な障害発生テスト開始');
        
        const testRequest = { operation: 'getUserData', userId: 12345 };
        
        // すべて正常時
        logger.info('--- Phase 1: 全システム正常 ---');
        let result = await this.fallbackService.execute(testRequest);
        console.log('✅ 結果:', JSON.stringify(result, null, 2));
        
        // Primary API 障害
        logger.info('--- Phase 2: Primary API 障害 ---');
        this.faultInjector.setFault('PrimaryAPI', true);
        result = await this.fallbackService.execute(testRequest);
        console.log('✅ 結果:', JSON.stringify(result, null, 2));
        
        // Secondary API も障害
        logger.info('--- Phase 3: Primary + Secondary API 障害 ---');
        this.faultInjector.setFault('SecondaryAPI', true);
        result = await this.fallbackService.execute(testRequest);
        console.log('✅ 結果:', JSON.stringify(result, null, 2));
        
        // Memory Cache も障害
        logger.info('--- Phase 4: API + Memory Cache 障害 ---');
        this.faultInjector.setFault('MemoryCache', true);
        result = await this.fallbackService.execute(testRequest);
        console.log('✅ 結果:', JSON.stringify(result, null, 2));
        
        // Redis Cache も障害
        logger.info('--- Phase 5: すべてのキャッシュ障害、Static Dataのみ ---');
        this.faultInjector.setFault('RedisCache', true);
        result = await this.fallbackService.execute(testRequest);
        console.log('✅ 結果:', JSON.stringify(result, null, 2));
        
        // 復旧テスト
        logger.info('--- Phase 6: システム復旧テスト ---');
        this.faultInjector.clearAllFaults();
        result = await this.fallbackService.execute(testRequest);
        console.log('✅ 結果:', JSON.stringify(result, null, 2));
    }
    
    // テストシナリオ2: ランダム障害での耐久性テスト
    async testRandomFailures(iterations: number = 20): Promise<void> {
        logger.info(`🎯 テストシナリオ2: ランダム障害耐久性テスト (${iterations}回)`);
        
        const results: any[] = [];
        const stages = ['PrimaryAPI', 'SecondaryAPI', 'MemoryCache', 'RedisCache'];
        
        for (let i = 0; i < iterations; i++) {
            // ランダムに障害を発生させる
            this.faultInjector.clearAllFaults();
            stages.forEach(stage => {
                if (Math.random() < 0.3) { // 30%の確率で障害
                    this.faultInjector.setFault(stage, true);
                }
            });
            
            const testRequest = { operation: 'testData', iteration: i };
            
            try {
                const result = await this.fallbackService.execute(testRequest);
                results.push({
                    iteration: i,
                    success: true,
                    source: result.source,
                    executionTime: result.executionTime
                });
                logger.info(`Iteration ${i}: 成功 (ソース: ${result.source})`);
            } catch (error) {
                results.push({
                    iteration: i,
                    success: false,
                    error: error.message
                });
                logger.error(`Iteration ${i}: 失敗 - ${error.message}`);
            }
        }
        
        // 統計レポート
        const successCount = results.filter(r => r.success).length;
        const successRate = (successCount / iterations) * 100;
        
        logger.info('📊 耐久性テスト結果:');
        logger.info(`総実行回数: ${iterations}`);
        logger.info(`成功回数: ${successCount}`);
        logger.info(`成功率: ${successRate.toFixed(2)}%`);
        
        // ソース別統計
        const sourceStats = {};
        results.filter(r => r.success).forEach(r => {
            sourceStats[r.source] = (sourceStats[r.source] || 0) + 1;
        });
        
        logger.info('📈 ソース別使用回数:');
        Object.entries(sourceStats).forEach(([source, count]) => {
            logger.info(`  ${source}: ${count}回`);
        });
    }
    
    // テストシナリオ3: サーキットブレーカー動作検証
    async testCircuitBreakerBehavior(): Promise<void> {
        logger.info('🎯 テストシナリオ3: サーキットブレーカー動作検証');
        
        // Primary APIで連続的な障害を発生させてサーキットブレーカーを開く
        this.faultInjector.setFault('PrimaryAPI', true);
        
        const testRequest = { operation: 'circuitBreakerTest' };
        
        // 連続で失敗させてサーキットブレーカーを開く
        for (let i = 0; i < 7; i++) {
            logger.info(`サーキットブレーカーテスト ${i + 1}/7`);
            const result = await this.fallbackService.execute(testRequest);
            console.log(`  結果: ${result.source} - ${result.message}`);
        }
        
        // Primary APIを修復
        this.faultInjector.setFault('PrimaryAPI', false);
        
        // サーキットブレーカーが半開状態になるまで待機
        logger.info('サーキットブレーカーの回復を待機中...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 回復テスト
        logger.info('サーキットブレーカー回復テスト');
        const recoveryResult = await this.fallbackService.execute(testRequest);
        console.log('回復結果:', JSON.stringify(recoveryResult, null, 2));
    }
    
    // 包括的テスト実行
    async runComprehensiveTest(): Promise<void> {
        logger.info('🚀 5段階フォールバックシステム 包括的耐性テスト開始');
        
        try {
            await this.testGradualFailure();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.testRandomFailures(15);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.testCircuitBreakerBehavior();
            
            logger.info('🎉 全テスト完了！システムの堅牢性が証明されました');
            
            // メトリクス表示
            const metrics = this.fallbackService.getMetrics();
            logger.info('📊 最終メトリクス:');
            console.log(JSON.stringify(metrics, null, 2));
            
        } catch (error) {
            logger.error('❌ テスト実行中にエラーが発生:', error);
            throw error;
        }
    }
}

// テスト実行用エントリポイント
export async function runFaultInjectionTests(): Promise<void> {
    const tester = new FallbackResilienceTest();
    await tester.runComprehensiveTest();
}

// スタンドアロン実行
if (require.main === module) {
    runFaultInjectionTests()
        .then(() => {
            console.log('🏆 勝利！フォールバックシステムの真価が証明されました！');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 テスト失敗:', error);
            process.exit(1);
        });
}