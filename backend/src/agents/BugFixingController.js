/**
 * Conea自律AIエージェント - バグ修正統合コントローラー Phase 2
 * バグ検知から修正まで完全自動化
 */

const BugDetector = require('./BugDetector');
const AutoFixer = require('./AutoFixer');
const path = require('path');

class BugFixingController {
  constructor(config = {}) {
    this.bugDetector = new BugDetector();
    this.autoFixer = new AutoFixer();
    this.config = {
      projectPath: config.projectPath || process.cwd(),
      autoFixEnabled: config.autoFixEnabled !== false,
      maxConcurrentFixes: config.maxConcurrentFixes || 5,
      testAfterFix: config.testAfterFix !== false,
      ...config
    };
    
    this.activeFixSessions = new Map();
    this.isMonitoring = false;
  }

  async startAutonomousBugFixing() {
    console.log('🚀 Starting autonomous bug fixing system...');
    
    try {
      // 初期スキャン実行
      await this.performInitialScan();
      
      // リアルタイム監視開始
      if (this.config.autoFixEnabled) {
        await this.startRealTimeMonitoring();
      }
      
      console.log('✅ Autonomous bug fixing system is running');
      return { success: true };
      
    } catch (error) {
      console.error('Failed to start autonomous bug fixing:', error);
      return { success: false, error: error.message };
    }
  }

