/**
 * リソース監視ユーティリティ
 * 
 * アプリケーションのメモリ使用量とパフォーマンスを監視し、
 * メモリリークやパフォーマンスのボトルネックを検出します。
 */

import { EventEmitter } from 'events';
import { logger } from './logger';

// Global型の拡張
declare global {
  var gc: (() => void) | undefined;
}

/**
 * メモリ使用量レポートインターフェース
 */
export interface MemoryUsageReport {
  timestamp: number;
  rss: number;        // 常駐セットサイズ（プロセス全体のメモリ使用量）
  heapTotal: number;  // V8エンジンに割り当てられた合計ヒープサイズ
  heapUsed: number;   // V8エンジンが実際に使用しているヒープメモリ
  external: number;   // V8が管理する外部メモリ（例：バッファ）
  arrayBuffers?: number; // ArrayBufferとSharedArrayBufferに割り当てられたメモリ
}

/**
 * パフォーマンスメトリクスインターフェース
 */
export interface PerformanceMetrics {
  timestamp: number;
  cpuUsage?: {
    user: number;
    system: number;
  };
  activeHandles?: number;
  activeRequests?: number;
  eventLoopLag?: number;
}

/**
 * メモリ異常の種類
 */
export enum MemoryAnomalyType {
  LEAK = 'memory-leak',
  SPIKE = 'memory-spike',
  HIGH_USAGE = 'high-memory-usage'
}

/**
 * 閾値設定
 */
export interface MonitoringThresholds {
  heapUsedPercentage: number;    // ヒープ使用率の警告閾値（%）
  heapGrowthRate: number;        // ヒープ増加率の警告閾値（%）
  eventLoopLagMs: number;        // イベントループラグの警告閾値（ms）
  consistentGrowthSamples: number; // メモリリーク検出のためのサンプル数
}

/**
 * デフォルトの閾値設定
 */
const DEFAULT_THRESHOLDS: MonitoringThresholds = {
  heapUsedPercentage: 85,
  heapGrowthRate: 10,
  eventLoopLagMs: 100,
  consistentGrowthSamples: 5
};

/**
 * リソースモニター
 */
export class ResourceMonitor extends EventEmitter {
  private static instance: ResourceMonitor;
  private memorySnapshots: MemoryUsageReport[] = [];
  private performanceMetrics: PerformanceMetrics[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private eventLoopMonitorInterval: NodeJS.Timeout | null = null;
  private snapshotRetention: number = 100;  // 保持するスナップショット数
  private thresholds: MonitoringThresholds;
  private gcEnabled: boolean = false;
  
  private constructor(thresholds?: Partial<MonitoringThresholds>) {
    super();
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    
    // グローバルGC関数の存在確認（--expose-gc フラグが必要）
    this.gcEnabled = typeof global.gc === 'function';
    if (!this.gcEnabled) {
      logger.warn('GC未有効化: メモリ最適化にはNode.jsを --expose-gc オプションで実行してください');
    }
  }
  
  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(thresholds?: Partial<MonitoringThresholds>): ResourceMonitor {
    if (!ResourceMonitor.instance) {
      ResourceMonitor.instance = new ResourceMonitor(thresholds);
    }
    return ResourceMonitor.instance;
  }
  
  /**
   * 監視の開始
   * @param intervalMs 監視間隔（ミリ秒）
   */
  public startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }
    
    logger.info(`リソース監視を開始しました (間隔: ${intervalMs}ms)`);
    
    // メモリ使用量の定期的なスナップショット
    this.monitoringInterval = setInterval(() => {
      this.captureMemorySnapshot();
      this.capturePerformanceMetrics();
      this.detectAnomalies();
    }, intervalMs);
    
    // イベントループラグの監視（より頻繁に）
    this.eventLoopMonitorInterval = setInterval(() => {
      this.measureEventLoopLag();
    }, Math.min(intervalMs / 4, 5000));  // 5秒または間隔の1/4のいずれか短い方
    
