/**
 * Conea自律AIエージェント - 意図理解エンジン
 * 自然言語から開発タスクを理解・分類・計画生成
 */

const natural = require('natural');
const nlp = require('compromise');

class IntentAnalyzer {
  constructor() {
    this.classifier = new natural.BayesClassifier();
    this.setupClassifier();
    
    // 開発パターン辞書
    this.patterns = {
      feature_development: [
        '機能', '追加', '実装', '開発', '作成', '新しい', 'feature', 'add', 'implement', 'create'
      ],
      bug_fix: [
        'バグ', '修正', 'エラー', '問題', '直す', 'bug', 'fix', 'error', 'issue', 'problem'
      ],
      refactoring: [
        'リファクタリング', '改善', '最適化', 'refactor', 'improve', 'optimize', 'clean'
      ],
      testing: [
        'テスト', 'test', 'spec', 'テストケース', 'ユニットテスト'
      ],
      deployment: [
        'デプロイ', 'deploy', 'リリース', 'release', '公開', 'publish'
      ],
      documentation: [
        'ドキュメント', 'doc', 'readme', '説明', 'documentation'
      ]
    };
  }

  setupClassifier() {
    // トレーニングデータ
    const trainingData = [
      // 機能開発
      { text: 'ユーザーログイン機能を実装してください', label: 'feature_development' },
      { text: 'APIエンドポイントを追加したい', label: 'feature_development' },
      { text: 'データベース連携機能を作成', label: 'feature_development' },
      
      // バグ修正
      { text: 'ログインできないバグを修正', label: 'bug_fix' },
      { text: 'エラーが発生している問題を解決', label: 'bug_fix' },
      { text: '500エラーを直してください', label: 'bug_fix' },
      
      // リファクタリング
      { text: 'コードの最適化をお願いします', label: 'refactoring' },
      { text: 'パフォーマンスを改善したい', label: 'refactoring' },
      { text: 'コードをきれいにしてください', label: 'refactoring' },
      
      // テスト
      { text: 'ユニットテストを書いてください', label: 'testing' },
      { text: 'テストケースを追加したい', label: 'testing' },
      
      // デプロイ
      { text: '本番環境にデプロイしてください', label: 'deployment' },
      { text: 'リリースの準備をお願いします', label: 'deployment' }
    ];

    trainingData.forEach(item => {
      this.classifier.addDocument(item.text, item.label);
    });
    
    this.classifier.train();
  }

  async analyzeIntent(message) {
    try {
      // 1. 基本的な意図分類
      const intentType = this.classifier.classify(message);
      const confidence = this.getClassificationConfidence(message, intentType);

      // 2. 自然言語解析
      const doc = nlp(message);
      const entities = this.extractEntities(doc);

      // 3. 詳細パラメータ抽出
      const parameters = await this.extractParameters(message, intentType, doc);

      // 4. 優先度とスコープの判定
      const priority = this.determinePriority(message, intentType);
      const scope = this.determineScope(message, entities);

      return {
        type: intentType,
        confidence: confidence,
        message: message,
        entities: entities,
        parameters: parameters,
        priority: priority,
        scope: scope,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Intent analysis error:', error);
      return {
        type: 'unknown',
        confidence: 0,
        message: message,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  extractEntities(doc) {
    return {
      technologies: doc.match('#Technology').out('array'),
      files: doc.match('#FileName').out('array'),
      methods: doc.match('#Method').out('array'),
      apis: doc.match('#Api').out('array'),
      databases: doc.match('#Database').out('array'),
      frameworks: doc.match('#Framework').out('array'),
      verbs: doc.verbs().out('array'),
      nouns: doc.nouns().out('array')
    };
  }

  async extractParameters(message, intentType, doc) {
    const parameters = {};

    switch (intentType) {
      case 'feature_development':
        parameters.featureName = this.extractFeatureName(message, doc);
        parameters.components = this.extractComponents(message);
        parameters.endpoints = this.extractEndpoints(message);
        parameters.database = this.extractDatabaseRequirements(message);
        break;

      case 'bug_fix':
        parameters.errorType = this.extractErrorType(message);
        parameters.errorLocation = this.extractErrorLocation(message);
        parameters.symptoms = this.extractSymptoms(message);
        break;

      case 'refactoring':
        parameters.targetFiles = this.extractTargetFiles(message);
        parameters.optimizationType = this.extractOptimizationType(message);
        break;

      case 'testing':
        parameters.testType = this.extractTestType(message);
        parameters.coverage = this.extractCoverageRequirements(message);
        break;

      case 'deployment':
        parameters.environment = this.extractEnvironment(message);
        parameters.deploymentType = this.extractDeploymentType(message);
        break;
    }

    return parameters;
  }

  extractFeatureName(message, doc) {
    // 「〜機能」「〜システム」「〜API」などのパターンを抽出
    const patterns = [
      /([^。、\n]+)機能/g,
      /([^。、\n]+)システム/g,
      /([^。、\n]+)API/g,
      /([^。、\n]+)エンドポイント/g
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[0].replace(/(機能|システム|API|エンドポイント)$/, '');
      }
    }

    // 動詞から推測
    const verbs = doc.verbs().out('array');
    if (verbs.includes('実装') || verbs.includes('作成') || verbs.includes('追加')) {
      const nouns = doc.nouns().out('array');
      return nouns[0] || 'Unknown Feature';
    }

    return 'Unknown Feature';
  }

  extractComponents(message) {
    const components = [];
    const componentPatterns = [
      'フロントエンド', 'バックエンド', 'データベース', 'API', 'UI', 'サーバー',
      'frontend', 'backend', 'database', 'api', 'ui', 'server'
    ];

    componentPatterns.forEach(pattern => {
      if (message.toLowerCase().includes(pattern.toLowerCase())) {
        components.push(pattern);
      }
    });

    return components;
  }

  extractEndpoints(message) {
    // REST APIパターンを抽出
    const endpoints = [];
    const endpointPatterns = [
      /\/(api|v1|v2)\/[a-zA-Z0-9\/\-_]+/g,
      /(GET|POST|PUT|DELETE|PATCH)\s+[\/a-zA-Z0-9\-_]+/g
    ];

    endpointPatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) {
        endpoints.push(...matches);
      }
    });

    return endpoints;
  }

