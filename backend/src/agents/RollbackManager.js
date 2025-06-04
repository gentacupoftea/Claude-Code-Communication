/**
 * AutoFixer用ロールバック管理システム
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class RollbackManager {
  constructor(config, auditLogger) {
    this.config = config;
    this.auditLogger = auditLogger;
    this.backupDir = path.join(
      config.logging?.logDirectory || './logs/autofixer',
      'backups'
    );
    this.enabled = config.rollback?.enabled !== false;
    this.compressBackups = config.rollback?.compressBackups !== false;
    this.maxBackupFiles = config.rollback?.maxBackupFiles || 50;
    this.retentionDays = config.rollback?.backupRetentionDays || 30;
    this.backupRegistry = new Map(); // バックアップのレジストリ
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    await this.initializeBackupDirectory();
    this.initialized = true;
  }

  async initializeBackupDirectory() {
    if (this.enabled) {
      try {
        await fs.mkdir(this.backupDir, { recursive: true });
        await this.loadBackupRegistry();
      } catch (error) {
        console.error('バックアップディレクトリの作成に失敗しました:', error);
      }
    }
  }

  /**
   * ファイルのバックアップを作成
   */
  async createBackup(filePath, content, metadata = {}) {
    if (!this.enabled) return null;
    
    // 初期化を確認
    await this.initialize();

    try {
      const backupId = this.generateBackupId();
      const timestamp = new Date().toISOString();
      const checksum = this.calculateChecksum(content);
      
      // バックアップメタデータ
      const backupMetadata = {
        backupId,
        originalPath: filePath,
        timestamp,
        checksum,
        size: Buffer.byteLength(content),
        compressed: this.compressBackups,
        ...metadata
      };

      // バックアップファイル名（ファイル名をサニタイズ）
      const sanitizedFileName = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');
      const backupFileName = `${backupId}_${sanitizedFileName}${this.compressBackups ? '.gz' : ''}`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // コンテンツを保存（圧縮オプション付き）
      if (this.compressBackups) {
        const compressed = await gzip(content);
        await fs.writeFile(backupPath, compressed);
        backupMetadata.compressedSize = compressed.length;
      } else {
        await fs.writeFile(backupPath, content, 'utf8');
      }

      // レジストリに追加
      this.backupRegistry.set(backupId, {
        ...backupMetadata,
        backupPath
      });

      // レジストリを保存
      await this.saveBackupRegistry();

      // 監査ログに記録
      await this.auditLogger.logFileOperation({
        action: 'backup',
        filePath: filePath,
        result: 'success',
        backupPath: backupPath,
        checksum: checksum,
        size: backupMetadata.size
      });

      // 古いバックアップをクリーンアップ
      await this.cleanupOldBackups();

      return backupId;
    } catch (error) {
      console.error('バックアップ作成エラー:', error);
      
      await this.auditLogger.logFileOperation({
        action: 'backup',
        filePath: filePath,
        result: 'failed',
        error: error.message
      });
      
      return null;
    }
  }

  /**
   * バックアップからファイルを復元
   */
  async restore(backupId, targetPath = null) {
    if (!this.enabled) {
      throw new Error('ロールバック機能が無効です');
    }

    const backupInfo = this.backupRegistry.get(backupId);
    if (!backupInfo) {
      throw new Error(`バックアップが見つかりません: ${backupId}`);
    }

    try {
      // バックアップファイルを読み込み
      let content;
      const backupContent = await fs.readFile(backupInfo.backupPath);
      
      if (backupInfo.compressed) {
        content = await gunzip(backupContent);
        content = content.toString('utf8');
      } else {
        content = backupContent.toString('utf8');
      }

      // チェックサムを検証
      const checksum = this.calculateChecksum(content);
      if (checksum !== backupInfo.checksum) {
        throw new Error('バックアップファイルの整合性チェックに失敗しました');
      }

      // 復元先パス
      const restorePath = targetPath || backupInfo.originalPath;

      // 現在のファイルをバックアップ（上書き前）
      try {
        const currentContent = await fs.readFile(restorePath, 'utf8');
        await this.createBackup(restorePath, currentContent, {
          reason: 'pre_restore_backup',
          relatedBackupId: backupId
        });
      } catch (e) {
        // ファイルが存在しない場合は無視
      }

      // ファイルを復元
      await fs.writeFile(restorePath, content, 'utf8');

      // 監査ログに記録
      await this.auditLogger.logFileOperation({
        action: 'restore',
        filePath: restorePath,
        result: 'success',
        backupId: backupId,
        checksum: checksum
      });

      return {
        success: true,
        backupId,
        restoredPath: restorePath,
        originalPath: backupInfo.originalPath,
        timestamp: backupInfo.timestamp
      };

    } catch (error) {
      await this.auditLogger.logFileOperation({
        action: 'restore',
        filePath: targetPath || backupInfo.originalPath,
        result: 'failed',
        backupId: backupId,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * バックアップの一覧を取得
   */
  async listBackups(filePath = null) {
    const backups = [];
    
    for (const [backupId, info] of this.backupRegistry) {
      if (!filePath || info.originalPath === filePath) {
        backups.push({
          backupId,
          originalPath: info.originalPath,
          timestamp: info.timestamp,
          size: info.size,
          compressed: info.compressed,
          metadata: info.metadata
        });
      }
    }

    // タイムスタンプで降順ソート
    backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return backups;
  }

  /**
   * 特定の時点の状態に復元
   */
  async restoreToPoint(filePath, timestamp) {
    const backups = await this.listBackups(filePath);
    
    // 指定された時点以前の最新のバックアップを探す
    const targetBackup = backups.find(backup => 
      new Date(backup.timestamp) <= new Date(timestamp)
    );

    if (!targetBackup) {
      throw new Error(`指定された時点のバックアップが見つかりません: ${timestamp}`);
    }

    return await this.restore(targetBackup.backupId);
  }

  /**
   * バックアップレジストリの保存
   */
  async saveBackupRegistry() {
    const registryPath = path.join(this.backupDir, 'registry.json');
    const registryData = {};
    
    for (const [backupId, info] of this.backupRegistry) {
      registryData[backupId] = info;
    }

    await fs.writeFile(registryPath, JSON.stringify(registryData, null, 2), 'utf8');
  }

  /**
   * バックアップレジストリの読み込み
   */
  async loadBackupRegistry() {
    try {
      const registryPath = path.join(this.backupDir, 'registry.json');
      const registryContent = await fs.readFile(registryPath, 'utf8');
      const registryData = JSON.parse(registryContent);
      
      this.backupRegistry.clear();
      for (const [backupId, info] of Object.entries(registryData)) {
        this.backupRegistry.set(backupId, info);
      }
    } catch (error) {
      // レジストリファイルが存在しない場合は無視
      if (error.code !== 'ENOENT') {
        console.error('バックアップレジストリの読み込みエラー:', error);
      }
    }
  }

  /**
   * 古いバックアップのクリーンアップ
   */
  async cleanupOldBackups() {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - this.retentionDays * 24 * 60 * 60 * 1000);
    const toDelete = [];

    // 保持期限を過ぎたバックアップを特定
    for (const [backupId, info] of this.backupRegistry) {
      const backupDate = new Date(info.timestamp);
      if (backupDate < cutoffDate) {
        toDelete.push(backupId);
      }
    }

    // ファイル数制限のチェック
    const sortedBackups = Array.from(this.backupRegistry.entries())
      .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
    
    if (sortedBackups.length > this.maxBackupFiles) {
      const excess = sortedBackups.slice(this.maxBackupFiles);
      for (const [backupId] of excess) {
        if (!toDelete.includes(backupId)) {
          toDelete.push(backupId);
        }
      }
    }

    // バックアップを削除
    for (const backupId of toDelete) {
      const info = this.backupRegistry.get(backupId);
      if (info) {
        try {
          await fs.unlink(info.backupPath);
          this.backupRegistry.delete(backupId);
        } catch (error) {
          console.error(`バックアップ削除エラー (${backupId}):`, error);
        }
      }
    }

    if (toDelete.length > 0) {
      await this.saveBackupRegistry();
    }
  }

  /**
   * バックアップIDの生成
   */
  generateBackupId() {
    return `bak_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * チェックサムの計算
   */
  calculateChecksum(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * バックアップの比較
   */
  async compareBackups(backupId1, backupId2) {
    const backup1 = this.backupRegistry.get(backupId1);
    const backup2 = this.backupRegistry.get(backupId2);

    if (!backup1 || !backup2) {
      throw new Error('バックアップが見つかりません');
    }

    // ファイル内容を読み込み
    const content1 = await this.getBackupContent(backupId1);
    const content2 = await this.getBackupContent(backupId2);

    // 差分を計算
    const { diffLines } = require('diff');
    const diff = diffLines(content1, content2);

    return {
      backup1: {
        backupId: backupId1,
        timestamp: backup1.timestamp,
        size: backup1.size
      },
      backup2: {
        backupId: backupId2,
        timestamp: backup2.timestamp,
        size: backup2.size
      },
      diff: diff,
      identical: content1 === content2
    };
  }

  /**
   * バックアップの内容を取得
   */
  async getBackupContent(backupId) {
    const backupInfo = this.backupRegistry.get(backupId);
    if (!backupInfo) {
      throw new Error(`バックアップが見つかりません: ${backupId}`);
    }

    let content;
    const backupContent = await fs.readFile(backupInfo.backupPath);
    
    if (backupInfo.compressed) {
      content = await gunzip(backupContent);
      content = content.toString('utf8');
    } else {
      content = backupContent.toString('utf8');
    }

    return content;
  }
}

module.exports = RollbackManager;