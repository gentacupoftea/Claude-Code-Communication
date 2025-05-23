/**
 * Conea自律AIエージェント - 自動修正エンジン Phase 2
 * 検出されたバグの自動修正実行
 */

const fs = require('fs').promises;
const path = require('path');
const { diffLines } = require('diff');

class AutoFixer {
  constructor() {
    this.fixStrategies = new Map();
    this.executionHistory = [];
    this.initializeFixStrategies();
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
      confidence: 0.1,
      autoApply: false,
      requiresSecurityReview: true,
      fixes: [
        {
          pattern: /(createHash\s*\(\s*['"`](?:md5|sha1)['"`])/g,
          replacement: (match) => {
            return `// SECURITY ALERT: Weak cryptographic algorithm detected\n// TODO: URGENT - Use SHA-256 or stronger: crypto.createHash('sha256')\n${match}`;
          }
        }
      ]
    });

    // パストラバーサル脆弱性修正戦略
    this.fixStrategies.set('path_traversal', {
      strategy: 'path_security_validation',
      confidence: 0.1,
      autoApply: false,
      requiresSecurityReview: true,
      fixes: [
        {
          pattern: /((?:fs\.readFile|fs\.writeFile)\s*\([^)]*\$\{[^}]*\})/g,
          replacement: (match) => {
            return `// SECURITY ALERT: Path traversal vulnerability detected\n// TODO: URGENT - Validate and sanitize file paths, use path.resolve() and check bounds\n${match}`;
          }
        }
      ]
    });

    // コマンドインジェクション修正戦略
    this.fixStrategies.set('command_injection', {
      strategy: 'command_security_validation',
      confidence: 0.1,
      autoApply: false,
      requiresSecurityReview: true,
      fixes: [
        {
          pattern: /((?:exec|spawn)\s*\([^)]*\$\{[^}]*\})/g,
          replacement: (match) => {
            return `// SECURITY ALERT: Command injection vulnerability detected\n// TODO: URGENT - Use spawn with array arguments, validate all inputs\n${match}`;
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

    // 自動適用の確認
    if (!strategy.autoApply) {
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
      
      for (const match of matches) {
        // バグの場所と一致するかチェック
        if (this.isMatchingBugLocation(bug, match, originalContent)) {
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

    // バックアップファイルを作成
    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fs.writeFile(backupPath, originalContent, 'utf8');

    // 修正されたコンテンツを適用
    await fs.writeFile(filePath, fixedContent, 'utf8');

    // 構文チェック
    const syntaxValid = await this.validateSyntax(filePath, fixedContent);
    if (!syntaxValid) {
      // 構文エラーがある場合はロールバック
      await fs.writeFile(filePath, originalContent, 'utf8');
      return {
        success: false,
        error: 'Syntax validation failed - changes rolled back',
        bugId: bug.id
      };
    }

    return {
      success: true,
      bugId: bug.id,
      filePath: filePath,
      backupPath: backupPath,
      appliedFixes: appliedFixes,
      diff: this.generateDiff(originalContent, fixedContent),
      confidence: strategy.confidence
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

  async validateSyntax(filePath, content) {
    try {
      const ext = path.extname(filePath);
      
      if (ext === '.js' || ext === '.ts') {
        // JavaScript/TypeScript構文チェック
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        // Temporary file for syntax check
        const tempFile = `${filePath}.syntax-check.tmp`;
        await fs.writeFile(tempFile, content, 'utf8');

        try {
          if (ext === '.js') {
            await execAsync(`node --check ${tempFile}`);
          } else if (ext === '.ts') {
            await execAsync(`npx tsc --noEmit ${tempFile}`);
          }
          
          await fs.unlink(tempFile);
          return true;
        } catch (error) {
          await fs.unlink(tempFile);
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
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // プロジェクトディレクトリでテスト実行
      const projectDir = path.dirname(filePath);
      const result = await execAsync('npm test', { cwd: projectDir });
      
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
}

module.exports = AutoFixer;