import { runApiIntegrationTests } from './integration/ApiIntegrationTest';
import { runFallbackSystemTests } from './integration/FallbackSystemTest';
import { runCacheLayerTests } from './integration/CacheLayerTest';
import { runLoadTests } from './load/LoadTest';
import { runErrorHandlingTests } from './integration/ErrorHandlingTest';

/**
 * 統合テストスイート
 * すべてのテストを統合実行し、包括的なレポートを生成
 */
export class IntegrationTestSuite {
  private suiteStartTime: number = 0;

  /**
   * すべての統合テストを実行
   */
  async runAllTests(): Promise<ComprehensiveTestReport> {
    console.log('🚀 統合テストスイート開始');
    console.log('=====================================');
    this.suiteStartTime = Date.now();

    const testResults: TestSuiteResults = {
      apiIntegration: null,
      fallbackSystem: null,
      cacheLayer: null,
      loadTest: null,
      errorHandling: null
    };

    const errors: string[] = [];

    try {
      // 1. APIアダプター統合テスト
      console.log('\n📡 1/5: APIアダプター統合テスト');
      console.log('-------------------------------------');
      try {
        testResults.apiIntegration = await runApiIntegrationTests();
        this.logTestResult('APIアダプター統合', testResults.apiIntegration);
      } catch (error) {
        errors.push(`APIアダプター統合テスト: ${error}`);
        console.error('❌ APIアダプター統合テストでエラー:', error);
      }

      // 2. フォールバックシステムテスト
      console.log('\n🔄 2/5: フォールバックシステムテスト');
      console.log('-------------------------------------');
      try {
        testResults.fallbackSystem = await runFallbackSystemTests();
        this.logTestResult('フォールバックシステム', testResults.fallbackSystem);
      } catch (error) {
        errors.push(`フォールバックシステムテスト: ${error}`);
        console.error('❌ フォールバックシステムテストでエラー:', error);
      }

      // 3. キャッシュ層テスト
      console.log('\n💾 3/5: キャッシュ層動作検証テスト');
      console.log('-------------------------------------');
      try {
        testResults.cacheLayer = await runCacheLayerTests();
        this.logTestResult('キャッシュ層', testResults.cacheLayer);
      } catch (error) {
        errors.push(`キャッシュ層テスト: ${error}`);
        console.error('❌ キャッシュ層テストでエラー:', error);
      }

      // 4. 負荷テスト
      console.log('\n⚡ 4/5: 負荷テスト');
      console.log('-------------------------------------');
      try {
        testResults.loadTest = await runLoadTests();
        this.logLoadTestResult(testResults.loadTest);
      } catch (error) {
        errors.push(`負荷テスト: ${error}`);
        console.error('❌ 負荷テストでエラー:', error);
      }

      // 5. エラー処理テスト
      console.log('\n🚨 5/5: エラー処理検証テスト');
      console.log('-------------------------------------');
      try {
        testResults.errorHandling = await runErrorHandlingTests();
        this.logTestResult('エラー処理', testResults.errorHandling);
      } catch (error) {
        errors.push(`エラー処理テスト: ${error}`);
        console.error('❌ エラー処理テストでエラー:', error);
      }

      // 包括的レポートを生成
      const report = this.generateComprehensiveReport(testResults, errors);
      
      // レポートをファイルに保存
      await this.saveReport(report);
      
      // コンソールに最終サマリーを表示
      this.displayFinalSummary(report);

      return report;

    } catch (error) {
      console.error('統合テストスイート実行中に致命的エラー:', error);
      throw error;
    }
  }

  /**
   * 個別テスト結果をログ出力
   */
  private logTestResult(testName: string, result: any): void {
    if (result) {
      const successRate = result.successRate || 0;
      const icon = successRate >= 95 ? '🟢' : successRate >= 80 ? '🟡' : '🔴';
      console.log(`${icon} ${testName}: ${result.passCount}/${result.totalTests} (${successRate.toFixed(1)}%) - ${result.totalDuration}ms`);
    } else {
      console.log(`❌ ${testName}: テスト実行に失敗`);
    }
  }

