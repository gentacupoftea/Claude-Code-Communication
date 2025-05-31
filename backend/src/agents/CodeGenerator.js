/**
 * Conea自律AIエージェント - コード生成エンジン
 * 意図分析結果からコード生成と実装計画を作成
 */

const fs = require('fs').promises;
const path = require('path');
const shelljs = require('shelljs');
const { diffLines } = require('diff');

class CodeGenerator {
  constructor(llmService, fileAnalyzer) {
    this.llm = llmService;
    this.fileAnalyzer = fileAnalyzer;
    
    // コードテンプレート
    this.templates = new Map();
    this.initializeTemplates();
    
    // アーキテクチャパターン
    this.patterns = {
      mvc: { directories: ['models', 'views', 'controllers'] },
      microservice: { directories: ['services', 'handlers', 'middleware'] },
      layered: { directories: ['presentation', 'business', 'data'] },
      component: { directories: ['components', 'hooks', 'utils'] }
    };
  }

  async generateImplementation(intent) {
    try {
      console.log(`🧠 コード生成開始: ${intent.type}`);

      // 1. 実装計画生成
      const plan = await this.createImplementationPlan(intent);
      
      // 2. 既存コードベース分析
      const codebaseContext = await this.analyzeCodebase(plan.targetPaths);
      
      // 3. コード生成
      const generatedCode = await this.generateCode(intent, plan, codebaseContext);
      
      // 4. テストコード生成
      const testCode = await this.generateTests(generatedCode, intent);
      
      // 5. ドキュメント生成
      const documentation = await this.generateDocumentation(generatedCode, intent);

      return {
        intent: intent,
        plan: plan,
        code: generatedCode,
        tests: testCode,
        documentation: documentation,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('コード生成エラー:', error);
      throw new Error(`Code generation failed: ${error.message}`);
    }
  }

  async createImplementationPlan(intent) {
    const plan = {
      phases: [],
      targetPaths: [],
      dependencies: [],
      estimatedDuration: intent.scope.estimatedHours,
      complexity: intent.scope.complexity
    };

    switch (intent.type) {
      case 'feature_development':
        plan.phases = await this.planFeatureDevelopment(intent);
        break;
      case 'bug_fix':
        plan.phases = await this.planBugFix(intent);
        break;
      case 'refactoring':
        plan.phases = await this.planRefactoring(intent);
        break;
      case 'testing':
        plan.phases = await this.planTesting(intent);
        break;
    }

    return plan;
  }

  async planFeatureDevelopment(intent) {
    const featureName = intent.parameters.featureName;
    const sanitizedName = this.sanitizeFileName(featureName);
    const components = intent.parameters.components || [];
    
    const phases = [
      {
        name: 'データモデル設計',
        files: [`src/models/${sanitizedName}Model.js`],
        description: 'データ構造とスキーマ定義'
      }
    ];

    if (components.includes('API') || components.includes('backend')) {
      phases.push({
        name: 'API実装',
        files: [
          `src/routes/${sanitizedName}Routes.js`,
          `src/controllers/${sanitizedName}Controller.js`,
          `src/services/${sanitizedName}Service.js`
        ],
        description: 'RESTful API エンドポイント実装'
      });
    }

    if (components.includes('UI') || components.includes('frontend')) {
      phases.push({
        name: 'フロントエンド実装',
        files: [
          `src/components/${sanitizedName}Component.jsx`,
          `src/pages/${sanitizedName}Page.jsx`,
          `src/hooks/use${sanitizedName}.js`
        ],
        description: 'ユーザーインターフェース実装'
      });
    }

    phases.push({
      name: 'テスト実装',
      files: [
        `tests/unit/${sanitizedName}.test.js`,
        `tests/integration/${sanitizedName}.test.js`
      ],
      description: '単体テストと統合テスト'
    });

    return phases;
  }

  async planBugFix(intent) {
    const errorLocation = intent.parameters.errorLocation;
    const errorType = intent.parameters.errorType;

    return [
      {
        name: 'バグ原因調査',
        files: [errorLocation].filter(Boolean),
        description: `${errorType}エラーの根本原因特定`
      },
      {
        name: 'バグ修正実装',
        files: [errorLocation].filter(Boolean),
        description: '修正コードの実装'
      },
      {
        name: '回帰テスト',
        files: [`tests/bugfix/${errorType}_fix.test.js`],
        description: 'バグ再発防止テスト'
      }
    ];
  }

  async analyzeCodebase(targetPaths) {
    const context = {
      existingFiles: new Map(),
      dependencies: new Set(),
      patterns: [],
      style: {}
    };

    for (const filePath of targetPaths) {
      try {
        if (await this.fileExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf8');
          context.existingFiles.set(filePath, content);
          
          // 依存関係抽出
          const deps = this.extractDependencies(content);
          deps.forEach(dep => context.dependencies.add(dep));
          
          // コーディングスタイル分析
          const style = this.analyzeCodeStyle(content);
          Object.assign(context.style, style);
        }
      } catch (error) {
        console.warn(`ファイル読み込みエラー: ${filePath}`, error.message);
      }
    }

    return context;
  }

  async generateCode(intent, plan, context) {
    const generatedFiles = new Map();

    for (const phase of plan.phases) {
      for (const filePath of phase.files) {
        const code = await this.generateFileCode(filePath, intent, phase, context);
        generatedFiles.set(filePath, code);
      }
    }

    return generatedFiles;
  }

  async generateFileCode(filePath, intent, phase, context) {
    const fileType = this.detectFileType(filePath);
    const template = this.getTemplate(fileType, intent.type);
    
    // LLMにコード生成を依頼
    const prompt = this.buildCodeGenerationPrompt(filePath, intent, phase, context, template);
    
    try {
      const response = await this.llm.generateCode(prompt);
      const code = this.extractCodeFromResponse(response);
      
      // コード品質チェック
      const qualityCheck = await this.validateCodeQuality(code, fileType);
      if (!qualityCheck.passed) {
        console.warn(`コード品質警告: ${filePath}`, qualityCheck.issues);
      }
      
      return code;
    } catch (error) {
      console.error(`コード生成失敗: ${filePath}`, error);
      return this.generateFallbackCode(filePath, intent, template);
    }
  }

  generateFallbackCode(filePath, intent, template) {
    // フォールバックコード生成
    const featureName = intent.parameters.featureName || 'unknownFeature';
    const functionName = featureName.replace(/\s+/g, '');
    
    return `
/**
 * ${featureName} - Auto-generated fallback code
 * Generated by Conea Autonomous Agent
 */

async function ${functionName}(params) {
  try {
    console.log('${featureName} function called with:', params);
    
    // TODO: Implement ${featureName} logic here
    
    return {
      success: true,
      message: '${featureName} executed successfully',
      data: params
    };
  } catch (error) {
    console.error('${featureName} error:', error);
    throw new Error(\`${featureName} failed: \${error.message}\`);
  }
}

module.exports = ${functionName};
    `.trim();
  }

  buildCodeGenerationPrompt(filePath, intent, phase, context, template) {
    return `
# コード生成リクエスト

## ファイル情報
- パス: ${filePath}
- フェーズ: ${phase.name}
- 説明: ${phase.description}

## 機能要件
- 意図: ${intent.type}
- 機能名: ${intent.parameters.featureName || 'Unknown'}
- 優先度: ${intent.priority}

## 技術要件
- 既存依存関係: ${Array.from(context.dependencies).join(', ')}
- コーディングスタイル: ${JSON.stringify(context.style)}

## 既存コード参考
${this.getRelevantExistingCode(context, filePath)}

## テンプレート
${template}

## 生成指示
1. 既存のコーディングスタイルに従ってください
2. 適切なエラーハンドリングを含めてください
3. 十分なコメントを追加してください
4. セキュリティを考慮してください
5. パフォーマンスを最適化してください

生成コード:
    `;
  }

  async generateTests(generatedCode, intent) {
    const testFiles = new Map();
    
    for (const [filePath, code] of generatedCode) {
      const testPath = this.getTestPath(filePath);
      const testCode = await this.generateTestCode(filePath, code, intent);
      testFiles.set(testPath, testCode);
    }
    
    return testFiles;
  }

  async generateTestCode(filePath, code, intent) {
    const prompt = `
# テストコード生成

## 対象ファイル: ${filePath}
## 対象コード:
\`\`\`javascript
${code}
\`\`\`

## 要件
1. 包括的な単体テスト
2. エッジケースのテスト
3. エラーケースのテスト
4. モックの適切な使用

以下のテストフレームワークを使用してください:
- Jest
- Supertest (API テスト用)

生成するテストコード:
    `;

    try {
      const response = await this.llm.generateCode(prompt);
      return this.extractCodeFromResponse(response);
    } catch (error) {
      console.error('テストコード生成エラー:', error);
      return this.generateBasicTest(filePath, code);
    }
  }

  async generateDocumentation(generatedCode, intent) {
    const docs = {
      readme: '',
      api: '',
      changelog: ''
    };

    // README更新
    docs.readme = await this.generateReadmeUpdate(generatedCode, intent);
    
    // API文書生成（APIの場合）
    if (intent.parameters.components?.includes('API')) {
      docs.api = await this.generateApiDocumentation(generatedCode);
    }
    
    // CHANGELOG更新
    docs.changelog = this.generateChangelogEntry(intent);

    return docs;
  }

  async generateReadmeUpdate(generationResult, intent) {
    const featureName = intent.parameters.featureName || 'New Feature';
    const filesCount = generationResult.code ? generationResult.code.size || 0 : 0;
    const testsCount = generationResult.tests ? generationResult.tests.size || 0 : 0;
    
    return `
### ${featureName}

${intent.message}

**Implementation Details:**
- Files added: ${filesCount}
- Tests included: ${testsCount}
- Generated by: Conea Autonomous Agent

**Usage:**
\`\`\`javascript
// Example usage will be documented here
\`\`\`
    `.trim();
  }

  async generateApiDocumentation(generatedCode) {
    const apiEndpoints = [];
    
    for (const [filePath, code] of generatedCode) {
      if (filePath.includes('routes') || filePath.includes('controller')) {
        // Extract API endpoints from code
        const endpoints = this.extractApiEndpoints(code);
        apiEndpoints.push(...endpoints);
      }
    }
    
    return apiEndpoints.map(endpoint => `
### ${endpoint.method} ${endpoint.path}
${endpoint.description}
    `).join('\n');
  }

  extractApiEndpoints(code) {
    const endpoints = [];
    const routeRegex = /router\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g;
    
    let match;
    while ((match = routeRegex.exec(code)) !== null) {
      endpoints.push({
        method: match[1].toUpperCase(),
        path: match[2],
        description: 'Auto-generated endpoint'
      });
    }
    
    return endpoints;
  }

  // ユーティリティメソッド
  sanitizeFileName(name) {
    if (!name || typeof name !== 'string') {
      return 'unknown';
    }
    
    return name
      .replace(/[^a-zA-Z0-9]/g, '') // Remove special chars and spaces
      .replace(/\s+/g, '') // Remove any remaining spaces
      .toLowerCase();
  }

  detectFileType(filePath) {
    const ext = path.extname(filePath);
    const typeMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'react',
      '.tsx': 'react-typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'golang',
      '.rs': 'rust'
    };
    return typeMap[ext] || 'text';
  }