  extractDatabaseRequirements(message) {
    const requirements = {};
    
    // テーブル操作
    if (message.includes('テーブル') || message.includes('table')) {
      requirements.tables = true;
    }
    
    // CRUD操作
    const crudOperations = ['作成', '取得', '更新', '削除', 'create', 'read', 'update', 'delete'];
    requirements.operations = crudOperations.filter(op => 
      message.toLowerCase().includes(op.toLowerCase())
    );

    return requirements;
  }

  determinePriority(message, intentType) {
    // 緊急度キーワード
    const urgentKeywords = ['緊急', '至急', 'urgent', 'critical', '重要', 'important'];
    const highKeywords = ['できるだけ早く', 'asap', '優先', 'priority'];
    
    const lowerMessage = message.toLowerCase();
    
    if (urgentKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()))) {
      return 'urgent';
    }
    
    if (highKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()))) {
      return 'high';
    }
    
    // バグ修正は通常優先度高
    if (intentType === 'bug_fix') {
      return 'high';
    }
    
    return 'medium';
  }

  determineScope(message, entities) {
    const scope = {
      size: 'medium',
      estimatedHours: 4,
      complexity: 'medium'
    };

    // 規模推定
    const largeKeywords = ['システム全体', 'アーキテクチャ', '大規模', 'システム統合'];
    const smallKeywords = ['小さな修正', 'ちょっとした', '簡単な'];

    const lowerMessage = message.toLowerCase();

    if (largeKeywords.some(keyword => lowerMessage.includes(keyword))) {
      scope.size = 'large';
      scope.estimatedHours = 16;
      scope.complexity = 'high';
    } else if (smallKeywords.some(keyword => lowerMessage.includes(keyword))) {
      scope.size = 'small';
      scope.estimatedHours = 1;
      scope.complexity = 'low';
    }

    return scope;
  }

  getClassificationConfidence(message, classification) {
    const classifications = this.classifier.getClassifications(message);
    const result = classifications.find(c => c.label === classification);
    return result ? Math.round(result.value * 100) / 100 : 0;
  }

  // ヘルパーメソッド群
  extractErrorType(message) {
    const errorTypes = ['500', '404', '403', '401', 'timeout', 'connection', 'syntax', 'runtime'];
    return errorTypes.find(type => message.toLowerCase().includes(type)) || 'unknown';
  }

  extractErrorLocation(message) {
    const filePattern = /([a-zA-Z0-9_\-]+\.(js|ts|py|java|php|rb|go|cpp|c|css|html))/g;
    const matches = message.match(filePattern);
    return matches ? matches[0] : null;
  }

  extractSymptoms(message) {
    const symptoms = [];
    const symptomKeywords = ['動かない', 'エラー', '表示されない', '遅い', 'クラッシュ'];
    
    symptomKeywords.forEach(keyword => {
      if (message.includes(keyword)) {
        symptoms.push(keyword);
      }
    });
    
    return symptoms;
  }

  extractTestType(message) {
    const testTypes = ['unit', 'integration', 'e2e', 'performance', 'security'];
    return testTypes.find(type => message.toLowerCase().includes(type)) || 'unit';
  }

  extractEnvironment(message) {
    const environments = ['production', 'staging', 'development', 'test', '本番', 'ステージング', '開発'];
    return environments.find(env => message.toLowerCase().includes(env.toLowerCase())) || 'staging';
  }
}

module.exports = IntentAnalyzer;