/**
 * Conea自律AIエージェント - 自動バグ検知システム Phase 2
 * リアルタイムバグ検知と分類
 */

const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');

class BugDetector {
  constructor() {
    this.bugPatterns = new Map();
    this.errorHistory = [];
    this.watchedFiles = new Set();
    this.initializeBugPatterns();
  }

  initializeBugPatterns() {
    // JavaScript/Node.js バグパターン
    this.bugPatterns.set('memory_leak', {
      patterns: [
        /setInterval\s*\([^)]*\)(?!.*clearInterval)/g,
        /setTimeout\s*\([^)]*\)(?!.*clearTimeout)/g,
        /addEventListener\s*\([^)]*\)(?!.*removeEventListener)/g
      ],
      severity: 'high',
      description: 'Memory leak potential detected'
    });

    this.bugPatterns.set('sql_injection', {
      patterns: [
        /\$\{[^}]*\}.*?(SELECT|INSERT|UPDATE|DELETE)/gi,
        /['"`]\s*\+\s*[^+]*\s*\+\s*['"`].*?(SELECT|INSERT|UPDATE|DELETE)/gi
      ],
      severity: 'critical',
      description: 'SQL injection vulnerability'
    });

    this.bugPatterns.set('xss_vulnerability', {
      patterns: [
        /(innerHTML|outerHTML)\s*=\s*[^;]*\$\{/g,
        /document\.write\s*\([^)]*\$\{/g,
        /<script[^>]*>[^<]*\$\{[^}]*\}/g
      ],
      severity: 'high',
      description: 'XSS vulnerability detected'
    });

    this.bugPatterns.set('resource_leak', {
      patterns: [
        /fs\.createReadStream\s*\([^)]*\)(?!.*\.close\(\))/g,
        /new\s+WebSocket\s*\([^)]*\)(?!.*\.close\(\))/g,
        /\.connect\s*\([^)]*\)(?!.*\.disconnect\(\))/g
      ],
      severity: 'medium',
      description: 'Resource leak potential'
    });

    this.bugPatterns.set('async_error', {
      patterns: [
        /await\s+[^;]*(?!.*catch)/g,
        /Promise\s*\([^)]*\)(?!.*\.catch)/g,
        /async\s+function[^{]*\{[^}]*\}(?!.*catch)/g
      ],
      severity: 'medium',
      description: 'Unhandled async error potential'
    });

    this.bugPatterns.set('type_error', {
      patterns: [
        /\.[a-zA-Z]+\s*\(\s*\)(?!.*typeof)/g,
        /\[[^\]]*\]\.length(?!.*Array\.isArray)/g,
        /JSON\.parse\s*\([^)]*\)(?!.*try)/g
      ],
      severity: 'medium',
      description: 'Type error potential'
    });
  }

  async startRealTimeMonitoring(projectPath) {
    console.log('🔍 Starting real-time bug detection...');
    
    const watcher = chokidar.watch(projectPath, {
      ignored: [
        '**/node_modules/**',
        '**/\.git/**',
        '**/*.log',
        '**/dist/**',
        '**/build/**'
      ],
      persistent: true
    });

    watcher.on('change', async (filePath) => {
      if (this.isCodeFile(filePath)) {
        await this.scanFile(filePath);
      }
    });

    watcher.on('add', async (filePath) => {
      if (this.isCodeFile(filePath)) {
        this.watchedFiles.add(filePath);
        await this.scanFile(filePath);
      }
    });

    return watcher;
  }

  isCodeFile(filePath) {
    const ext = path.extname(filePath);
    return ['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.php'].includes(ext);
  }

  async scanFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const bugs = await this.detectBugs(content, filePath);
      
      if (bugs.length > 0) {
        console.log(`🐛 Found ${bugs.length} potential bugs in ${filePath}`);
        await this.reportBugs(bugs, filePath);
        
        // 自動修正の提案
        for (const bug of bugs) {
          if (bug.severity === 'critical' || bug.severity === 'high') {
            await this.suggestFix(bug, filePath, content);
          }
        }
      }

      return bugs;
    } catch (error) {
      console.error(`Error scanning file ${filePath}:`, error);
      return [];
    }
  }

  async detectBugs(content, filePath) {
    const detectedBugs = [];

    for (const [bugType, config] of this.bugPatterns) {
      for (const pattern of config.patterns) {
        const matches = content.matchAll(pattern);
        
        for (const match of matches) {
          const lineNumber = this.getLineNumber(content, match.index);
          const bug = {
            id: this.generateBugId(),
            type: bugType,
            severity: config.severity,
            description: config.description,
            file: filePath,
            line: lineNumber,
            code: match[0],
            pattern: pattern.source,
            timestamp: new Date().toISOString()
          };

          detectedBugs.push(bug);
        }
      }
    }

    // コンテキスト分析による偽陽性の除去
    return this.filterFalsePositives(detectedBugs, content);
  }

  filterFalsePositives(bugs, content) {
    return bugs.filter(bug => {
      // 例: コメント内のパターンは除外
      const lines = content.split('\n');
      const bugLine = lines[bug.line - 1];
      
      if (bugLine && bugLine.trim().startsWith('//')) {
        return false;
      }

      // 例: try-catch内のawaitは除外
      if (bug.type === 'async_error') {
        const beforeCode = content.substring(0, content.indexOf(bug.code));
        const afterCode = content.substring(content.indexOf(bug.code));
        
        if (beforeCode.includes('try') && afterCode.includes('catch')) {
          return false;
        }
      }

      return true;
    });
  }

  async suggestFix(bug, filePath, content) {
    const fixSuggestion = await this.generateFixSuggestion(bug, content);
    
    console.log(`💡 Fix suggestion for ${bug.type} in ${filePath}:${bug.line}`);
    console.log(`   ${fixSuggestion.description}`);
    console.log(`   Suggested fix: ${fixSuggestion.code}`);

    // OpenMemoryに修正提案を保存
    await this.saveFixSuggestion(bug, fixSuggestion);

    return fixSuggestion;
  }

  async generateFixSuggestion(bug, content) {
    const fixTemplates = {
      memory_leak: {
        description: 'Add cleanup for timer/listener',
        code: 'clearInterval(intervalId) or removeEventListener(...)'
      },
      sql_injection: {
        description: 'Use parameterized queries',
        code: 'Use prepared statements with placeholders'
      },
      xss_vulnerability: {
        description: 'Sanitize user input',
        code: 'Use textContent instead of innerHTML, or sanitize input'
      },
      resource_leak: {
        description: 'Add resource cleanup',
        code: 'Add .close() or .disconnect() in finally block'
      },
      async_error: {
        description: 'Add error handling',
        code: 'Wrap in try-catch or add .catch() handler'
      },
      type_error: {
        description: 'Add type checking',
        code: 'Add typeof or Array.isArray() checks'
      }
    };

    const template = fixTemplates[bug.type] || {
      description: 'Review and fix manually',
      code: 'Manual review required'
    };

    // より具体的な修正提案をAIで生成
    const specificFix = await this.generateAIFix(bug, content);
    
    return {
      ...template,
      specificFix: specificFix,
      confidence: this.calculateFixConfidence(bug)
    };
  }

  async generateAIFix(bug, content) {
    try {
      const prompt = `
Fix this ${bug.type} issue:

File content around line ${bug.line}:
${this.getContextLines(content, bug.line, 5)}

Problematic code: ${bug.code}

Generate a specific fix for this issue. Provide only the corrected code.
      `;

      // 自律エージェントのLLMサービスを使用
      const response = await fetch('http://localhost:8000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'claude',
          prompt: prompt,
          user_id: 'bug-detector'
        })
      });

      if (response.ok) {
        const result = await response.json();
        return result.content || 'AI fix generation failed';
      }
    } catch (error) {
      console.error('AI fix generation error:', error);
    }
    
    return 'Manual review required';
  }

  getContextLines(content, lineNumber, contextSize) {
    const lines = content.split('\n');
    const start = Math.max(0, lineNumber - contextSize - 1);
    const end = Math.min(lines.length, lineNumber + contextSize);
    
    return lines.slice(start, end)
      .map((line, index) => `${start + index + 1}: ${line}`)
      .join('\n');
  }

  async reportBugs(bugs, filePath) {
    // バグレポートをOpenMemoryに保存
    const report = {
      file: filePath,
      bugs: bugs,
      timestamp: new Date().toISOString(),
      totalBugs: bugs.length,
      criticalBugs: bugs.filter(b => b.severity === 'critical').length,
      highBugs: bugs.filter(b => b.severity === 'high').length
    };

    try {
      const response = await fetch('http://localhost:8000/api/memory/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'bug-detector',
          content: `Bug report: ${bugs.length} issues found in ${filePath}`,
          metadata: {
            type: 'bug_report',
            ...report
          }
        })
      });

      if (response.ok) {
        console.log(`📊 Bug report saved for ${filePath}`);
      }
    } catch (error) {
      console.error('Failed to save bug report:', error);
    }

    return report;
  }

  async saveFixSuggestion(bug, fixSuggestion) {
    try {
      const response = await fetch('http://localhost:8000/api/memory/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'bug-detector',
          content: `Fix suggestion for ${bug.type}: ${fixSuggestion.description}`,
          metadata: {
            type: 'fix_suggestion',
            bug: bug,
            suggestion: fixSuggestion
          }
        })
      });

      if (response.ok) {
        console.log(`💾 Fix suggestion saved for bug ${bug.id}`);
      }
    } catch (error) {
      console.error('Failed to save fix suggestion:', error);
    }
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  generateBugId() {
    return `bug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  calculateFixConfidence(bug) {
    const confidenceMap = {
      critical: 0.9,
      high: 0.8,
      medium: 0.6,
      low: 0.4
    };
    return confidenceMap[bug.severity] || 0.5;
  }

  async getBugStatistics() {
    return {
      totalScannedFiles: this.watchedFiles.size,
      totalBugsDetected: this.errorHistory.length,
      bugsByType: this.getBugsByType(),
      bugsBySeverity: this.getBugsBySeverity(),
      averageBugsPerFile: this.errorHistory.length / Math.max(1, this.watchedFiles.size)
    };
  }

  getBugsByType() {
    const byType = {};
    this.errorHistory.forEach(bug => {
      byType[bug.type] = (byType[bug.type] || 0) + 1;
    });
    return byType;
  }

  getBugsBySeverity() {
    const bySeverity = {};
    this.errorHistory.forEach(bug => {
      bySeverity[bug.severity] = (bySeverity[bug.severity] || 0) + 1;
    });
    return bySeverity;
  }
}

module.exports = BugDetector;