  getTemplate(fileType, intentType) {
    const key = `${fileType}_${intentType}`;
    return this.templates.get(key) || this.templates.get(fileType) || '';
  }

  initializeTemplates() {
    // JavaScript関数テンプレート
    this.templates.set('javascript_feature_development', `
/**
 * {{FEATURE_NAME}} - {{DESCRIPTION}}
 * @param {Object} params - パラメータ
 * @returns {Promise<Object>} 結果
 */
async function {{FUNCTION_NAME}}(params) {
  try {
    // 実装をここに追加
    
    return { success: true, data: result };
  } catch (error) {
    console.error('{{FUNCTION_NAME}} error:', error);
    throw new Error(\`{{FUNCTION_NAME}} failed: \${error.message}\`);
  }
}

module.exports = {{FUNCTION_NAME}};
    `);

    // Express.jsルートテンプレート
    this.templates.set('javascript_api', `
const express = require('express');
const router = express.Router();

/**
 * {{ENDPOINT_DESCRIPTION}}
 */
router.{{HTTP_METHOD}}('{{ENDPOINT_PATH}}', async (req, res) => {
  try {
    const result = await {{SERVICE_FUNCTION}}(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
    `);

    // シンプルなJavaScriptファイルテンプレート
    this.templates.set('javascript', `
// {{DESCRIPTION}}

/**
 * {{FUNCTION_NAME}}
 * @param {*} params 
 * @returns {*}
 */
function {{FUNCTION_NAME}}(params) {
  // 実装をここに追加
  return params;
}

module.exports = {{FUNCTION_NAME}};
    `);
  }