  /**
   * 負荷テスト結果をログ出力
   */
  private logLoadTestResult(result: any): void {
    if (result) {
      const successRate = result.successRate || 0;
      const icon = successRate >= 95 ? '🟢' : successRate >= 80 ? '🟡' : '🔴';
      console.log(`${icon} 負荷テスト: ${result.passCount}/${result.totalTests} (${successRate.toFixed(1)}%)`);
      if (result.performanceMetrics) {
        console.log(`  📊 最大スループット: ${result.performanceMetrics.maxThroughput.toFixed(2)} req/s`);
        console.log(`  📊 平均レスポンス時間: ${result.performanceMetrics.avgResponseTime.toFixed(2)}ms`);
      }
    } else {
      console.log(`❌ 負荷テスト: テスト実行に失敗`);
    }
  }

  /**
   * 包括的テストレポートを生成
   */
  private generateComprehensiveReport(
    results: TestSuiteResults, 
    errors: string[]
  ): ComprehensiveTestReport {
    const totalDuration = Date.now() - this.suiteStartTime;
    
    // 全体統計を計算
    const overallStats = this.calculateOverallStats(results);
    
    // パフォーマンス指標を集計
    const performanceMetrics = this.aggregatePerformanceMetrics(results);
    
    // 品質指標を計算
    const qualityMetrics = this.calculateQualityMetrics(results);

    return {
      timestamp: new Date().toISOString(),
      totalDuration,
      overallStats,
      performanceMetrics,
      qualityMetrics,
      testResults: results,
      errors,
      recommendations: this.generateRecommendations(results),
      systemHealth: this.assessSystemHealth(results),
      summary: this.generateExecutiveSummary(overallStats, performanceMetrics, qualityMetrics)
    };
  }

  /**
   * 全体統計を計算
   */
  private calculateOverallStats(results: TestSuiteResults): OverallStats {
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;

    Object.values(results).forEach(result => {
      if (result) {
        totalTests += result.totalTests || 0;
        totalPassed += result.passCount || 0;
        totalFailed += result.failCount || 0;
        totalDuration += result.totalDuration || 0;
      }
    });

    return {
      totalTests,
      totalPassed,
      totalFailed,
      overallSuccessRate: totalTests > 0 ? (totalPassed / totalTests) * 100 : 0,
      totalDuration,
      testSuites: Object.keys(results).length,
      completedSuites: Object.values(results).filter(r => r !== null).length
    };
  }

  /**
   * パフォーマンス指標を集計
   */
  private aggregatePerformanceMetrics(results: TestSuiteResults): PerformanceMetrics {
    const loadTestResult = results.loadTest;
    
    return {
      maxThroughput: loadTestResult?.performanceMetrics?.maxThroughput || 0,
      avgThroughput: loadTestResult?.performanceMetrics?.avgThroughput || 0,
      minResponseTime: loadTestResult?.performanceMetrics?.minResponseTime || 0,
      maxResponseTime: loadTestResult?.performanceMetrics?.maxResponseTime || 0,
      avgResponseTime: loadTestResult?.performanceMetrics?.avgResponseTime || 0,
      cacheHitRate: this.extractCacheHitRate(results),
      errorRate: this.calculateErrorRate(results)
    };
  }

  /**
   * 品質指標を計算
   */
  private calculateQualityMetrics(results: TestSuiteResults): QualityMetrics {
    return {
      reliability: this.calculateReliability(results),
      availability: this.calculateAvailability(results),
      performance: this.calculatePerformanceScore(results),
      errorHandling: this.calculateErrorHandlingScore(results),
      cacheEfficiency: this.calculateCacheEfficiency(results),
      overallQuality: 0 // 後で計算
    };
  }

  /**
   * キャッシュヒット率を抽出
   */
  private extractCacheHitRate(results: TestSuiteResults): number {
    // APIテスト結果から抽出
    const apiResult = results.apiIntegration;
    if (apiResult?.summary?.cacheStats) {
      return apiResult.summary.cacheStats.hitRate || 0;
    }
    return 0;
  }

  /**
   * エラー率を計算
   */
  private calculateErrorRate(results: TestSuiteResults): number {
    const overallStats = this.calculateOverallStats(results);
    return overallStats.totalTests > 0 ? 
      (overallStats.totalFailed / overallStats.totalTests) * 100 : 0;
  }

