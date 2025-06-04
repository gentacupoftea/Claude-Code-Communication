/**
 * AutoFixer用監査ログシステム
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class AuditLogger {
  constructor(config) {
    this.config = config;
    this.logDir = config.logging?.logDirectory || './logs/autofixer';
    this.auditLogEnabled = config.logging?.auditLog !== false;
    this.securityLogEnabled = config.logging?.securityLog !== false;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    await this.initializeLogDirectory();
    this.initialized = true;
  }

  async initializeLogDirectory() {
    if (this.auditLogEnabled || this.securityLogEnabled) {
      try {
        await fs.mkdir(this.logDir, { recursive: true });
      } catch (error) {
        console.error('ログディレクトリの作成に失敗しました:', error);
      }
    }
  }

  /**
   * 監査ログエントリを作成
   */
  async logAuditEvent(event) {
    if (!this.auditLogEnabled) return;
    
    // 初期化を確認
    await this.initialize();

    const entry = {
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId(),
      type: event.type,
      severity: event.severity || 'info',
      user: event.user || 'auto-fixer',
      action: event.action,
      target: event.target,
      result: event.result,
      metadata: event.metadata || {},
      stackTrace: event.includeStack ? new Error().stack : undefined
    };

    await this.writeLog('audit', entry);
  }

  /**
   * セキュリティイベントをログに記録
   */
  async logSecurityEvent(event) {
    if (!this.securityLogEnabled) return;

    const entry = {
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId(),
      type: 'SECURITY',
      subtype: event.type,
      severity: event.severity || 'warning',
      action: event.action,
      blocked: event.blocked || false,
      reason: event.reason,
      source: {
        ip: event.sourceIp,
        user: event.user || 'unknown',
        process: process.pid
      },
      target: event.target,
      metadata: this.sanitizeMetadata(event.metadata || {})
    };

    await this.writeLog('security', entry);
    
    // 重大なセキュリティイベントの場合はコンソールにも出力
    if (entry.severity === 'critical' || entry.severity === 'high') {
      console.error(`[SECURITY ${entry.severity.toUpperCase()}] ${event.type}: ${event.reason}`);
    }
  }

  /**
   * ファイル操作をログに記録
   */
  async logFileOperation(operation) {
    const event = {
      type: 'file_operation',
      action: operation.action, // read, write, delete, backup
      target: operation.filePath,
      result: operation.result,
      metadata: {
        size: operation.size,
        backup: operation.backupPath,
        checksum: operation.checksum
      }
    };

    await this.logAuditEvent(event);
  }

  /**
   * コマンド実行をログに記録
   */
  async logCommandExecution(command) {
    const event = {
      type: 'command_execution',
      action: 'execute',
      target: command.cmd,
      result: command.result,
      metadata: {
        args: command.args,
        exitCode: command.exitCode,
        duration: command.duration,
        timeout: command.timeout
      }
    };

    await this.logAuditEvent(event);

    // セキュリティ関連のコマンドは別途記録
    if (command.blocked) {
      await this.logSecurityEvent({
        type: 'command_blocked',
        action: 'execute',
        blocked: true,
        reason: command.reason,
        target: command.cmd,
        metadata: { args: command.args }
      });
    }
  }

  /**
   * パス検証イベントをログに記録
   */
  async logPathValidation(validation) {
    if (validation.blocked) {
      await this.logSecurityEvent({
        type: 'path_traversal_attempt',
        severity: 'high',
        action: 'access',
        blocked: true,
        reason: validation.reason,
        target: validation.path,
        metadata: {
          normalizedPath: validation.normalizedPath,
          detectionMethod: validation.detectionMethod
        }
      });
    }
  }

  /**
   * 自動修正の実行をログに記録
   */
  async logAutoFix(fix) {
    const event = {
      type: 'auto_fix',
      severity: fix.severity || 'info',
      action: fix.action,
      target: fix.filePath,
      result: fix.success ? 'success' : 'failed',
      metadata: {
        bugType: fix.bugType,
        bugId: fix.bugId,
        strategy: fix.strategy,
        confidence: fix.confidence,
        appliedFixes: fix.appliedFixes,
        error: fix.error
      }
    };

    await this.logAuditEvent(event);
  }

  /**
   * ログファイルに書き込み
   */
  async writeLog(logType, entry) {
    try {
      const date = new Date();
      const fileName = `${logType}-${date.toISOString().split('T')[0]}.log`;
      const filePath = path.join(this.logDir, fileName);
      
      const logLine = JSON.stringify(entry) + '\n';
      
      await fs.appendFile(filePath, logLine, 'utf8');
      
      // ログローテーションのチェック
      await this.checkLogRotation(filePath);
    } catch (error) {
      console.error(`ログ書き込みエラー (${logType}):`, error);
    }
  }

  /**
   * ログローテーション
   */
  async checkLogRotation(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const maxSize = this.parseSize(this.config.logging?.maxLogSize || '100MB');
      
      if (stats.size > maxSize) {
        const rotatedPath = `${filePath}.${Date.now()}`;
        await fs.rename(filePath, rotatedPath);
        
        // 古いログファイルの削除
        await this.cleanOldLogs();
      }
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
  }

  /**
   * 古いログファイルを削除
   */
  async cleanOldLogs() {
    const maxFiles = this.config.logging?.maxLogFiles || 10;
    const files = await fs.readdir(this.logDir);
    
    // タイムスタンプ付きのログファイルを取得
    const logFiles = files
      .filter(f => f.match(/\.(log|gz)\.\d+$/))
      .map(f => ({ name: f, path: path.join(this.logDir, f) }));
    
    // 統計情報を取得してソート
    const fileStats = await Promise.all(
      logFiles.map(async (f) => ({
        ...f,
        mtime: (await fs.stat(f.path)).mtime
      }))
    );
    
    fileStats.sort((a, b) => b.mtime - a.mtime);
    
    // 最大ファイル数を超えた分を削除
    const toDelete = fileStats.slice(maxFiles);
    for (const file of toDelete) {
      await fs.unlink(file.path);
    }
  }

  /**
   * メタデータのサニタイズ（機密情報の除去）
   */
  sanitizeMetadata(metadata) {
    if (!this.config.logging?.sensitiveDataMasking) {
      return metadata;
    }

    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth'];
    
    // ディープコピーを作成して元のオブジェクトを変更しない
    const sanitized = JSON.parse(JSON.stringify(metadata));

    const sanitizeObject = (obj) => {
      for (const key in obj) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * イベントIDの生成
   */
  generateEventId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * サイズ文字列をバイト数に変換
   */
  parseSize(sizeStr) {
    const units = { KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+)(KB|MB|GB)$/i);
    
    if (!match) {
      return parseInt(sizeStr) || 100 * 1024 * 1024; // デフォルト100MB
    }
    
    return parseInt(match[1]) * units[match[2].toUpperCase()];
  }

  /**
   * ログの集計レポートを生成
   */
  async generateReport(startDate, endDate) {
    const report = {
      period: { start: startDate, end: endDate },
      summary: {
        totalEvents: 0,
        byType: {},
        bySeverity: {},
        securityEvents: 0,
        blockedActions: 0
      },
      topIssues: []
    };

    // ログファイルを読み込んで集計
    const files = await fs.readdir(this.logDir);
    for (const file of files) {
      if (!file.endsWith('.log')) continue;
      
      const content = await fs.readFile(path.join(this.logDir, file), 'utf8');
      const lines = content.split('\n').filter(l => l);
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const entryDate = new Date(entry.timestamp);
          
          if (entryDate >= startDate && entryDate <= endDate) {
            report.summary.totalEvents++;
            report.summary.byType[entry.type] = (report.summary.byType[entry.type] || 0) + 1;
            report.summary.bySeverity[entry.severity] = (report.summary.bySeverity[entry.severity] || 0) + 1;
            
            if (entry.type === 'SECURITY') {
              report.summary.securityEvents++;
              if (entry.blocked) report.summary.blockedActions++;
            }
          }
        } catch (e) {
          // 無効な行は無視
        }
      }
    }

    return report;
  }
}

module.exports = AuditLogger;