  async performInitialScan() {
    console.log('🔍 Performing initial project scan...');
    
    const { glob } = require('glob');
    const files = await glob('**/*.{js,ts,tsx,jsx}', { 
      cwd: this.config.projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.test.*', '**/*.spec.*']
    });

    console.log(`📂 Found ${files.length} files to scan`);
    
    const scanResults = [];
    for (const file of files) {
      const fullPath = path.join(this.config.projectPath, file);
      const bugs = await this.bugDetector.scanFile(fullPath);
      
      if (bugs.length > 0) {
        scanResults.push({
          file: fullPath,
          bugs: bugs
        });
      }
    }

    console.log(`🐛 Initial scan complete: Found bugs in ${scanResults.length} files`);
    
    // 検出されたバグを自動修正
    if (this.config.autoFixEnabled && scanResults.length > 0) {
      await this.processBugResults(scanResults);
    }

    return scanResults;
  }

  async startRealTimeMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️  Real-time monitoring already active');
      return;
    }

    this.isMonitoring = true;
    console.log('👁️  Starting real-time file monitoring...');
    
    const watcher = await this.bugDetector.startRealTimeMonitoring(this.config.projectPath);
    
    // カスタムイベントリスナーを追加
    watcher.on('change', async (filePath) => {
      await this.handleFileChange(filePath);
    });

    return watcher;
  }

  async handleFileChange(filePath) {
    const sessionId = `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log(`📝 File changed: ${filePath}, scanning for bugs...`);
      
      const bugs = await this.bugDetector.scanFile(filePath);
      
      if (bugs.length > 0) {
        console.log(`🐛 Found ${bugs.length} bugs in ${filePath}`);
        
        // 修正セッション開始
        this.activeFixSessions.set(sessionId, {
          filePath: filePath,
          bugs: bugs,
          startTime: Date.now(),
          status: 'processing'
        });

        const fixResults = await this.autoFixBugs(bugs, filePath);
        
        // セッション完了
        this.activeFixSessions.set(sessionId, {
          ...this.activeFixSessions.get(sessionId),
          status: 'completed',
          endTime: Date.now(),
          results: fixResults
        });

        await this.reportFixSession(sessionId);
      }
      
    } catch (error) {
      console.error(`Error handling file change for ${filePath}:`, error);
      
      if (this.activeFixSessions.has(sessionId)) {
        this.activeFixSessions.set(sessionId, {
          ...this.activeFixSessions.get(sessionId),
          status: 'failed',
          error: error.message,
          endTime: Date.now()
        });
      }
    }
  }

  async processBugResults(scanResults) {
    console.log('🔧 Processing bug results for auto-fixing...');
    
    const fixPromises = scanResults.map(async (result) => {
      try {
        return await this.autoFixBugs(result.bugs, result.file);
      } catch (error) {
        console.error(`Error fixing bugs in ${result.file}:`, error);
        return { success: false, error: error.message, file: result.file };
      }
    });

    const results = await Promise.all(fixPromises);
    
    const summary = {
      totalFiles: scanResults.length,
      successfulFixes: results.filter(r => r.success).length,
      failedFixes: results.filter(r => !r.success).length,
      totalBugsFixed: results.reduce((sum, r) => sum + (r.fixedBugs || 0), 0)
    };

    console.log(`📊 Fix summary: ${summary.successfulFixes}/${summary.totalFiles} files fixed, ${summary.totalBugsFixed} bugs resolved`);
    
    return summary;
  }

  async autoFixBugs(bugs, filePath) {
    if (!this.config.autoFixEnabled) {
      console.log('⚠️  Auto-fix disabled, skipping fixes');
      return { success: false, reason: 'Auto-fix disabled' };
    }

    console.log(`🔧 Auto-fixing ${bugs.length} bugs in ${filePath}`);
    
    try {
      // 重要度でフィルタリング（critical と high のみ自動修正）
      const autoFixableBugs = bugs.filter(bug => 
        ['critical', 'high'].includes(bug.severity)
      );

      if (autoFixableBugs.length === 0) {
        console.log('ℹ️  No auto-fixable bugs found (only critical/high severity bugs are auto-fixed)');
        return { 
          success: true, 
          fixedBugs: 0, 
          skippedBugs: bugs.length,
          reason: 'No high-priority bugs'
        };
      }

      const batchResult = await this.autoFixer.batchFixBugs(autoFixableBugs, filePath);
      
      if (batchResult.fixedBugs > 0) {
        console.log(`✅ Successfully fixed ${batchResult.fixedBugs}/${autoFixableBugs.length} bugs`);
        
        // Slack通知
        await this.notifyFixCompletion(filePath, batchResult);
        
        // 修正後の検証
        if (this.config.testAfterFix) {
          await this.verifyFixes(filePath, batchResult);
        }
      }

      return {
        success: true,
        fixedBugs: batchResult.fixedBugs,
        totalBugs: bugs.length,
        results: batchResult.results
      };

    } catch (error) {
      console.error(`Auto-fix error for ${filePath}:`, error);
      return {
        success: false,
        error: error.message,
        file: filePath
      };
    }
  }

  async verifyFixes(filePath, fixResults) {
    console.log(`🧪 Verifying fixes for ${filePath}...`);
    
    try {
      // 修正後に再スキャンして残存バグをチェック
      const remainingBugs = await this.bugDetector.scanFile(filePath);
      
      const verification = {
        originalBugs: fixResults.totalBugs,
        fixedBugs: fixResults.fixedBugs,
        remainingBugs: remainingBugs.length,
        newBugs: remainingBugs.filter(bug => 
          !fixResults.results.some(result => result.bugId === bug.id)
        ).length
      };

      if (verification.newBugs > 0) {
        console.log(`⚠️  Verification found ${verification.newBugs} new bugs introduced by fixes`);
        
        // 新しいバグが導入された場合はロールバックを検討
        await this.handleRegressionBugs(filePath, verification);
      } else {
        console.log(`✅ Verification passed: ${verification.remainingBugs} bugs remaining`);
      }

      return verification;
      
    } catch (error) {
      console.error('Fix verification error:', error);
      return null;
    }
  }

  async handleRegressionBugs(filePath, verification) {
    console.log(`🚨 Handling regression bugs in ${filePath}`);
    
    // 重大な回帰がある場合は一部修正をロールバック
    if (verification.newBugs > verification.fixedBugs) {
      console.log('⚠️  Significant regression detected, considering rollback...');
      
      // TODO: より洗練されたロールバック戦略の実装
      await this.saveRegressionReport(filePath, verification);
    }
  }

  async notifyFixCompletion(filePath, fixResults) {
    try {
      // Slack通知（設定されている場合）
      const message = `🔧 Auto-fix completed for ${path.basename(filePath)}: ${fixResults.fixedBugs} bugs fixed`;
      
      const response = await fetch('http://localhost:8000/api/slack/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: '#dev-notifications',
          message: message,
          details: {
            file: filePath,
            fixedBugs: fixResults.fixedBugs,
            totalBugs: fixResults.totalBugs
          }
        })
      });

      if (response.ok) {
        console.log('📱 Slack notification sent');
      }
    } catch (error) {
      console.log('Slack notification skipped:', error.message);
    }
  }

  async reportFixSession(sessionId) {
    const session = this.activeFixSessions.get(sessionId);
    if (!session) return;

    const duration = session.endTime - session.startTime;
    
    console.log(`📊 Fix session ${sessionId} completed in ${duration}ms`);
    console.log(`   File: ${session.filePath}`);
    console.log(`   Status: ${session.status}`);
    
    if (session.results) {
      console.log(`   Fixed: ${session.results.fixedBugs}/${session.bugs.length} bugs`);
    }

    // OpenMemoryに保存
    await this.saveSessionReport(session);
    
    // 古いセッションをクリーンアップ
    setTimeout(() => {
      this.activeFixSessions.delete(sessionId);
    }, 300000); // 5分後に削除
  }

  async saveSessionReport(session) {
    try {
      const response = await fetch('http://localhost:8000/api/memory/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'bug-fixing-controller',
          content: `Bug fixing session: ${session.status} for ${path.basename(session.filePath)}`,
          metadata: {
            type: 'bug_fixing_session',
            session: session
          }
        })
      });

      if (response.ok) {
        console.log(`📊 Session report saved for ${session.filePath}`);
      }
    } catch (error) {
      console.error('Failed to save session report:', error);
    }
  }

  async saveRegressionReport(filePath, verification) {
    try {
      const response = await fetch('http://localhost:8000/api/memory/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'bug-fixing-controller',
          content: `Regression detected in ${path.basename(filePath)}: ${verification.newBugs} new bugs introduced`,
          metadata: {
            type: 'regression_report',
            file: filePath,
            verification: verification,
            severity: 'high'
          }
        })
      });

      if (response.ok) {
        console.log(`⚠️  Regression report saved for ${filePath}`);
      }
    } catch (error) {
      console.error('Failed to save regression report:', error);
    }
  }

  async getSystemStatus() {
    const bugStats = await this.bugDetector.getBugStatistics();
    const fixStats = this.autoFixer.getFixStatistics();
    
    return {
      monitoring: this.isMonitoring,
      autoFixEnabled: this.config.autoFixEnabled,
      activeFixSessions: this.activeFixSessions.size,
      bugDetection: bugStats,
      autoFix: fixStats,
      projectPath: this.config.projectPath
    };
  }

  async stopMonitoring() {
    this.isMonitoring = false;
    console.log('🛑 Bug fixing monitoring stopped');
  }
}

module.exports = BugFixingController;