  /**
   * 信頼性スコアを計算
   */
  private calculateReliability(results: TestSuiteResults): number {
    const fallbackResult = results.fallbackSystem;
    if (!fallbackResult) return 0;
    
    return fallbackResult.successRate || 0;
  }

  /**
   * 可用性スコアを計算
   */
  private calculateAvailability(results: TestSuiteResults): number {
    const errorResult = results.errorHandling;
    if (!errorResult) return 0;
    
    return errorResult.successRate || 0;
  }

  /**
   * パフォーマンススコアを計算
   */
  private calculatePerformanceScore(results: TestSuiteResults): number {
    const loadResult = results.loadTest;
    if (!loadResult) return 0;
    
    return loadResult.successRate || 0;
  }

  /**
   * エラー処理スコアを計算
   */
  private calculateErrorHandlingScore(results: TestSuiteResults): number {
    const errorResult = results.errorHandling;
    if (!errorResult) return 0;
    
    return errorResult.successRate || 0;
  }

  /**
   * キャッシュ効率スコアを計算
   */
  private calculateCacheEfficiency(results: TestSuiteResults): number {
    const cacheResult = results.cacheLayer;
    if (!cacheResult) return 0;
    
    return cacheResult.successRate || 0;
  }

  /**
   * 推奨事項を生成
   */
  private generateRecommendations(results: TestSuiteResults): string[] {
    const recommendations: string[] = [];
    
    // パフォーマンス推奨事項
    const loadResult = results.loadTest;
    if (loadResult && loadResult.performanceMetrics) {
      if (loadResult.performanceMetrics.avgResponseTime > 1000) {
        recommendations.push('平均レスポンス時間が1秒を超えています。キャッシュ戦略の見直しを推奨します。');
      }
      if (loadResult.performanceMetrics.maxThroughput < 100) {
        recommendations.push('スループットが低いです。並行処理の最適化を検討してください。');
      }
    }

    // キャッシュ推奨事項
    const cacheHitRate = this.extractCacheHitRate(results);
    if (cacheHitRate < 80) {
      recommendations.push('キャッシュヒット率が80%未満です。キャッシュキー戦略の見直しを推奨します。');
    }

    // エラー処理推奨事項
    const errorResult = results.errorHandling;
    if (errorResult && errorResult.successRate < 95) {
      recommendations.push('エラー処理テストの成功率が95%未満です。エラーハンドリングの強化を推奨します。');
    }

    // フォールバック推奨事項
    const fallbackResult = results.fallbackSystem;
    if (fallbackResult && fallbackResult.successRate < 90) {
      recommendations.push('フォールバックシステムの成功率が90%未満です。冗長性の向上を検討してください。');
    }

    if (recommendations.length === 0) {
      recommendations.push('すべてのテストが良好な結果を示しています。現在の実装を維持してください。');
    }

    return recommendations;
  }

  /**
   * システムヘルス評価
   */
  private assessSystemHealth(results: TestSuiteResults): SystemHealth {
    const overallStats = this.calculateOverallStats(results);
    const performanceMetrics = this.aggregatePerformanceMetrics(results);
    
    let status: 'healthy' | 'warning' | 'critical';
    
    if (overallStats.overallSuccessRate >= 95 && performanceMetrics.errorRate < 5) {
      status = 'healthy';
    } else if (overallStats.overallSuccessRate >= 80 && performanceMetrics.errorRate < 20) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    return {
      status,
      successRate: overallStats.overallSuccessRate,
      errorRate: performanceMetrics.errorRate,
      cacheHitRate: performanceMetrics.cacheHitRate,
      avgResponseTime: performanceMetrics.avgResponseTime,
      issues: this.identifyIssues(results)
    };
  }

  /**
   * 問題点を特定
   */
  private identifyIssues(results: TestSuiteResults): string[] {
    const issues: string[] = [];
    
    Object.entries(results).forEach(([suiteName, result]) => {
      if (result && result.successRate < 90) {
        issues.push(`${suiteName}: 成功率 ${result.successRate.toFixed(1)}%`);
      }
    });

    return issues;
  }