    // 初期スナップショットの即時取得
    this.captureMemorySnapshot();
    this.capturePerformanceMetrics();
  }
  
  /**
   * 監視の停止
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.eventLoopMonitorInterval) {
      clearInterval(this.eventLoopMonitorInterval);
      this.eventLoopMonitorInterval = null;
    }
    
    logger.info('リソース監視を停止しました');
  }
  
  /**
   * 現在のメモリスナップショットを取得
   */
  public captureMemorySnapshot(): MemoryUsageReport {
    const memoryUsage = process.memoryUsage();
    const snapshot: MemoryUsageReport = {
      timestamp: Date.now(),
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers
    };
    
    this.memorySnapshots.push(snapshot);
    
    // スナップショット数の制限
    if (this.memorySnapshots.length > this.snapshotRetention) {
      this.memorySnapshots.shift();
    }
    
    return snapshot;
  }
  
  /**
   * パフォーマンスメトリクスを取得
   */
  private capturePerformanceMetrics(): PerformanceMetrics {
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      cpuUsage: process.cpuUsage(),
      activeHandles: (process as any)._getActiveHandles?.().length,
      activeRequests: (process as any)._getActiveRequests?.().length
    };
    
    this.performanceMetrics.push(metrics);
    
    // メトリクス数の制限
    if (this.performanceMetrics.length > this.snapshotRetention) {
      this.performanceMetrics.shift();
    }
    
    return metrics;
  }
  
  /**
   * イベントループラグの測定
   */
  private measureEventLoopLag(): void {
    const start = Date.now();
    
    // setImmediate を使用してイベントループが完了した時点で時間を計測
    setImmediate(() => {
      const lag = Date.now() - start;
      
      if (this.performanceMetrics.length > 0) {
        this.performanceMetrics[this.performanceMetrics.length - 1].eventLoopLag = lag;
      }
      
      // 警告閾値を超えた場合はログに記録
      if (lag > this.thresholds.eventLoopLagMs) {
        logger.warn(`イベントループラグが検出されました: ${lag}ms`, {
          eventLoopLag: lag,
          thresholdMs: this.thresholds.eventLoopLagMs
        });
        
        this.emit('anomaly', {
          type: 'event-loop-lag',
          value: lag,
          threshold: this.thresholds.eventLoopLagMs,
          timestamp: Date.now()
        });
      }
    });
  }
  
  /**
   * メモリ使用量の異常を検出
   */
  private detectAnomalies(): void {
    if (this.memorySnapshots.length < 2) return;
    
    // 最新のスナップショットを取得
    const latestSnapshot = this.memorySnapshots[this.memorySnapshots.length - 1];
    
    // ヒープ使用率のチェック
    const heapUsedPercentage = (latestSnapshot.heapUsed / latestSnapshot.heapTotal) * 100;
    if (heapUsedPercentage > this.thresholds.heapUsedPercentage) {
      logger.warn(`高メモリ使用率が検出されました: ${heapUsedPercentage.toFixed(1)}%`, {
        heapUsedPercentage,
        heapUsed: formatBytes(latestSnapshot.heapUsed),
        heapTotal: formatBytes(latestSnapshot.heapTotal),
        threshold: this.thresholds.heapUsedPercentage
      });
      
      this.emit('anomaly', {
        type: MemoryAnomalyType.HIGH_USAGE,
        value: heapUsedPercentage,
        threshold: this.thresholds.heapUsedPercentage,
        timestamp: latestSnapshot.timestamp,
        memoryUsage: {
          heapUsed: latestSnapshot.heapUsed,
          heapTotal: latestSnapshot.heapTotal
        }
      });
      
      // メモリ使用率が90%を超える場合、GCを手動で実行
      if (heapUsedPercentage > 90 && this.gcEnabled) {
        logger.info('高メモリ使用率によりGCを手動実行します');
        this.forceGarbageCollection();
      }
    }
    
    // メモリリークの検出（継続的な増加パターン）
    this.detectMemoryLeak();
    
    // メモリスパイクの検出
    this.detectMemorySpike();
  }
  
  /**
   * メモリリークの検出
   */
  private detectMemoryLeak(): void {
    if (this.memorySnapshots.length < this.thresholds.consistentGrowthSamples) return;
    
    // 最新のN個のスナップショットを取得
    const recentSnapshots = this.memorySnapshots.slice(-this.thresholds.consistentGrowthSamples);
    
    // 連続的な増加があるかチェック
    let consistentIncrease = true;
    for (let i = 1; i < recentSnapshots.length; i++) {
      if (recentSnapshots[i].heapUsed <= recentSnapshots[i-1].heapUsed) {
        consistentIncrease = false;
        break;
      }
    }
    
    if (consistentIncrease) {
      // 最初と最後のスナップショット間の増加率を計算
      const firstSnapshot = recentSnapshots[0];
      const lastSnapshot = recentSnapshots[recentSnapshots.length - 1];
      const growthBytes = lastSnapshot.heapUsed - firstSnapshot.heapUsed;
      const growthPercent = (growthBytes / firstSnapshot.heapUsed) * 100;
      
      // 増加率が閾値を超える場合は警告
      if (growthPercent > this.thresholds.heapGrowthRate) {
        logger.warn(`メモリリークの可能性が検出されました: ${growthPercent.toFixed(1)}% (${formatBytes(growthBytes)})`, {
          growthPercent,
          growthBytes,
          startHeapUsed: formatBytes(firstSnapshot.heapUsed),
          currentHeapUsed: formatBytes(lastSnapshot.heapUsed),
          duration: (lastSnapshot.timestamp - firstSnapshot.timestamp) / 1000
        });
        
        this.emit('anomaly', {
          type: MemoryAnomalyType.LEAK,
          value: growthPercent,
          threshold: this.thresholds.heapGrowthRate,
          timestamp: lastSnapshot.timestamp,
          memoryUsage: {
            growth: growthBytes,
            startHeapUsed: firstSnapshot.heapUsed,
            currentHeapUsed: lastSnapshot.heapUsed,
            durationMs: lastSnapshot.timestamp - firstSnapshot.timestamp
          }
        });
      }
    }
  }
  
  /**
   * メモリスパイクの検出
   */
  private detectMemorySpike(): void {
    if (this.memorySnapshots.length < 3) return;
    
    // 最新の3つのスナップショットを取得
    const n3 = this.memorySnapshots[this.memorySnapshots.length - 3];
    const n2 = this.memorySnapshots[this.memorySnapshots.length - 2];
    const n1 = this.memorySnapshots[this.memorySnapshots.length - 1];
    
    // 急増後の急減少パターンを検出（スパイク）
    const increasePercent = ((n2.heapUsed - n3.heapUsed) / n3.heapUsed) * 100;
    const decreasePercent = ((n2.heapUsed - n1.heapUsed) / n2.heapUsed) * 100;
    
    if (increasePercent > 20 && decreasePercent > 20) {
      logger.info(`メモリスパイクを検出しました: +${increasePercent.toFixed(1)}% → -${decreasePercent.toFixed(1)}%`, {
        beforeSpike: formatBytes(n3.heapUsed),
        duringSpike: formatBytes(n2.heapUsed),
        afterSpike: formatBytes(n1.heapUsed)
      });
      
      this.emit('anomaly', {
        type: MemoryAnomalyType.SPIKE,
        value: increasePercent,
        threshold: 20,
        timestamp: n2.timestamp,
        memoryUsage: {
          beforeSpike: n3.heapUsed,
          duringSpike: n2.heapUsed,
          afterSpike: n1.heapUsed
        }
      });
    }
  }
  
  /**
   * メモリスナップショットを取得
   */
  public getMemorySnapshots(): MemoryUsageReport[] {
    return [...this.memorySnapshots];
  }
  
  /**
   * パフォーマンスメトリクスを取得
   */
  public getPerformanceMetrics(): PerformanceMetrics[] {
    return [...this.performanceMetrics];
  }
  
  /**
   * 最新のメモリ使用状況を取得
   */
  public getCurrentMemoryUsage(): MemoryUsageReport {
    if (this.memorySnapshots.length > 0) {
      return this.memorySnapshots[this.memorySnapshots.length - 1];
    }
    return this.captureMemorySnapshot();
  }
  
  /**
   * メモリ使用状況のレポートを生成
   */
  public generateMemoryReport(): string {
    const currentUsage = this.getCurrentMemoryUsage();
    const heapUsedPercent = (currentUsage.heapUsed / currentUsage.heapTotal) * 100;
    
    let report = 'メモリ使用状況レポート:\n';
    report += `- RSS: ${formatBytes(currentUsage.rss)}\n`;
    report += `- ヒープ合計: ${formatBytes(currentUsage.heapTotal)}\n`;
    report += `- ヒープ使用量: ${formatBytes(currentUsage.heapUsed)} (${heapUsedPercent.toFixed(1)}%)\n`;
    report += `- 外部: ${formatBytes(currentUsage.external)}\n`;
    
    if (currentUsage.arrayBuffers !== undefined) {
      report += `- ArrayBuffers: ${formatBytes(currentUsage.arrayBuffers)}\n`;
    }
    
    return report;
  }
  
  /**
   * ガベージコレクションを強制実行
   */
  public forceGarbageCollection(): void {
    if (!this.gcEnabled) {
      logger.warn('GCが有効化されていないため、強制GCを実行できません');
      return;
    }
    
    try {
      const beforeHeapUsed = process.memoryUsage().heapUsed;
      
      // GCを実行 (利用可能な場合のみ)
      if (global.gc) {
        global.gc();
      }
      
      const afterHeapUsed = process.memoryUsage().heapUsed;
      const freedBytes = beforeHeapUsed - afterHeapUsed;
      
      if (freedBytes > 0) {
        logger.info(`GCを実行しました: ${formatBytes(freedBytes)}解放 (${(freedBytes * 100 / beforeHeapUsed).toFixed(1)}%)`, {
          beforeHeapUsed: formatBytes(beforeHeapUsed),
          afterHeapUsed: formatBytes(afterHeapUsed),
          freedBytes: formatBytes(freedBytes)
        });
      } else {
        logger.info('GCを実行しましたが、顕著なメモリの解放はありませんでした', {
          beforeHeapUsed: formatBytes(beforeHeapUsed),
          afterHeapUsed: formatBytes(afterHeapUsed)
        });
      }
    } catch (error) {
      logger.error('GC実行中にエラーが発生しました:', error);
    }
  }
  
  /**
   * 保持するスナップショット数を設定
   */
  public setSnapshotRetention(count: number): void {
    this.snapshotRetention = Math.max(10, count);
    
    // スナップショット数を調整
    while (this.memorySnapshots.length > this.snapshotRetention) {
      this.memorySnapshots.shift();
    }
  }
  
  /**
   * 監視閾値を更新
   */
  public updateThresholds(thresholds: Partial<MonitoringThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logger.info('監視閾値を更新しました', this.thresholds);
  }
}

/**
 * バイト数を人間が読みやすい形式にフォーマット
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Node.jsのglobal型拡張
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      gc?: () => void;
    }
  }
}