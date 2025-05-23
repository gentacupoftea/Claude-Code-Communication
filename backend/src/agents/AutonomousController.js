/**
 * Conea自律AIエージェント - 統合コントローラー
 * 意図理解 → コード生成 → PR作成までの自律実行
 */

const IntentAnalyzer = require('./IntentAnalyzer');
const CodeGenerator = require('./CodeGenerator');
const AutonomousPR = require('./AutonomousPR');

class AutonomousController {
  constructor(config) {
    this.config = config;
    this.intentAnalyzer = new IntentAnalyzer();
    this.codeGenerator = new CodeGenerator(config.llmService, config.fileAnalyzer);
    this.autonomousPR = new AutonomousPR(
      config.githubToken,
      config.repoOwner,
      config.repoName
    );
    
    this.executionHistory = [];
    this.isExecuting = false;
  }

  async processRequest(message, options = {}) {
    const executionId = this.generateExecutionId();
    
    try {
      console.log(`🤖 自律処理開始: ${executionId}`);
      console.log(`📝 要求: ${message}`);

      if (this.isExecuting && !options.force) {
        throw new Error('Another autonomous process is running. Use force:true to override.');
      }

      this.isExecuting = true;
      const startTime = Date.now();

      // 実行記録開始
      const execution = {
        id: executionId,
        message: message,
        startTime: startTime,
        steps: [],
        status: 'running'
      };
      this.executionHistory.push(execution);

      // Step 1: 意図理解
      console.log('🧠 Step 1: 意図理解...');
      const intent = await this.intentAnalyzer.analyzeIntent(message);
      execution.steps.push({
        step: 'intent_analysis',
        result: intent,
        timestamp: Date.now()
      });
      
      if (intent.confidence < 0.3) {
        throw new Error(`意図理解の信頼度が低すぎます (${intent.confidence}). より具体的な要求をしてください。`);
      }

      // Step 2: 実行可能性チェック
      console.log('🔍 Step 2: 実行可能性チェック...');
      const feasibilityCheck = await this.checkFeasibility(intent);
      execution.steps.push({
        step: 'feasibility_check',
        result: feasibilityCheck,
        timestamp: Date.now()
      });

      if (!feasibilityCheck.canExecute) {
        throw new Error(`実行不可: ${feasibilityCheck.reason}`);
      }

      // Step 3: ユーザー承認（高リスクの場合）
      if (feasibilityCheck.requiresApproval && !options.skipApproval) {
        console.log('⚠️  Step 3: ユーザー承認が必要です');
        const approval = await this.requestApproval(intent, feasibilityCheck);
        execution.steps.push({
          step: 'user_approval',
          result: approval,
          timestamp: Date.now()
        });

        if (!approval.approved) {
          execution.status = 'cancelled';
          return this.buildResult(execution, 'cancelled', 'User did not approve execution');
        }
      }

      // Step 4: コード生成
      console.log('⚡ Step 4: コード生成...');
      const generationResult = await this.codeGenerator.generateImplementation(intent);
      execution.steps.push({
        step: 'code_generation',
        result: {
          filesGenerated: generationResult.code.size,
          testsGenerated: generationResult.tests.size
        },
        timestamp: Date.now()
      });

      // Step 5: 品質チェック
      console.log('🔎 Step 5: 品質チェック...');
      const qualityCheck = await this.performQualityCheck(generationResult);
      execution.steps.push({
        step: 'quality_check',
        result: qualityCheck,
        timestamp: Date.now()
      });

      if (!qualityCheck.passed && !options.skipQualityCheck) {
        throw new Error(`品質チェック失敗: ${qualityCheck.issues.join(', ')}`);
      }

      // Step 6: PR作成（オプション）
      let prResult = null;
      if (options.createPR !== false) {
        console.log('🚀 Step 6: PR作成...');
        prResult = await this.autonomousPR.createAutonomousPR(generationResult);
        execution.steps.push({
          step: 'pr_creation',
          result: prResult,
          timestamp: Date.now()
        });
      }

      // Step 7: 実行完了
      const endTime = Date.now();
      execution.endTime = endTime;
      execution.duration = endTime - startTime;
      execution.status = 'completed';

      console.log(`✅ 自律処理完了: ${executionId} (${execution.duration}ms)`);

      return this.buildResult(execution, 'success', 'Autonomous implementation completed', {
        intent: intent,
        generation: generationResult,
        pr: prResult,
        quality: qualityCheck
      });

    } catch (error) {
      console.error(`❌ 自律処理エラー: ${executionId}`, error);
      
      const execution = this.executionHistory.find(e => e.id === executionId);
      if (execution) {
        execution.status = 'failed';
        execution.error = error.message;
        execution.endTime = Date.now();
        execution.duration = execution.endTime - execution.startTime;
      }

      return this.buildResult(execution, 'error', error.message);
    } finally {
      this.isExecuting = false;
    }
  }

  async checkFeasibility(intent) {
    const checks = {
      canExecute: true,
      requiresApproval: false,
      riskLevel: 'low',
      reasons: []
    };

    // 複雑度チェック
    if (intent.scope.complexity === 'high') {
      checks.requiresApproval = true;
      checks.riskLevel = 'medium';
      checks.reasons.push('High complexity implementation');
    }

    // 優先度チェック
    if (intent.priority === 'urgent') {
      checks.requiresApproval = true;
      checks.reasons.push('Urgent priority requires approval');
    }

    // ファイル変更範囲チェック
    if (intent.scope.estimatedHours > 8) {
      checks.requiresApproval = true;
      checks.riskLevel = 'high';
      checks.reasons.push('Large scope implementation');
    }

    // バグ修正の場合は即座に実行可能
    if (intent.type === 'bug_fix' && intent.priority === 'urgent') {
      checks.requiresApproval = false;
      checks.reasons.push('Urgent bug fix - auto approved');
    }

    // 破壊的変更の検知
    if (this.detectBreakingChanges(intent)) {
      checks.requiresApproval = true;
      checks.riskLevel = 'high';
      checks.reasons.push('Potential breaking changes detected');
    }

    return checks;
  }

