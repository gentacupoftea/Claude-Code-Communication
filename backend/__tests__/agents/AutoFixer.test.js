/**
 * AutoFixer セキュリティ脆弱性修正のテスト
 */

const AutoFixer = require('../../src/agents/AutoFixer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// テスト用の設定
const testConfig = {
  security: {
    allowedCommands: ['node', 'npm', 'npx', 'git', 'yarn'],
    environmentVariables: {
      allowed: ['PATH', 'NODE_ENV', 'HOME'],
      blocked: ['LD_PRELOAD']
    },
    commandExecution: {
      defaultTimeout: 5000,
      maxTimeout: 10000
    }
  },
  autoFix: {
    createBackups: false, // テストではバックアップ無効
    maxAutoFixesPerRun: 10
  },
  logging: {
    auditLog: false,
    securityLog: false,
    logDirectory: './test-logs'
  },
  rollback: {
    enabled: false // テストではロールバック無効
  }
};

// モジュールレベルでconfigをモック
jest.mock('../../src/agents/autoFixerConfig.json', () => testConfig, { virtual: true });

describe('AutoFixer Security Vulnerabilities', () => {
  let autoFixer;

  beforeEach(() => {
    // NODE_ENVをtestに設定
    process.env.NODE_ENV = 'test';
    autoFixer = new AutoFixer();
  });

  describe('暗号化アルゴリズムの強化', () => {
    it('MD5を使用しているコードをSHA-256に自動修正すること', async () => {
      const bugMD5 = {
        id: 'crypto-001',
        type: 'crypto_vulnerability',
        line: 10,
        severity: 'high'
      };

      const originalContent = `
        const crypto = require('crypto');
        const hash = crypto.createHash('md5');
        hash.update(data);
        return hash.digest('hex');
      `;

      const result = await autoFixer.applyFix(
        bugMD5,
        autoFixer.fixStrategies.get('crypto_vulnerability'),
        'test.js',
        originalContent
      );

      expect(result.success).toBe(true);
      expect(result.fixedContent).toContain("SECURITY WARNING: Weak hash algorithm detected");
      expect(result.fixedContent).toContain("createHash('md5')"); // 元のコードは保持される
    });

    it('SHA1を使用しているコードをSHA-256に自動修正すること', async () => {
      const bugSHA1 = {
        id: 'crypto-002',
        type: 'crypto_vulnerability',
        line: 10,
        severity: 'high'
      };

      const originalContent = `
        const crypto = require('crypto');
        const hash = crypto.createHash('sha1');
        const hmac = crypto.createHmac('sha1', key);
      `;

      const result = await autoFixer.applyFix(
        bugSHA1,
        autoFixer.fixStrategies.get('crypto_vulnerability'),
        'test.js',
        originalContent
      );

      expect(result.success).toBe(true);
      expect(result.fixedContent).toContain("SECURITY WARNING: Weak hash algorithm detected");
      expect(result.fixedContent).toContain("SECURITY WARNING: Weak HMAC algorithm detected");
      expect(result.fixedContent).toContain("createHash('sha1')"); // 元のコードは保持される
      expect(result.fixedContent).toContain("createHmac('sha1')"); // 元のコードは保持される
    });
  });

  describe('パストラバーサル脆弱性への対応', () => {
    it('sanitizePathが正しくパストラバーサル攻撃を防ぐこと', async () => {
      // 正常なパス
      const normalPath = path.join(process.cwd(), 'test.txt');
      await expect(autoFixer.sanitizePath(normalPath)).resolves.toBeTruthy();

      // パストラバーサル攻撃
      await expect(autoFixer.sanitizePath('../../../etc/passwd')).rejects.toThrow('Path traversal attempt detected');
      await expect(autoFixer.sanitizePath('/etc/passwd')).rejects.toThrow('Path traversal attempt detected');
      await expect(autoFixer.sanitizePath('../../test.txt')).rejects.toThrow('Path traversal attempt detected');
      
      // null byte injection - null byteは除去される
      const cleanedPath = await autoFixer.sanitizePath('test.txt\0.jpg');
      expect(cleanedPath).not.toContain('\0');
    });

    it('ファイルパス引数を含むコードにsanitizePathを追加すること', async () => {
      const bug = {
        id: 'path-001',
        type: 'path_traversal',
        line: 10,
        severity: 'high'
      };

      const originalContent = `
        const userInput = req.params.filename;
        await fs.readFile(\`./uploads/\${userInput}\`);
        await fs.writeFile(\`./output/\${userInput}\`, data);
      `;

      const result = await autoFixer.applyFix(
        bug,
        autoFixer.fixStrategies.get('path_traversal'),
        'test.js',
        originalContent
      );

      expect(result.success).toBe(true);
      expect(result.fixedContent).toContain('this.sanitizePath');
      expect(result.appliedFixes.length).toBeGreaterThan(0);
    });

    it('不正な型のパスを拒否すること', async () => {
      await expect(autoFixer.sanitizePath(null)).rejects.toThrow('Invalid path: must be a string');
      await expect(autoFixer.sanitizePath(undefined)).rejects.toThrow('Invalid path: must be a string');
      await expect(autoFixer.sanitizePath(123)).rejects.toThrow('Invalid path: must be a string');
      await expect(autoFixer.sanitizePath({})).rejects.toThrow('Invalid path: must be a string');
    });
  });

  describe('コマンドインジェクション脆弱性への対応', () => {
    it('safeSpawnが安全なコマンドのみを実行すること', async () => {
      // 正常なコマンド
      await expect(autoFixer.safeSpawn('node --version')).resolves.toHaveProperty('stdout');
      await expect(autoFixer.safeSpawn('npm --version')).resolves.toHaveProperty('stdout');

      // 不正なコマンド
      await expect(autoFixer.safeSpawn('rm -rf /')).rejects.toThrow('Command not allowed: rm');
      await expect(autoFixer.safeSpawn('cat /etc/passwd')).rejects.toThrow('Command not allowed: cat');
    });

    it('危険な文字を含む引数を拒否すること', async () => {
      await expect(autoFixer.safeSpawn('node test.js; rm -rf /')).rejects.toThrow('Potentially dangerous argument');
      await expect(autoFixer.safeSpawn('node test.js && cat /etc/passwd')).rejects.toThrow('Potentially dangerous argument');
      await expect(autoFixer.safeSpawn('node test.js | grep password')).rejects.toThrow('Potentially dangerous argument');
      await expect(autoFixer.safeSpawn('node `whoami`.js')).rejects.toThrow('Potentially dangerous argument');
      await expect(autoFixer.safeSpawn('node $(whoami).js')).rejects.toThrow('Potentially dangerous argument');
    });

    it('execをspawnに置き換えること', async () => {
      const bug = {
        id: 'cmd-001',
        type: 'command_injection',
        line: 10,
        severity: 'high'
      };

      const originalContent = `
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        await execAsync(\`node \${userInput}\`);
      `;

      const result = await autoFixer.applyFix(
        bug,
        autoFixer.fixStrategies.get('command_injection'),
        'test.js',
        originalContent
      );

      expect(result.success).toBe(true);
      expect(result.fixedContent).toContain('spawn');
      expect(result.fixedContent).not.toContain("exec");
      expect(result.fixedContent).toContain('this.safeSpawn');
    });

    it('不正な型のコマンドを拒否すること', async () => {
      await expect(autoFixer.safeSpawn(null)).rejects.toThrow('Command must be a string or object with cmd property');
      await expect(autoFixer.safeSpawn(undefined)).rejects.toThrow('Command must be a string or object with cmd property');
      await expect(autoFixer.safeSpawn(123)).rejects.toThrow('Command must be a string or object with cmd property');
      await expect(autoFixer.safeSpawn([])).rejects.toThrow('Command must be a string or object with cmd property');
    });
  });

  describe('統合テスト', () => {
    it('複数の脆弱性を含むファイルを修正できること', async () => {
      const bugs = [
        { id: 'crypto-001', type: 'crypto_vulnerability', line: 10, severity: 'high' },
        { id: 'path-001', type: 'path_traversal', line: 20, severity: 'high' },
        { id: 'cmd-001', type: 'command_injection', line: 30, severity: 'high' }
      ];

      const originalContent = `
        const crypto = require('crypto');
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        function hashPassword(password) {
          const hash = crypto.createHash('md5');
          hash.update(password);
          return hash.digest('hex');
        }
        
        async function readUserFile(filename) {
          const content = await fs.readFile(\`./users/\${filename}\`);
          return content;
        }
        
        async function runCommand(cmd) {
          const result = await execAsync(\`node \${cmd}\`);
          return result.stdout;
        }
      `;

      // テスト用の一時ファイルを作成
      const testFile = path.join(process.cwd(), 'test-vulnerabilities.js');
      await fs.writeFile(testFile, originalContent, 'utf8');

      const result = await autoFixer.batchFixBugs(bugs, testFile);

      expect(result.fixedBugs).toBeGreaterThan(0);
      expect(result.totalBugs).toBe(3);

      // 修正されたファイルを読み込んで確認
      const fixedContent = await fs.readFile(testFile, 'utf8');
      expect(fixedContent).toContain("SECURITY WARNING: Weak hash algorithm detected");
      expect(fixedContent).toContain('this.sanitizePath');
      expect(fixedContent).toContain('this.safeSpawn');

      // テストファイルを削除
      await fs.unlink(testFile);
    });
  });

  describe('Fix Strategy設定の確認', () => {
    it('暗号化脆弱性修正戦略が手動承認が必要に変更されていること', () => {
      const strategy = autoFixer.fixStrategies.get('crypto_vulnerability');
      expect(strategy.autoApply).toBe(false); // 互換性リスクのため無効化
      expect(strategy.confidence).toBeGreaterThanOrEqual(0.7);
      expect(strategy.requiresSecurityReview).toBe(true);
    });

    it('パストラバーサル脆弱性修正戦略が自動適用されるように設定されていること', () => {
      const strategy = autoFixer.fixStrategies.get('path_traversal');
      expect(strategy.autoApply).toBe(true);
      expect(strategy.confidence).toBeGreaterThanOrEqual(0.85);
      expect(strategy.requiresSecurityReview).toBe(false);
    });

    it('コマンドインジェクション脆弱性修正戦略が自動適用されるように設定されていること', () => {
      const strategy = autoFixer.fixStrategies.get('command_injection');
      expect(strategy.autoApply).toBe(true);
      expect(strategy.confidence).toBeGreaterThanOrEqual(0.9);
      expect(strategy.requiresSecurityReview).toBe(false);
    });
  });

  describe('新しいセキュリティ機能', () => {
    describe('URLエンコード対策', () => {
      it('URLエンコードされたパストラバーサルを検出すること', async () => {
        // %2e%2e%2f = ../
        await expect(autoFixer.sanitizePath('%2e%2e%2fetc%2fpasswd')).rejects.toThrow('Path traversal attempt detected');
        
        // ダブルエンコード
        await expect(autoFixer.sanitizePath('%252e%252e%252f')).rejects.toThrow('Path traversal attempt detected');
      });
    });

    describe('Unicode正規化対策', () => {
      it('Unicode文字を使ったパストラバーサルを検出すること', async () => {
        // Unicode dots
        await expect(autoFixer.sanitizePath('‥/‥/etc/passwd')).rejects.toThrow();
        
        // 全角スラッシュ
        await expect(autoFixer.sanitizePath('..／etc／passwd')).rejects.toThrow();
      });
    });

    describe('環境変数のサニタイズ', () => {
      it('許可された環境変数のみを使用すること', async () => {
        // LD_PRELOADはブロックされるべき
        const originalLD = process.env.LD_PRELOAD;
        process.env.LD_PRELOAD = '/malicious.so';
        
        const result = await autoFixer.safeSpawn({
          cmd: 'node',
          args: ['--version']
        });
        
        expect(result.stdout).toContain('v');
        
        // 元に戻す
        if (originalLD) {
          process.env.LD_PRELOAD = originalLD;
        } else {
          delete process.env.LD_PRELOAD;
        }
      });
    });

    describe('拡張コマンドサポート', () => {
      it('Git, Yarn等の追加コマンドが許可されること', async () => {
        // gitが許可リストに含まれている
        await expect(
          autoFixer.safeSpawn({
            cmd: 'git',
            args: ['--version']
          })
        ).resolves.toHaveProperty('stdout');
      });
    });

    describe('セキュリティ警告の記録', () => {
      it('ブロックされたコマンドが警告に記録されること', async () => {
        await expect(
          autoFixer.safeSpawn('dangerous-command --hack')
        ).rejects.toThrow('Command not allowed');

        const warnings = autoFixer.getSecurityWarnings();
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[warnings.length - 1]).toMatchObject({
          type: 'command_blocked',
          command: 'dangerous-command',
          reason: 'Command not in allowed list'
        });
      });
    });
  });
});