  /**
   * エグゼクティブサマリーを生成
   */
  private generateExecutiveSummary(
    overallStats: OverallStats,
    performanceMetrics: PerformanceMetrics,
    qualityMetrics: QualityMetrics
  ): string {
    const successRate = overallStats.overallSuccessRate;
    
    if (successRate >= 95) {
      return `システムは非常に安定しており、すべての統合テストで優秀な結果を示しています。成功率${successRate.toFixed(1)}%、平均レスポンス時間${performanceMetrics.avgResponseTime.toFixed(1)}msで、本番環境へのデプロイ準備が整っています。`;
    } else if (successRate >= 80) {
      return `システムは概ね安定していますが、いくつかの改善点があります。成功率${successRate.toFixed(1)}%で、特定の機能について追加の最適化が推奨されます。`;
    } else {
      return `システムには重要な問題があります。成功率${successRate.toFixed(1)}%で、本番環境デプロイ前に重要な修正が必要です。`;
    }
  }

  /**
   * レポートをファイルに保存
   */
  private async saveReport(report: ComprehensiveTestReport): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `integration-test-report-${timestamp}.json`;
    const filepath = `/Users/mourigenta/projects/conea-integration/Claude-Code-Communication/instructions/cerberus_worker_env/tests/reports/${filename}`;
    
    // レポートディレクトリを作成
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      console.log(`\n📄 テストレポートを保存: ${filename}`);
    } catch (error) {
      console.error('レポート保存エラー:', error);
    }
  }

  /**
   * 最終サマリーを表示
   */
  private displayFinalSummary(report: ComprehensiveTestReport): void {
    console.log('\n');
    console.log('🏆 統合テストスイート完了');
    console.log('=====================================');
    console.log(`⏱️  総実行時間: ${(report.totalDuration / 1000).toFixed(1)}秒`);
    console.log(`📊 総テスト数: ${report.overallStats.totalTests}`);
    console.log(`✅ 成功: ${report.overallStats.totalPassed}`);
    console.log(`❌ 失敗: ${report.overallStats.totalFailed}`);
    console.log(`📈 成功率: ${report.overallStats.overallSuccessRate.toFixed(1)}%`);
    
    const healthIcon = report.systemHealth.status === 'healthy' ? '🟢' : 
                      report.systemHealth.status === 'warning' ? '🟡' : '🔴';
    console.log(`${healthIcon} システムヘルス: ${report.systemHealth.status.toUpperCase()}`);
    
    if (report.performanceMetrics.maxThroughput > 0) {
      console.log(`⚡ 最大スループット: ${report.performanceMetrics.maxThroughput.toFixed(2)} req/s`);
    }
    
    if (report.performanceMetrics.cacheHitRate > 0) {
      console.log(`💾 キャッシュヒット率: ${report.performanceMetrics.cacheHitRate.toFixed(1)}%`);
    }
    
    console.log('\n📋 エグゼクティブサマリー:');
    console.log(report.summary);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 推奨事項:');
      report.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }
    
    console.log('\n=====================================');
  }
}

/**
 * 型定義
 */
interface TestSuiteResults {
  apiIntegration: any;
  fallbackSystem: any;
  cacheLayer: any;
  loadTest: any;
  errorHandling: any;
}

interface OverallStats {
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  overallSuccessRate: number;
  totalDuration: number;
  testSuites: number;
  completedSuites: number;
}

interface PerformanceMetrics {
  maxThroughput: number;
  avgThroughput: number;
  minResponseTime: number;
  maxResponseTime: number;
  avgResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
}

interface QualityMetrics {
  reliability: number;
  availability: number;
  performance: number;
  errorHandling: number;
  cacheEfficiency: number;
  overallQuality: number;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  successRate: number;
  errorRate: number;
  cacheHitRate: number;
  avgResponseTime: number;
  issues: string[];
}

interface ComprehensiveTestReport {
  timestamp: string;
  totalDuration: number;
  overallStats: OverallStats;
  performanceMetrics: PerformanceMetrics;
  qualityMetrics: QualityMetrics;
  testResults: TestSuiteResults;
  errors: string[];
  recommendations: string[];
  systemHealth: SystemHealth;
  summary: string;
}

// メイン実行関数のエクスポート
export async function runIntegrationTestSuite(): Promise<ComprehensiveTestReport> {
  const suite = new IntegrationTestSuite();
  return await suite.runAllTests();
}

// 直接実行用
if (require.main === module) {
  runIntegrationTestSuite().catch(console.error);
}