  detectBreakingChanges(intent) {
    const breakingPatterns = [
      'データベーススキーマ',
      'API変更',
      'インターフェース変更',
      'breaking change',
      'schema change',
      'api breaking'
    ];

    return breakingPatterns.some(pattern => 
      intent.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  async requestApproval(intent, feasibilityCheck) {
    // 実際の実装では、Slack通知やWebダッシュボードでの承認を待つ
    console.log('📋 承認要求の詳細:');
    console.log(`- 意図: ${intent.type}`);
    console.log(`- 複雑度: ${intent.scope.complexity}`);
    console.log(`- リスクレベル: ${feasibilityCheck.riskLevel}`);
    console.log(`- 理由: ${feasibilityCheck.reasons.join(', ')}`);

    // 現在は自動承認（実際にはユーザー入力を待つ）
    return {
      approved: true,
      approver: 'auto-approval',
      timestamp: Date.now(),
      notes: 'Auto-approved for demonstration'
    };
  }

  async performQualityCheck(generationResult) {
    const checks = {
      passed: true,
      issues: [],
      warnings: [],
      score: 100
    };

    // コード品質チェック
    for (const [filePath, code] of generationResult.code) {
      const codeCheck = await this.checkCodeQuality(code, filePath);
      if (!codeCheck.passed) {
        checks.issues.push(...codeCheck.issues.map(issue => `${filePath}: ${issue}`));
        checks.score -= 10;
      }
      checks.warnings.push(...codeCheck.warnings.map(warning => `${filePath}: ${warning}`));
    }

    // テストカバレッジチェック
    const testCoverage = this.calculateTestCoverage(generationResult);
    if (testCoverage < 70) {
      checks.issues.push(`Low test coverage: ${testCoverage}%`);
      checks.score -= 20;
    }

    // セキュリティチェック
    const securityIssues = await this.performSecurityCheck(generationResult);
    if (securityIssues.length > 0) {
      checks.issues.push(...securityIssues);
      checks.score -= 30;
    }

    checks.passed = checks.issues.length === 0;
    return checks;
  }

  async checkCodeQuality(code, filePath) {
    const check = {
      passed: true,
      issues: [],
      warnings: []
    };

    // 基本的な品質チェック
    if (code.length < 50) {
      check.warnings.push('Code seems too short');
    }

    if (!code.includes('try') && !code.includes('catch') && filePath.includes('service')) {
      check.warnings.push('Missing error handling in service file');
    }

    if (code.includes('console.log') && !filePath.includes('test')) {
      check.warnings.push('Console.log found in production code');
    }

    // セキュリティパターンチェック
    const securityPatterns = [
      /password\s*=\s*['"]/i,
      /api_key\s*=\s*['"]/i,
      /secret\s*=\s*['"]/i
    ];

    securityPatterns.forEach(pattern => {
      if (pattern.test(code)) {
        check.issues.push('Potential hardcoded credential detected');
        check.passed = false;
      }
    });

    return check;
  }

  calculateTestCoverage(generationResult) {
    const codeFiles = generationResult.code.size;
    const testFiles = generationResult.tests.size;
    
    if (codeFiles === 0) return 100;
    return Math.round((testFiles / codeFiles) * 100);
  }

  async performSecurityCheck(generationResult) {
    const issues = [];

    for (const [filePath, code] of generationResult.code) {
      // SQL インジェクションチェック
      if (code.includes('SELECT') && !code.includes('prepared') && !code.includes('parameterized')) {
        issues.push(`Potential SQL injection vulnerability in ${filePath}`);
      }

      // XSS脆弱性チェック
      if (code.includes('innerHTML') && !code.includes('sanitize')) {
        issues.push(`Potential XSS vulnerability in ${filePath}`);
      }

      // 認証チェック
      if (filePath.includes('auth') && !code.includes('bcrypt') && !code.includes('hash')) {
        issues.push(`Insecure authentication implementation in ${filePath}`);
      }
    }

    return issues;
  }

  buildResult(execution, status, message, data = null) {
    return {
      executionId: execution ? execution.id : null,
      status: status,
      message: message,
      data: data,
      execution: execution,
      timestamp: new Date().toISOString()
    };
  }

  generateExecutionId() {
    return `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // 統計とモニタリング
  getExecutionStats() {
    const total = this.executionHistory.length;
    const completed = this.executionHistory.filter(e => e.status === 'completed').length;
    const failed = this.executionHistory.filter(e => e.status === 'failed').length;
    const cancelled = this.executionHistory.filter(e => e.status === 'cancelled').length;

    const avgDuration = this.executionHistory
      .filter(e => e.duration)
      .reduce((sum, e) => sum + e.duration, 0) / total || 0;

    return {
      total: total,
      completed: completed,
      failed: failed,
      cancelled: cancelled,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      averageDuration: Math.round(avgDuration),
      isCurrentlyExecuting: this.isExecuting
    };
  }

  getRecentExecutions(limit = 10) {
    return this.executionHistory
      .slice(-limit)
      .reverse()
      .map(execution => ({
        id: execution.id,
        message: execution.message,
        status: execution.status,
        duration: execution.duration,
        timestamp: execution.startTime
      }));
  }

  async cancelExecution(executionId) {
    const execution = this.executionHistory.find(e => e.id === executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      this.isExecuting = false;
      return true;
    }
    return false;
  }
}

module.exports = AutonomousController;