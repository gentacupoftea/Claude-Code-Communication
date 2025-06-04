/**
 * Conea自律AIエージェント - 自動修正エンジン Phase 2
 * 検出されたバグの自動修正実行
 */

const fs = require('fs').promises;
const path = require('path');
const { diffLines } = require('diff');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { promisify } = require('util');

// 設定ファイルの読み込み
let config;
try {
  config = require('./autoFixerConfig.json');
} catch (e) {
  console.error('設定ファイルの読み込みエラー:', e.message);
  // 完全なデフォルト設定
  config = {
    security: {
      allowedCommands: ['node', 'npm', 'npx'],
      baseDirs: { useProjectRoot: true, additional: [] },
      pathValidation: {
        allowedPrefixes: { unix: ['/tmp'], windows: ['C:\\Temp'] },
        maxPathLength: 4096,
        maxPathDepth: 20,
        urlDecodeAttempts: 3
      },
      commandExecution: { 
        defaultTimeout: 30000,
        maxTimeout: 600000,
        maxOutputSize: 10485760
      },
      environmentVariables: { 
        allowed: ['PATH', 'NODE_ENV', 'HOME', 'USER'],
        blocked: ['LD_PRELOAD', 'LD_LIBRARY_PATH']
      }
    },
    autoFix: {
      enabledStrategies: {},
      requireManualReview: [],
      maxAutoFixesPerRun: 10,
      createBackups: true,
      runTestsAfterFix: false
    },
    logging: { 
      level: 'info',
      auditLog: true,
      securityLog: true,
      performanceLog: false,
      logDirectory: './logs/autofixer',
      maxLogSize: '100MB',
      maxLogFiles: 10,
      sensitiveDataMasking: true
    },
    rollback: {
      enabled: true,
      maxBackupFiles: 50,
      backupRetentionDays: 30,
      compressBackups: true
    }
  };
}

// 監査ログシステムのインポート
const AuditLogger = require('./AuditLogger');
// ロールバック管理システムのインポート
const RollbackManager = require('./RollbackManager');

class AutoFixer {
  constructor() {
    this.fixStrategies = new Map();
    this.executionHistory = [];
    this.securityWarnings = []; // セキュリティ警告を記録
    
    // 設定を検証
    this.validateConfig(config);
    
    this.auditLogger = new AuditLogger(config); // 監査ログシステムの初期化
    this.rollbackManager = new RollbackManager(config, this.auditLogger); // ロールバック管理の初期化
    this.initializeFixStrategies();
    
    // 非同期初期化
    this.initializeAsync();
  }

  async initializeAsync() {
    try {
      await this.auditLogger.initialize();
      await this.rollbackManager.initialize();
    } catch (error) {
      console.error('AutoFixer初期化エラー:', error);
    }
  }