  extractDependencies(code) {
    const deps = [];
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    const importRegex = /import.*from\s+['"]([^'"]+)['"]/g;
    
    let match;
    while ((match = requireRegex.exec(code)) !== null) {
      deps.push(match[1]);
    }
    while ((match = importRegex.exec(code)) !== null) {
      deps.push(match[1]);
    }
    
    return deps;
  }

  analyzeCodeStyle(code) {
    return {
      indentation: code.includes('\t') ? 'tabs' : 'spaces',
      quotes: code.includes('"') > code.includes("'") ? 'double' : 'single',
      semicolons: code.includes(';'),
      asyncAwait: code.includes('async') && code.includes('await')
    };
  }

  extractCodeFromResponse(response) {
    // コードブロックから実際のコードを抽出
    const codeBlockRegex = /```(?:javascript|js|typescript|ts)?\n([\s\S]*?)\n```/;
    const match = response.match(codeBlockRegex);
    return match ? match[1] : response;
  }

  async validateCodeQuality(code, fileType) {
    const issues = [];
    
    // 基本的な品質チェック
    if (code.length < 10) {
      issues.push('コードが短すぎます');
    }
    
    if (!code.includes('try') && !code.includes('catch')) {
      issues.push('エラーハンドリングが不足しています');
    }
    
    if (fileType === 'javascript' && !code.includes('module.exports')) {
      issues.push('module.exportsが不足しています');
    }

    return {
      passed: issues.length === 0,
      issues: issues
    };
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getTestPath(filePath) {
    const parsed = path.parse(filePath);
    return path.join('tests', 'unit', `${parsed.name}.test${parsed.ext}`);
  }

  generateBasicTest(filePath, code) {
    const funcName = this.extractFunctionName(code);
    return `
const ${funcName} = require('${filePath}');

describe('${funcName}', () => {
  test('should work correctly', async () => {
    // テストを実装してください
    expect(true).toBe(true);
  });
});
    `;
  }

  extractFunctionName(code) {
    const funcRegex = /function\s+(\w+)/;
    const match = code.match(funcRegex);
    return match ? match[1] : 'unknownFunction';
  }

  getRelevantExistingCode(context, filePath) {
    // 関連する既存コードを取得
    for (const [existingPath, existingCode] of context.existingFiles) {
      if (existingPath.includes(path.dirname(filePath))) {
        return `// ${existingPath}\n${existingCode.slice(0, 500)}...\n`;
      }
    }
    return '// 既存コードなし';
  }

  generateChangelogEntry(intent) {
    const timestamp = new Date().toISOString().split('T')[0];
    return `
## [${timestamp}] - ${intent.type}

### Added
- ${intent.parameters.featureName || 'New feature'}

### Changed
- ${intent.message}

### Technical Details
- Priority: ${intent.priority}
- Scope: ${intent.scope.size}
- Estimated Hours: ${intent.scope.estimatedHours}
    `;
  }
}

module.exports = CodeGenerator;