  initializeFixStrategies() {
    // メモリリーク修正戦略
    this.fixStrategies.set('memory_leak', {
      strategy: 'add_cleanup',
      confidence: 0.8,
      autoApply: true,
      fixes: [
        {
          pattern: /setInterval\s*\(\s*([^,]+),\s*([^)]+)\)/g,
          replacement: (match, func, interval) => {
            return `const intervalId = setInterval(${func}, ${interval});\n// TODO: Add clearInterval(intervalId) when appropriate`;
          }
        },
        {
          pattern: /addEventListener\s*\(\s*['"`]([^'"`]+)['"`],\s*([^)]+)\)/g,
          replacement: (match, event, handler) => {
            return `addEventListener('${event}', ${handler});\n// TODO: Add removeEventListener('${event}', ${handler}) when appropriate`;
          }
        }
      ]
    });

    // SQL インジェクション修正戦略
    this.fixStrategies.set('sql_injection', {
      strategy: 'parameterize_query',
      confidence: 0.9,
      autoApply: false, // 手動承認必要
      fixes: [
        {
          pattern: /SELECT\s+.*\s+FROM\s+.*\s+WHERE\s+.*\$\{([^}]+)\}/gi,
          replacement: (match, variable) => {
            return match.replace(/\$\{[^}]+\}/g, '?') + `\n// TODO: Use parameterized query with ${variable}`;
          }
        }
      ]
    });

    // XSS脆弱性修正戦略
    this.fixStrategies.set('xss_vulnerability', {
      strategy: 'sanitize_input',
      confidence: 0.85,
      autoApply: false,
      fixes: [
        {
          pattern: /innerHTML\s*=\s*([^;]+);/g,
          replacement: (match, content) => {
            return `textContent = ${content}; // Changed from innerHTML to prevent XSS`;
          }
        }
      ]
    });

    // 非同期エラー修正戦略
    this.fixStrategies.set('async_error', {
      strategy: 'add_error_handling',
      confidence: 0.7,
      autoApply: true,
      fixes: [
        {
          pattern: /await\s+([^;]+);/g,
          replacement: (match, asyncCall) => {
            return `try {\n  await ${asyncCall};\n} catch (error) {\n  console.error('Async error:', error);\n  // TODO: Handle error appropriately\n}`;
          }
        }
      ]
    });

    // リソースリーク修正戦略
    this.fixStrategies.set('resource_leak', {
      strategy: 'add_resource_cleanup',
      confidence: 0.75,
      autoApply: true,
      fixes: [
        {
          pattern: /(const\s+\w+\s*=\s*fs\.createReadStream\s*\([^)]+\);)/g,
          replacement: (match, streamCreation) => {
            return `${streamCreation}\n// TODO: Add stream.close() in finally block or use stream.pipeline()`;
          }
        }
      ]
    });

    // 暗号化脆弱性修正戦略
    this.fixStrategies.set('crypto_vulnerability', {
      strategy: 'crypto_security_review',
      confidence: 0.7, // 信頼度を下げる
      autoApply: false, // 自動適用を無効化（互換性リスクのため）
      requiresSecurityReview: true, // セキュリティレビューを必須に
      fixes: [
        {
          // より網羅的なパターン（大文字小文字、スペースを考慮）
          pattern: /(createHash\s*\(\s*['"`](?:md5|sha1|MD5|SHA1)['"`]\s*\))/gi,
          replacement: (match) => {
            // 警告コメントを追加して、手動レビューを促す
            return `/* SECURITY WARNING: Weak hash algorithm detected. 
   * Consider replacing with SHA-256 if used for cryptographic purposes.
   * Note: Changing hash algorithm will break compatibility with existing hashes.
   */ ${match}`;
          }
        },
        {
          // crypto.createHmac の弱いアルゴリズムも修正
          pattern: /(createHmac\s*\(\s*['"`](?:md5|sha1|MD5|SHA1)['"`]\s*,)/gi,
          replacement: (match) => {
            return `/* SECURITY WARNING: Weak HMAC algorithm detected. 
   * Consider replacing with SHA-256 for cryptographic purposes.
   */ ${match}`;
          }
        }
      ]
    });

    // パストラバーサル脆弱性修正戦略
    this.fixStrategies.set('path_traversal', {
      strategy: 'path_security_validation',
      confidence: 0.85,
      autoApply: true,
      requiresSecurityReview: false,
      fixes: [
        {
          pattern: /((?:fs\.readFile|fs\.writeFile)\s*\()([^)]*\$\{[^}]*\}[^)]*)(\))/g,
          replacement: (match, func, pathArg, closing) => {
            // パス引数を安全な検証付きのものに置き換える
            return `${func}this.sanitizePath(${pathArg})${closing}`;
          }
        },
        {
          // fs.promises のメソッドも同様に処理
          pattern: /(fs\.(?:readFile|writeFile|unlink|mkdir|rmdir)\s*\()([^)]*\$\{[^}]*\}[^)]*)(\))/g,
          replacement: (match, func, pathArg, closing) => {
            return `${func}this.sanitizePath(${pathArg})${closing}`;
          }
        }
      ]
    });

    // コマンドインジェクション修正戦略
    this.fixStrategies.set('command_injection', {
      strategy: 'command_security_validation',
      confidence: 0.9,
      autoApply: true,
      requiresSecurityReview: false,
      fixes: [
        {
          // exec()をspawn()に置き換える
          pattern: /const\s*\{\s*exec\s*\}\s*=\s*require\s*\(\s*['"`]child_process['"`]\s*\);/g,
          replacement: (match) => {
            return "const { spawn } = require('child_process');";
          }
        },
        {
          // execAsync の使用を安全な spawn に置き換える
          pattern: /execAsync\s*\(([^)]+)\)/g,
          replacement: (match, command) => {
            return `this.safeSpawn(${command})`;
          }
        }
      ]
    });
  }

  async autoFixBug(bug, filePath, originalContent) {
    console.log(`🔧 Attempting auto-fix for ${bug.type} in ${filePath}:${bug.line}`);

    const strategy = this.fixStrategies.get(bug.type);
    if (!strategy) {
      console.log(`❌ No fix strategy available for ${bug.type}`);
      return null;
    }

    // 設定ファイルで有効化されているか確認
    const isEnabledInConfig = config.autoFix?.enabledStrategies?.[bug.type] !== false;
    
    // 自動適用の確認
    if (!strategy.autoApply || !isEnabledInConfig) {
      console.log(`⚠️  ${bug.type} requires manual approval - not auto-applying`);
      return await this.suggestManualFix(bug, strategy, originalContent);
    }

    try {
      const fixResult = await this.applyFix(bug, strategy, filePath, originalContent);
      
      // 修正履歴を記録
      this.executionHistory.push({
        bugId: bug.id,
        filePath: filePath,
        fixType: bug.type,
        strategy: strategy.strategy,
        timestamp: new Date().toISOString(),
        success: fixResult.success,
        confidence: strategy.confidence
      });

      if (fixResult.success) {
        console.log(`✅ Successfully auto-fixed ${bug.type} in ${filePath}`);
        await this.saveFixResult(bug, fixResult);
      } else {
        console.log(`❌ Auto-fix failed for ${bug.type}: ${fixResult.error}`);
      }

      return fixResult;

    } catch (error) {
      console.error(`Auto-fix error for ${bug.type}:`, error);
      return {
        success: false,
        error: error.message,
        bugId: bug.id
      };
    }
  }

  async applyFix(bug, strategy, filePath, originalContent) {
    let fixedContent = originalContent;
    let appliedFixes = [];

    // 各修正パターンを適用
    for (const fix of strategy.fixes) {
      const matches = [...originalContent.matchAll(fix.pattern)];
      
      if (matches.length > 0) {
        for (const match of matches) {
          const replacement = fix.replacement(match[0], ...match.slice(1));
          fixedContent = fixedContent.replace(match[0], replacement);
          
          appliedFixes.push({
            original: match[0],
            fixed: replacement,
            line: this.getLineNumber(originalContent, match.index)
          });
        }
      }
    }

    if (appliedFixes.length === 0) {
      return {
        success: false,
        error: 'No applicable fixes found',
        bugId: bug.id
      };
    }

    // テスト環境ではファイル操作をスキップ
    let backupId = null;
    if (process.env.NODE_ENV !== 'test' && config.autoFix.createBackups) {
      // ロールバックマネージャーを使用してバックアップを作成
      backupId = await this.rollbackManager.createBackup(filePath, originalContent, {
        reason: 'auto_fix',
        bugId: bug.id,
        bugType: bug.type,
        strategy: strategy.strategy
      });

      // 修正されたコンテンツを適用
      await fs.writeFile(filePath, fixedContent, 'utf8');

      // 構文チェック
      const syntaxValid = await this.validateSyntax(filePath, fixedContent);
      if (!syntaxValid) {
        // 構文エラーがある場合はロールバック
        if (backupId) {
          await this.rollbackManager.restore(backupId);
        } else {
          await fs.writeFile(filePath, originalContent, 'utf8');
        }
        return {
          success: false,
          error: 'Syntax validation failed - changes rolled back',
          bugId: bug.id,
          backupId: backupId
        };
      }
    }

    return {
      success: true,
      bugId: bug.id,
      filePath: filePath,
      backupId: backupId, // ロールバックマネージャーのバックアップID
      appliedFixes: appliedFixes,
      diff: this.generateDiff(originalContent, fixedContent),
      confidence: strategy.confidence,
      fixedContent: fixedContent // テスト用に修正されたコンテンツを返す
    };
  }

  async suggestManualFix(bug, strategy, originalContent) {
    const suggestions = [];

    for (const fix of strategy.fixes) {
      const matches = [...originalContent.matchAll(fix.pattern)];
      
      for (const match of matches) {
        if (this.isMatchingBugLocation(bug, match, originalContent)) {
          const suggestion = fix.replacement(match[0], ...match.slice(1));
          suggestions.push({
            original: match[0],
            suggested: suggestion,
            line: this.getLineNumber(originalContent, match.index),
            confidence: strategy.confidence
          });
        }
      }
    }

    return {
      success: false,
      requiresManualApproval: true,
      bugId: bug.id,
      strategy: strategy.strategy,
      suggestions: suggestions
    };
  }

  isMatchingBugLocation(bug, match, content) {
    const matchLine = this.getLineNumber(content, match.index);
    return Math.abs(matchLine - bug.line) <= 2; // 2行の誤差を許容
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * ファイルパスを安全にサニタイズする
   * パストラバーサル攻撃を防ぐ
   */
  async sanitizePath(userPath) {
    if (typeof userPath !== 'string') {
      throw new Error('Invalid path: must be a string');
    }

    // URLデコードを複数回実行して多重エンコードに対処
    let decodedPath = userPath;
    const decodeAttempts = config.security?.pathValidation?.urlDecodeAttempts || 3;
    for (let i = 0; i < decodeAttempts; i++) {
      try {
        const decoded = decodeURIComponent(decodedPath);
        if (decoded === decodedPath) break;
        decodedPath = decoded;
      } catch (e) {
        // 無効なエンコーディングの場合は処理を継続
        break;
      }
    }

    // Unicode正規化（NFKCで完全な正規化）
    const normalizedPath = decodedPath.normalize('NFKC');

    // null bytesと危険な文字を除去
    const cleanPath = normalizedPath
      .replace(/\0/g, '')
      .replace(/[\u2025\uFF61\u3002]/g, '.') // Unicode dots
      .replace(/[\u2215\uFF0F]/g, '/'); // Unicode slashes

    // パス区切り文字を統一（Windows/Unix両対応）
    const unifiedPath = cleanPath.replace(/[\\\/]+/g, path.sep);

    // path.resolveで絶対パスに変換
    const resolvedPath = path.resolve(unifiedPath);
    const baseDir = path.resolve(process.cwd());

    // path.relativeを使った安全な検証
    const relative = path.relative(baseDir, resolvedPath);
    
    // ベースディレクトリの外を参照している場合
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      // パストラバーサル試行をログに記録
      await this.auditLogger.logPathValidation({
        blocked: true,
        reason: 'Path traversal attempt',
        path: userPath,
        normalizedPath: resolvedPath,
        detectionMethod: 'relative_path_check'
      });
      throw new Error(`Path traversal attempt detected: ${userPath}`);
    }

    // Windowsドライブレターのチェック（C:\ など）
    if (process.platform === 'win32' && /^[a-zA-Z]:/.test(relative)) {
      this.auditLogger.logPathValidation({
        blocked: true,
        reason: 'Absolute path detected',
        path: userPath,
        normalizedPath: resolvedPath,
        detectionMethod: 'windows_drive_letter'
      });
      throw new Error(`Absolute path detected: ${userPath}`);
    }

    // シンボリックリンクのチェック
    try {
      // ファイルまたはディレクトリが存在する場合は実パスを取得
      const realPath = await this.getRealPath(resolvedPath);
      
      // 実パスがベースディレクトリ内にあることを再確認
      if (!realPath.startsWith(baseDir)) {
        this.auditLogger.logPathValidation({
          blocked: true,
          reason: 'Symlink traversal attempt',
          path: userPath,
          normalizedPath: resolvedPath,
          realPath: realPath,
          detectionMethod: 'symlink_resolution'
        });
        throw new Error(`Symlink traversal attempt detected: ${userPath}`);
      }
      
      return realPath;
    } catch (error) {
      // ファイルが存在しない場合は、親ディレクトリをチェック
      if (error.code === 'ENOENT') {
        const parentDir = path.dirname(resolvedPath);
        try {
          const realParentDir = await this.getRealPath(parentDir);
          if (!realParentDir.startsWith(baseDir)) {
            this.auditLogger.logPathValidation({
              blocked: true,
              reason: 'Parent directory symlink traversal',
              path: userPath,
              normalizedPath: resolvedPath,
              detectionMethod: 'parent_symlink_resolution'
            });
            throw new Error(`Parent directory traversal attempt detected: ${userPath}`);
          }
          // 親ディレクトリが安全な場合は、元のパスを返す
          return resolvedPath;
        } catch (parentError) {
          // 親ディレクトリも存在しない場合は、元のパスを返す
          return resolvedPath;
        }
      }
      
      throw error;
    }
  }

  /**
   * 実パスを取得（シンボリックリンクを解決）
   */
  async getRealPath(filePath) {
    const fsSync = require('fs');
    return new Promise((resolve, reject) => {
      fsSync.realpath(filePath, (err, realPath) => {
        if (err) reject(err);
        else resolve(realPath);
      });
    });
  }

  /**
   * コマンドを安全に実行する
   * コマンドインジェクションを防ぐ
   * @param {string|object} command - コマンド文字列またはオブジェクト形式
   * @param {object} options - spawnオプション
   */
  async safeSpawn(command, options = {}) {
    let cmd, args;
    
    // オブジェクト形式の引数をサポート（より安全）
    if (typeof command === 'object' && command.cmd) {
      cmd = command.cmd;
      args = command.args || [];
      options = { ...options, ...command };
    } else if (typeof command === 'string') {
      // 文字列形式（後方互換性のため）
      // シンプルなコマンドパーサー（引用符を考慮）
      const parseCommand = (cmdStr) => {
        const parts = [];
        let current = '';
        let inQuote = false;
        let quoteChar = '';
        
        for (let i = 0; i < cmdStr.length; i++) {
          const char = cmdStr[i];
          
          if (inQuote) {
            if (char === quoteChar && cmdStr[i - 1] !== '\\') {
              inQuote = false;
              quoteChar = '';
            } else {
              current += char;
            }
          } else {
            if (char === '"' || char === "'") {
              inQuote = true;
              quoteChar = char;
            } else if (char === ' ' && current) {
              parts.push(current);
              current = '';
            } else if (char !== ' ') {
              current += char;
            }
          }
        }
        
        if (current) parts.push(current);
        return parts;
      };

      const parts = parseCommand(command.trim());
      cmd = parts[0];
      args = parts.slice(1);
    } else {
      throw new Error('Command must be a string or object with cmd property');
    }

    // 設定から許可されたコマンドのリストを取得
    const allowedCommands = config.security.allowedCommands || ['node', 'npm', 'npx'];
    
    if (!allowedCommands.includes(cmd)) {
      // セキュリティ警告を記録
      this.addSecurityWarning({
        type: 'command_blocked',
        command: cmd,
        reason: 'Command not in allowed list'
      });
      throw new Error(`Command not allowed: ${cmd}`);
    }

    // 引数の検証（より厳格に）
    const dangerousPatterns = [
      /[;&|`$()<>{}[\]]/,        // シェルメタ文字
      /^\.\.[\\/]/,              // 相対パストラバーサル
      /^\/(?!tmp|var\/tmp)/,     // 絶対パス（/tmpと/var/tmpは許可）
      /^[a-zA-Z]:\\/,            // Windowsの絶対パス
      /^(https?|file|ftp):/i     // URLスキーム
    ];
    
    for (const arg of args) {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(arg)) {
          throw new Error(`Potentially dangerous argument: ${arg}`);
        }
      }
    }

    // 環境変数のサニタイズ（設定ベース）
    const safeEnv = {};
    const allowedEnvVars = config.security.environmentVariables.allowed || [];
    const blockedEnvVars = config.security.environmentVariables.blocked || [];
    
    // 許可された環境変数のみコピー
    for (const envVar of allowedEnvVars) {
      if (process.env[envVar] && !blockedEnvVars.includes(envVar)) {
        safeEnv[envVar] = process.env[envVar];
      }
    }

    // タイムアウト設定（設定ファイルから取得）
    const defaultTimeout = config.security.commandExecution.defaultTimeout || 30000;
    const maxTimeout = config.security.commandExecution.maxTimeout || 600000;
    const timeout = Math.min(options.timeout || defaultTimeout, maxTimeout);

    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        ...options,
        env: { ...safeEnv, ...options.env }, // 安全な環境変数をベースに
        shell: false, // 絶対にシェルを使用しない
        windowsHide: true // Windowsでコンソールウィンドウを隠す
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      // タイムアウト処理
      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 5000);
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });

      child.on('close', async (code) => {
        clearTimeout(timer);
        if (killed) return; // タイムアウトで既に処理済み
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // コマンド実行をログに記録
        await this.auditLogger.logCommandExecution({
          cmd: cmd,
          args: args,
          result: code === 0 ? 'success' : 'failed',
          exitCode: code,
          duration: duration,
          timeout: timeout
        });
        
        if (code !== 0) {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        } else {
          resolve({ stdout, stderr });
        }
      });
      
      const startTime = Date.now();
    });
  }

  async validateSyntax(filePath, content) {
    try {
      const ext = path.extname(filePath);
      
      if (ext === '.js' || ext === '.ts') {
        // JavaScript/TypeScript構文チェック
        // Temporary file for syntax check - 安全なパスを使用
        const tempDir = path.join(process.cwd(), 'temp');
        await fs.mkdir(tempDir, { recursive: true });
        const tempFile = path.join(tempDir, `syntax-check-${Date.now()}.tmp`);
        
        await fs.writeFile(tempFile, content, 'utf8');

        try {
          if (ext === '.js') {
            // オブジェクト形式でより安全に実行
            await this.safeSpawn({ 
              cmd: 'node',
              args: ['--check', tempFile],
              timeout: 10000 // 10秒のタイムアウト
            });
          } else if (ext === '.ts') {
            await this.safeSpawn({
              cmd: 'npx',
              args: ['tsc', '--noEmit', tempFile],
              timeout: 20000 // TypeScriptは時間がかかる場合がある
            });
          }
          
          await fs.unlink(tempFile);
          return true;
        } catch (error) {
          await fs.unlink(tempFile).catch(() => {}); // エラーを無視
          console.log(`Syntax validation failed: ${error.message}`);
          return false;
        }
      }

      // その他の言語は基本的な検証のみ
      return content.trim().length > 0;
      
    } catch (error) {
      console.error('Syntax validation error:', error);
      return false;
    }
  }

  generateDiff(original, fixed) {
    const diff = diffLines(original, fixed);
    return diff.map(part => ({
      added: part.added || false,
      removed: part.removed || false,
      value: part.value
    }));
  }

  async saveFixResult(bug, fixResult) {
    try {
      const response = await fetch('http://localhost:8000/api/memory/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'auto-fixer',
          content: `Auto-fix applied for ${bug.type}: ${fixResult.appliedFixes.length} fixes applied`,
          metadata: {
            type: 'auto_fix_result',
            bug: bug,
            fixResult: fixResult
          }
        })
      });

      if (response.ok) {
        console.log(`📊 Fix result saved for bug ${bug.id}`);
      }
    } catch (error) {
      console.error('Failed to save fix result:', error);
    }
  }

  async batchFixBugs(bugs, filePath) {
    console.log(`🔧 Starting batch fix for ${bugs.length} bugs in ${filePath}`);
    
    try {
      const originalContent = await fs.readFile(filePath, 'utf8');
      const results = [];

      // 重要度順にソート（critical -> high -> medium -> low）
      const sortedBugs = bugs.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

      for (const bug of sortedBugs) {
        const currentContent = await fs.readFile(filePath, 'utf8');
        const fixResult = await this.autoFixBug(bug, filePath, currentContent);
        results.push(fixResult);

        // 修正が失敗した場合は次へ
        if (!fixResult || !fixResult.success) {
          continue;
        }

        // 各修正後にテストを実行（オプション）
        if (await this.shouldRunTests(fixResult)) {
          const testResult = await this.runTests(filePath);
          if (!testResult.passed) {
            console.log(`⚠️  Tests failed after fixing ${bug.type}, reverting...`);
            await this.revertFix(fixResult);
          }
        }
      }

      return {
        totalBugs: bugs.length,
        fixedBugs: results.filter(r => r && r.success).length,
        results: results
      };

    } catch (error) {
      console.error('Batch fix error:', error);
      return {
        totalBugs: bugs.length,
        fixedBugs: 0,
        error: error.message
      };
    }
  }

  async shouldRunTests(fixResult) {
    // 重要な修正の場合はテストを実行
    const criticalFixes = ['sql_injection', 'xss_vulnerability', 'memory_leak'];
    return criticalFixes.some(fix => fixResult.bugId?.includes(fix));
  }

  async runTests(filePath) {
    try {
      // プロジェクトディレクトリでテスト実行
      const projectDir = path.dirname(filePath);
      const result = await this.safeSpawn('npm test', { cwd: projectDir });
      
      return { passed: true, output: result.stdout };
    } catch (error) {
      return { passed: false, output: error.message };
    }
  }

  async revertFix(fixResult) {
    if (fixResult.backupPath && fixResult.filePath) {
      try {
        const backupContent = await fs.readFile(fixResult.backupPath, 'utf8');
        await fs.writeFile(fixResult.filePath, backupContent, 'utf8');
        console.log(`↩️  Reverted fix for ${fixResult.bugId}`);
        return true;
      } catch (error) {
        console.error('Revert failed:', error);
        return false;
      }
    }
    return false;
  }

  getFixStatistics() {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(h => h.success).length;
    
    return {
      totalFixes: total,
      successfulFixes: successful,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      fixesByType: this.getFixesByType(),
      averageConfidence: this.getAverageConfidence()
    };
  }

  getFixesByType() {
    const byType = {};
    this.executionHistory.forEach(fix => {
      byType[fix.fixType] = (byType[fix.fixType] || 0) + 1;
    });
    return byType;
  }

  getAverageConfidence() {
    if (this.executionHistory.length === 0) return 0;
    
    const totalConfidence = this.executionHistory.reduce((sum, fix) => sum + fix.confidence, 0);
    return Math.round((totalConfidence / this.executionHistory.length) * 100) / 100;
  }

  /**
   * セキュリティ警告を追加
   */
  addSecurityWarning(warning) {
    this.securityWarnings.push({
      ...warning,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * セキュリティ警告を取得
   */
  getSecurityWarnings() {
    return this.securityWarnings;
  }

  /**
   * 設定の検証
   */
  validateConfig(config) {
    const errors = [];
    const warnings = [];

    // セキュリティ設定の検証
    if (!config.security) {
      errors.push('セキュリティ設定が見つかりません');
    } else {
      // 許可されたコマンドリストの検証
      if (!Array.isArray(config.security.allowedCommands) || config.security.allowedCommands.length === 0) {
        errors.push('許可されたコマンドリストが空です');
      }

      // 環境変数設定の検証
      if (!config.security.environmentVariables) {
        warnings.push('環境変数設定が見つかりません');
      } else {
        if (!Array.isArray(config.security.environmentVariables.allowed)) {
          warnings.push('許可された環境変数リストが不正です');
        }
        if (!Array.isArray(config.security.environmentVariables.blocked)) {
          warnings.push('ブロックされた環境変数リストが不正です');
        }
      }

      // タイムアウト設定の検証
      if (config.security.commandExecution) {
        const { defaultTimeout, maxTimeout } = config.security.commandExecution;
        if (defaultTimeout && maxTimeout && defaultTimeout > maxTimeout) {
          errors.push('デフォルトタイムアウトが最大タイムアウトを超えています');
        }
      }
    }

    // 自動修正設定の検証
    if (!config.autoFix) {
      warnings.push('自動修正設定が見つかりません');
    } else {
      if (typeof config.autoFix.maxAutoFixesPerRun !== 'number' || config.autoFix.maxAutoFixesPerRun < 1) {
        warnings.push('maxAutoFixesPerRunは1以上の数値である必要があります');
      }
    }

    // ロギング設定の検証
    if (!config.logging) {
      warnings.push('ロギング設定が見つかりません');
    } else {
      // ログディレクトリの検証
      if (!config.logging.logDirectory) {
        warnings.push('ログディレクトリが指定されていません');
      }

      // ログレベルの検証
      const validLogLevels = ['debug', 'info', 'warn', 'error'];
      if (config.logging.level && !validLogLevels.includes(config.logging.level)) {
        warnings.push(`無効なログレベル: ${config.logging.level}`);
      }
    }

    // ロールバック設定の検証
    if (config.rollback && config.rollback.enabled) {
      if (typeof config.rollback.maxBackupFiles !== 'number' || config.rollback.maxBackupFiles < 1) {
        warnings.push('maxBackupFilesは1以上の数値である必要があります');
      }
      if (typeof config.rollback.backupRetentionDays !== 'number' || config.rollback.backupRetentionDays < 1) {
        warnings.push('backupRetentionDaysは1以上の数値である必要があります');
      }
    }

    // エラーがある場合は例外をスロー
    if (errors.length > 0) {
      console.error('設定エラー:', errors);
      throw new Error(`設定に重大なエラーがあります: ${errors.join(', ')}`);
    }

    // 警告を表示
    if (warnings.length > 0) {
      console.warn('設定警告:', warnings);
    }

    console.log('設定検証完了: 問題ありません');
  }
}

module.exports = AutoFixer;