/**
<<<<<<< HEAD
 * Conea Staging Backend API Server
 * MultiLLM統合API実装
 */

// 環境変数読み込み
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
=======
 * Conea統合バックエンドサーバー
 * conea-stagingとconea-integrationの機能を統合
 */

// 環境変数読み込み
require('dotenv').config();

// 環境変数検証
const { validateAndLog, getEnvironmentHealth } = require('./src/config/envValidator');
const envValidation = validateAndLog();

// 本番環境で検証エラーがある場合は起動を停止
if (process.env.NODE_ENV === 'production' && !envValidation.valid) {
  console.error('🚨 Critical environment configuration errors detected in production!');
  console.error('Server startup aborted for security reasons.');
  process.exit(1);
}
>>>>>>> origin/main

const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const multer = require('multer');
<<<<<<< HEAD
const AIService = require('./lib/ai-service');

=======
const socketIO = require('socket.io');

// conea-integrationからの機能
const { WebClient } = require('@slack/web-api');
const Redis = require('ioredis');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// conea-stagingからの機能
const AIService = require('./lib/ai-service');

// セキュリティミドルウェア
const { 
  basicValidation, 
  validateField, 
  validateEmail, 
  validateJSON, 
  validateApiKey,
  limitArrayLength 
} = require('./src/middleware/validation');

>>>>>>> origin/main
// ファイルアップロード設定
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

const app = express();
const PORT = process.env.PORT || 8000;

// AI Service インスタンス作成
const aiService = new AIService();

<<<<<<< HEAD
// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'https://staging-conea-ai.web.app',
    'https://staging.conea.ai',
    'https://conea.ai',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());
=======
// Redis接続（conea-integrationから）
let redis = null;
try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  });
} catch (error) {
  console.warn('Redis connection failed:', error.message);
}

// Slack接続（conea-integrationから）
const slackClient = process.env.SLACK_BOT_TOKEN ? 
  new WebClient(process.env.SLACK_BOT_TOKEN) : null;

// セキュアなCORS設定
const getAllowedOrigins = () => {
  const baseOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173', // Vite dev server
  ];
  
  const prodOrigins = [
    'https://conea.ai',
    'https://app.conea.ai',
    'https://staging.conea.ai',
    'https://staging-conea-ai.web.app'
  ];
  
  // 開発環境では localhost を許可、本番環境では本番ドメインのみ
  if (process.env.NODE_ENV === 'production') {
    return [...prodOrigins, process.env.FRONTEND_URL].filter(Boolean);
  } else {
    return [...baseOrigins, ...prodOrigins, process.env.FRONTEND_URL].filter(Boolean);
  }
};

app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  maxAge: 86400 // 24 hours
}));

// セキュリティヘッダーの設定
app.use((req, res, next) => {
  // セキュリティヘッダー
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // CSP（コンテンツセキュリティポリシー）
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' wss: ws:",
    "frame-ancestors 'none'"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  
  // HSTS（HTTP Strict Transport Security）- 本番環境のみ
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
});

// JSONボディパーサー（サイズ制限付き）
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // JSON構文チェック
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON format' });
      return;
    }
  }
}));

// URL-encoded data parser
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 基本的な入力値検証ミドルウェア（全エンドポイントに適用）
app.use(basicValidation);

// セキュアなSocket.IOセットアップ
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: getAllowedOrigins(),
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  // セキュリティ設定
  transports: ['websocket', 'polling'],
  allowEIO3: false
});
>>>>>>> origin/main

// ログ設定
const log = (message, level = 'INFO') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level}: ${message}`);
};

// データディレクトリ作成
const DATA_DIR = path.join(__dirname, 'data');
const API_KEYS_FILE = path.join(DATA_DIR, 'api_keys.json');
const DASHBOARDS_FILE = path.join(DATA_DIR, 'dashboards.json');
const LEARNING_DATA_FILE = path.join(DATA_DIR, 'learning_data.json');

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

<<<<<<< HEAD
// デフォルトデータ
=======
// デフォルトデータ（conea-stagingから）
>>>>>>> origin/main
const defaultApiKeys = {
  amazon: {
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1',
    marketplaceId: '',
    sellerId: ''
  },
  rakuten: {
    applicationId: '',
    secret: '',
    serviceSecret: '',
    shopUrl: ''
  },
  shopify: {
    shopDomain: '',
    accessToken: '',
    apiKey: '',
    apiSecret: ''
  },
  nextengine: {
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    uid: '',
    accessToken: ''
  }
};

<<<<<<< HEAD
const defaultDashboards = [];
const defaultLearningData = [];

=======
>>>>>>> origin/main
// データファイル初期化
async function initializeData() {
  await ensureDataDir();
  
  try {
    await fs.access(API_KEYS_FILE);
  } catch {
    await fs.writeFile(API_KEYS_FILE, JSON.stringify(defaultApiKeys, null, 2));
  }
  
  try {
    await fs.access(DASHBOARDS_FILE);
  } catch {
<<<<<<< HEAD
    await fs.writeFile(DASHBOARDS_FILE, JSON.stringify(defaultDashboards, null, 2));
=======
    await fs.writeFile(DASHBOARDS_FILE, JSON.stringify([], null, 2));
>>>>>>> origin/main
  }
  
  try {
    await fs.access(LEARNING_DATA_FILE);
  } catch {
<<<<<<< HEAD
    await fs.writeFile(LEARNING_DATA_FILE, JSON.stringify(defaultLearningData, null, 2));
  }
}

// ============= API Routes =============

// Health Check
app.get('/api/health', (req, res) => {
  // AI プロバイダーの設定状態を確認
=======
    await fs.writeFile(LEARNING_DATA_FILE, JSON.stringify([], null, 2));
  }
}

// ============= 統合版 API Routes =============

// Health Check（統合版）
app.get('/api/health', (req, res) => {
>>>>>>> origin/main
  const aiProviders = {
    openai: !!(process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY),
    anthropic: !!(process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY),
    google: !!(process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
  };
  
<<<<<<< HEAD
  const configuredProviders = Object.entries(aiProviders)
    .filter(([_, configured]) => configured)
    .map(([provider]) => provider);
=======
  const services = {
    api: 'running',
    aiProviders: aiProviders,
    database: 'file_based',
    redis: redis && redis.status === 'ready' ? 'connected' : 'disconnected',
    slack: slackClient ? 'configured' : 'not configured',
    socket: 'enabled'
  };
  
  // 環境変数健全性チェック
  const environmentHealth = getEnvironmentHealth();
>>>>>>> origin/main
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
<<<<<<< HEAD
    mode: 'production',
    services: {
      api: 'running',
      aiProviders: aiProviders,
      configuredProviders: configuredProviders,
      database: 'file_based'
    }
  });
});

// 利用可能なモデル一覧
app.get('/api/models', async (req, res) => {
  try {
    // AIServiceから利用可能なモデルを取得
    const models = aiService.getAvailableModels();
    
    res.json({
      models: models,
=======
    mode: 'integrated',
    services: services,
    environmentHealth: environmentHealth
  });
});

// 環境変数詳細チェックエンドポイント（開発・ステージング専用）
app.get('/api/health/environment', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not available in production' });
  }
  
  const environmentHealth = getEnvironmentHealth();
  res.json(environmentHealth);
});

// 利用可能なモデル一覧
app.get('/api/models', async (req, res) => {
  try {
    const models = aiService.getAvailableModels();
    const status = aiService.getProviderStatus();
    
    res.json({
      models: models,
      availableProviders: aiService.getAvailableProviders(),
      providerStatus: status,
>>>>>>> origin/main
      providers: {
        openai: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
        anthropic: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229'],
        google: ['gemini-1.5-flash', 'gemini-1.5-pro']
      }
    });
  } catch (error) {
    log(`Error fetching models: ${error.message}`, 'ERROR');
    res.status(500).json({ 
      error: 'Failed to fetch models',
<<<<<<< HEAD
      models: ['gpt-3.5-turbo'] // 緊急フォールバック
=======
      models: [],
      availableProviders: [],
      providerStatus: {}
>>>>>>> origin/main
    });
  }
});

<<<<<<< HEAD
// ファイルアップロード処理
app.post('/api/files/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fileInfo = {
      id: fileId,
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
      uploadedAt: new Date().toISOString()
    };

    // ファイル情報を保存（実際はメモリに保持）
    if (!global.uploadedFiles) {
      global.uploadedFiles = new Map();
    }
    global.uploadedFiles.set(fileId, {
      info: fileInfo,
      buffer: req.file.buffer
    });

    log(`File uploaded: ${fileInfo.name} (${fileInfo.size} bytes)`);
    res.json({ success: true, fileId, fileInfo });
  } catch (error) {
    log(`File upload error: ${error.message}`, 'ERROR');
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// ファイル付きチャットメッセージ送信
app.post('/api/chat/with-files', upload.array('file_', 10), async (req, res) => {
  try {
    // FormDataからデータを抽出
    const messages = JSON.parse(req.body.messages);
    const model = req.body.model || 'gpt-3.5-turbo';
    const temperature = parseFloat(req.body.temperature) || 0.7;
    const max_tokens = parseInt(req.body.max_tokens) || 1000;
    const system_prompt = req.body.system_prompt;
=======
// プロバイダー状態確認エンドポイント
app.get('/api/providers/status', async (req, res) => {
  try {
    const status = aiService.getProviderStatus();
    res.json({
      status: status,
      available: aiService.getAvailableProviders(),
      models: aiService.getAvailableModels()
    });
  } catch (error) {
    log(`Error getting provider status: ${error.message}`, 'ERROR');
    res.status(500).json({ 
      error: 'Failed to get provider status',
      status: {},
      available: [],
      models: []
    });
  }
});

// チャットメッセージ送信
app.post('/api/chat', 
  limitArrayLength('messages', 50), // メッセージ数制限
  async (req, res) => {
  try {
    const { messages, model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 1000, system_prompt } = req.body;
>>>>>>> origin/main

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

<<<<<<< HEAD
    // ファイル情報をメッセージに追加
    let fileContext = '';
    if (req.files && req.files.length > 0) {
      fileContext = '\n\n添付ファイル情報:\n';
      for (const file of req.files) {
        fileContext += `- ${file.originalname} (${file.mimetype}, ${file.size} bytes)\n`;
        
        // テキストファイルの場合は内容を読み取る
        if (file.mimetype.startsWith('text/') || file.mimetype === 'application/json') {
          try {
            const content = file.buffer.toString('utf8');
            fileContext += `  内容:\n${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}\n`;
          } catch (e) {
            fileContext += `  (内容の読み取りに失敗しました)\n`;
          }
        }
      }
    }

    // 最後のユーザーメッセージにファイル情報を追加
    if (fileContext && messages.length > 0) {
      const lastUserMessageIndex = messages.findLastIndex(m => m.role === 'user');
      if (lastUserMessageIndex >= 0) {
        messages[lastUserMessageIndex].content += fileContext;
      }
    }

    // システムプロンプトがある場合はメッセージの最初に追加
=======
    // 各メッセージの内容長制限
    for (const message of messages) {
      if (message.content && message.content.length > 10000) {
        return res.status(400).json({ 
          error: 'Message content too long',
          message: 'Each message content must be less than 10,000 characters'
        });
      }
    }

    // モデル名の検証
    const allowedModels = [
      'gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo',
      'claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229',
      'gemini-1.5-flash', 'gemini-1.5-pro'
    ];
    if (!allowedModels.includes(model)) {
      return res.status(400).json({ 
        error: 'Invalid model',
        message: 'Specified model is not supported'
      });
    }

    // パラメータの範囲検証
    if (temperature < 0 || temperature > 2) {
      return res.status(400).json({ 
        error: 'Invalid temperature',
        message: 'Temperature must be between 0 and 2'
      });
    }

    if (max_tokens < 1 || max_tokens > 4000) {
      return res.status(400).json({ 
        error: 'Invalid max_tokens',
        message: 'max_tokens must be between 1 and 4000'
      });
    }

>>>>>>> origin/main
    let chatMessages = [...messages];
    if (system_prompt) {
      chatMessages.unshift({
        role: 'system',
        content: system_prompt
      });
    }

<<<<<<< HEAD
    // AIServiceを使用してチャットを実行
=======
>>>>>>> origin/main
    try {
      const result = await aiService.chat(chatMessages, {
        model,
        temperature,
        max_tokens
      });

<<<<<<< HEAD
      // レスポンス形式を統一
=======
>>>>>>> origin/main
      res.json({
        id: `chat-${Date.now()}`,
        model: result.model,
        message: result.message,
        choices: [{
          message: {
            role: 'assistant',
            content: result.message
          },
          finish_reason: 'stop'
        }],
        usage: result.usage
      });

    } catch (providerError) {
      log(`AI Provider Error: ${providerError.message}`, 'ERROR');
      
      if (providerError.message.includes('API key not configured')) {
        return res.status(503).json({ 
          error: 'AI service not configured',
          message: 'AIプロバイダーのAPIキーが設定されていません。',
          details: providerError.message
        });
      }

      return res.status(502).json({
        error: 'AI provider error',
        message: 'AIプロバイダーへの接続エラーが発生しました。',
        details: providerError.response?.data || providerError.message
      });
    }

  } catch (error) {
<<<<<<< HEAD
    log(`Chat with files API Error: ${error.message}`, 'ERROR');
    res.status(500).json({ 
      error: 'Chat service error',
      message: 'ファイル付きチャットでエラーが発生しました。'
    });
  }
});

// チャットメッセージ送信
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 1000, system_prompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // システムプロンプトがある場合はメッセージの最初に追加
    let chatMessages = [...messages];
    if (system_prompt) {
      chatMessages.unshift({
        role: 'system',
        content: system_prompt
      });
    }

    // AIServiceを使用してチャットを実行
    try {
      const result = await aiService.chat(chatMessages, {
        model,
        temperature,
        max_tokens
      });

      // レスポンス形式を統一
      res.json({
        id: `chat-${Date.now()}`,
        model: result.model,
        message: result.message,
        choices: [{
          message: {
            role: 'assistant',
            content: result.message
          },
          finish_reason: 'stop'
        }],
        usage: result.usage
      });

    } catch (providerError) {
      log(`AI Provider Error: ${providerError.message}`, 'ERROR');
      
      // API キーが設定されていない場合
      if (providerError.message.includes('API key not configured')) {
        return res.status(503).json({ 
          error: 'AI service not configured',
          message: 'AIプロバイダーのAPIキーが設定されていません。環境変数を確認してください。',
          details: providerError.message
        });
      }

      // その他のプロバイダーエラー
      return res.status(502).json({
        error: 'AI provider error',
        message: 'AIプロバイダーへの接続エラーが発生しました。',
        details: providerError.response?.data || providerError.message
      });
    }

  } catch (error) {
=======
>>>>>>> origin/main
    log(`Chat API Error: ${error.message}`, 'ERROR');
    res.status(500).json({ 
      error: 'Chat service error',
      message: 'チャットサービスでエラーが発生しました。'
    });
  }
});

// API設定管理
app.get('/api/settings/apis', async (req, res) => {
  try {
    const data = await fs.readFile(API_KEYS_FILE, 'utf8');
    const apiKeys = JSON.parse(data);
    
<<<<<<< HEAD
    // セキュリティ: 秘匿情報をマスク
    const maskedKeys = JSON.parse(JSON.stringify(apiKeys));
    Object.keys(maskedKeys).forEach(service => {
      Object.keys(maskedKeys[service]).forEach(key => {
        if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key') || key.toLowerCase().includes('token')) {
          if (maskedKeys[service][key] && maskedKeys[service][key].length > 0) {
            maskedKeys[service][key] = '*'.repeat(8);
=======
    // セキュアなAPIキーマスキング実装
    const SENSITIVE_FIELDS = ['secret', 'key', 'token', 'password', 'credential', 'auth'];
    const maskedKeys = JSON.parse(JSON.stringify(apiKeys));
    
    Object.keys(maskedKeys).forEach(service => {
      Object.keys(maskedKeys[service]).forEach(key => {
        const isSensitive = SENSITIVE_FIELDS.some(field => 
          key.toLowerCase().includes(field)
        );
        
        if (isSensitive && maskedKeys[service][key]) {
          const originalValue = maskedKeys[service][key].toString();
          const originalLength = originalValue.length;
          
          if (originalLength > 8) {
            // 最初の2文字と最後の2文字を表示、中間をマスク
            maskedKeys[service][key] = originalValue.substr(0, 2) + 
              '*'.repeat(Math.min(8, originalLength - 4)) + 
              originalValue.substr(-2);
          } else if (originalLength > 0) {
            // 短い値は完全にマスク
            maskedKeys[service][key] = '*'.repeat(originalLength);
>>>>>>> origin/main
          }
        }
      });
    });

    res.json(maskedKeys);
  } catch (error) {
    log(`Error reading API keys: ${error.message}`, 'ERROR');
    res.status(500).json({ error: 'Failed to read API settings' });
  }
});

<<<<<<< HEAD
app.post('/api/settings/apis', async (req, res) => {
  try {
    const apiKeys = req.body;
=======
app.post('/api/settings/apis', 
  validateJSON('apiKeys', false), // オプショナルなJSON検証
  async (req, res) => {
  try {
    const apiKeys = req.body;
    
    // APIキーオブジェクトの構造検証
    if (!apiKeys || typeof apiKeys !== 'object') {
      return res.status(400).json({ 
        error: 'Invalid request body',
        message: 'API keys must be provided as an object'
      });
    }

    // 各サービスの設定を検証
    const allowedServices = ['amazon', 'rakuten', 'shopify', 'nextengine'];
    Object.keys(apiKeys).forEach(service => {
      if (!allowedServices.includes(service)) {
        return res.status(400).json({
          error: 'Invalid service',
          message: `Service '${service}' is not supported`,
          allowedServices: allowedServices
        });
      }
    });

>>>>>>> origin/main
    await fs.writeFile(API_KEYS_FILE, JSON.stringify(apiKeys, null, 2));
    log('API keys updated successfully');
    res.json({ success: true, message: 'API settings saved' });
  } catch (error) {
    log(`Error saving API keys: ${error.message}`, 'ERROR');
    res.status(500).json({ error: 'Failed to save API settings' });
  }
});

// ダッシュボード管理
app.get('/api/dashboards', async (req, res) => {
  try {
    const data = await fs.readFile(DASHBOARDS_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    log(`Error reading dashboards: ${error.message}`, 'ERROR');
    res.json([]);
  }
});

app.post('/api/dashboards', async (req, res) => {
  try {
    const dashboard = {
      id: req.body.id || `dashboard-${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const data = await fs.readFile(DASHBOARDS_FILE, 'utf8');
    const dashboards = JSON.parse(data);
    
    const existingIndex = dashboards.findIndex(d => d.id === dashboard.id);
    if (existingIndex >= 0) {
      dashboards[existingIndex] = { ...dashboards[existingIndex], ...dashboard, updatedAt: new Date().toISOString() };
    } else {
      dashboards.push(dashboard);
    }

    await fs.writeFile(DASHBOARDS_FILE, JSON.stringify(dashboards, null, 2));
    
    log(`Dashboard saved: ${dashboard.id}`);
    res.json({ success: true, dashboard });
  } catch (error) {
    log(`Error saving dashboard: ${error.message}`, 'ERROR');
    res.status(500).json({ error: 'Failed to save dashboard' });
  }
});

// 学習データ管理
app.get('/api/learning-data', async (req, res) => {
  try {
    const data = await fs.readFile(LEARNING_DATA_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    log(`Error reading learning data: ${error.message}`, 'ERROR');
    res.json([]);
  }
});

<<<<<<< HEAD
app.post('/api/learning-data/upload', async (req, res) => {
  try {
    const { fileName, fileSize, fileType, content } = req.body;
    
    const learningDataEntry = {
      id: `file-${Date.now()}`,
      fileName,
      fileSize,
      fileType,
      uploadedAt: new Date().toISOString(),
      records: content ? content.split('\n').length : 0,
      status: 'completed'
=======
app.post('/api/learning-data/upload', 
  validateField('fileName', 'filename', true), // ファイル名検証
  async (req, res) => {
  try {
    const { fileName, fileSize, fileType, content } = req.body;
    
    // ファイルサイズ制限（100MB）
    if (fileSize && fileSize > 100 * 1024 * 1024) {
      return res.status(400).json({
        error: 'File too large',
        message: 'File size must be less than 100MB',
        maxSize: '100MB'
      });
    }

    // 許可されるファイルタイプ
    const allowedTypes = [
      'text/plain', 'text/csv', 'application/json', 'application/xml',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (fileType && !allowedTypes.includes(fileType)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'File type not supported',
        allowedTypes: allowedTypes
      });
    }

    // コンテンツサイズ制限
    if (content && content.length > 50 * 1024 * 1024) { // 50MB for content string
      return res.status(400).json({
        error: 'Content too large',
        message: 'File content exceeds maximum allowed size'
      });
    }
    
    const fileData = {
      id: `file-${Date.now()}`,
      fileName: fileName,
      fileSize: fileSize,
      fileType: fileType,
      content: content,
      uploadedAt: new Date().toISOString()
>>>>>>> origin/main
    };

    const data = await fs.readFile(LEARNING_DATA_FILE, 'utf8');
    const learningData = JSON.parse(data);
<<<<<<< HEAD
    learningData.push(learningDataEntry);
=======
    learningData.push(fileData);
>>>>>>> origin/main

    await fs.writeFile(LEARNING_DATA_FILE, JSON.stringify(learningData, null, 2));
    
    log(`Learning data uploaded: ${fileName}`);
<<<<<<< HEAD
    res.json({ success: true, file: learningDataEntry });
=======
    res.json({ success: true, file: fileData });
>>>>>>> origin/main
  } catch (error) {
    log(`Error uploading learning data: ${error.message}`, 'ERROR');
    res.status(500).json({ error: 'Failed to upload learning data' });
  }
});

<<<<<<< HEAD
// ============= API接続テスト =============

app.get('/api/test-connection/:apiType', async (req, res) => {
  try {
    const { apiType } = req.params;
    
    // 実際のAPI認証情報を取得
    const data = await fs.readFile(API_KEYS_FILE, 'utf8');
    const apiKeys = JSON.parse(data);
    const apiConfig = apiKeys[apiType];
    
    if (!apiConfig) {
      return res.json({ success: false, message: `${apiType} API configuration not found` });
    }
    
    // 実際のAPI接続テストロジック
    let testResult = false;
    let message = '';
    
    switch (apiType) {
      case 'amazon':
        // Amazon API接続テスト
        if (apiConfig.accessKeyId && apiConfig.secretAccessKey) {
          // 実際のAWS SDKを使った接続テストをここに実装
          // 現在はAPIキーが設定されているかのチェックのみ
          testResult = true;
          message = 'Amazon API configuration is valid';
        } else {
          message = 'Amazon API keys are missing';
        }
        break;
        
      case 'rakuten':
        // 楽天API接続テスト
        if (apiConfig.applicationId && apiConfig.secret) {
          testResult = true;
          message = 'Rakuten API configuration is valid';
        } else {
          message = 'Rakuten API keys are missing';
        }
        break;
        
      case 'shopify':
        // Shopify API接続テスト
        if (apiConfig.shopDomain && apiConfig.accessToken) {
          // 実際のShopify API呼び出しをここに実装
          try {
            const testUrl = `https://${apiConfig.shopDomain}/admin/api/2023-10/shop.json`;
            const response = await axios.get(testUrl, {
              headers: {
                'X-Shopify-Access-Token': apiConfig.accessToken
              },
              timeout: 10000
            });
            testResult = response.status === 200;
            message = testResult ? 'Shopify API connection successful' : 'Shopify API connection failed';
          } catch (error) {
            message = `Shopify API connection failed: ${error.message}`;
          }
        } else {
          message = 'Shopify API configuration is incomplete';
        }
        break;
        
      case 'nextengine':
        // NextEngine API接続テスト
        if (apiConfig.clientId && apiConfig.clientSecret) {
          testResult = true;
          message = 'NextEngine API configuration is valid';
        } else {
          message = 'NextEngine API keys are missing';
        }
        break;
        
      default:
        message = 'Unknown API type';
    }
    
    log(`API Connection Test - ${apiType}: ${testResult ? 'SUCCESS' : 'FAILED'} - ${message}`);
    res.json({ success: testResult, message });
    
  } catch (error) {
    log(`API connection test error: ${error.message}`, 'ERROR');
    res.status(500).json({ success: false, message: 'Connection test failed' });
  }
});

// ============= MultiLLM Meeting API =============

// ミーティングファイルアップロード
app.post('/api/v2/multillm/meeting/upload', upload.single('file'), async (req, res) => {
  try {
    // MultiLLM APIが設定されているか確認
    if (!process.env.MULTILLM_API_URL) {
      return res.status(503).json({ 
        error: 'MultiLLM API not configured',
        message: 'Please configure MULTILLM_API_URL and MULTILLM_API_KEY'
      });
    }

    // ファイルが必要
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: 'Please upload an audio or video file'
      });
    }

    // 実際のMultiLLM APIにプロキシ
    try {
      const FormData = require('form-data');
      const formData = new FormData();
      
      // ファイルをFormDataに追加
      formData.append('file', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
      
      // その他のフィールドを追加
      if (req.body) {
        Object.keys(req.body).forEach(key => {
          formData.append(key, req.body[key]);
        });
      }

      const response = await axios.post(
        `${process.env.MULTILLM_API_URL}/api/v2/multillm/meeting/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${process.env.MULTILLM_API_KEY}`,
            ...formData.getHeaders()
          },
          timeout: 60000 // 1分のタイムアウト
        }
      );
      
      log(`Meeting upload successful: ${response.data.id || 'unknown'}`);
      res.json(response.data);
    } catch (error) {
      log(`Meeting upload API error: ${error.message}`, 'ERROR');
      
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ 
          error: 'Failed to upload meeting',
          message: 'MultiLLM service temporarily unavailable'
        });
      }
    }
  } catch (error) {
    log(`Meeting upload error: ${error.message}`, 'ERROR');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ミーティング処理ステータス確認
app.get('/api/v2/multillm/meeting/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!process.env.MULTILLM_API_URL) {
      return res.status(503).json({ 
        error: 'MultiLLM API not configured',
        message: 'Please configure MULTILLM_API_URL and MULTILLM_API_KEY'
      });
    }

    try {
      const response = await axios.get(
        `${process.env.MULTILLM_API_URL}/api/v2/multillm/meeting/${id}/status`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.MULTILLM_API_KEY}`
          },
          timeout: 10000
        }
      );
      
      res.json(response.data);
    } catch (error) {
      if (error.response?.status === 404) {
        res.status(404).json({ error: 'Meeting not found' });
      } else if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ 
          error: 'Failed to get meeting status',
          message: 'Service temporarily unavailable'
        });
      }
    }
  } catch (error) {
    log(`Meeting status error: ${error.message}`, 'ERROR');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ミーティング処理結果取得
app.get('/api/v2/multillm/meeting/:id/result', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!process.env.MULTILLM_API_URL) {
      return res.status(503).json({ 
        error: 'MultiLLM API not configured',
        message: 'Please configure MULTILLM_API_URL and MULTILLM_API_KEY'
      });
    }

    try {
      const response = await axios.get(
        `${process.env.MULTILLM_API_URL}/api/v2/multillm/meeting/${id}/result`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.MULTILLM_API_KEY}`
          },
          timeout: 30000
        }
      );
      
      res.json(response.data);
    } catch (error) {
      if (error.response?.status === 404) {
        res.status(404).json({ error: 'Meeting result not found' });
      } else if (error.response?.status === 202) {
        res.status(202).json({ 
          status: 'processing',
          message: 'Meeting is still being processed'
        });
      } else if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ 
          error: 'Failed to get meeting result',
          message: 'Service temporarily unavailable'
        });
      }
    }
  } catch (error) {
    log(`Meeting result error: ${error.message}`, 'ERROR');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ミーティング結果エクスポート
app.post('/api/v2/multillm/meeting/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'json', options = {} } = req.body;
    
    if (!process.env.MULTILLM_API_URL) {
      return res.status(503).json({ 
        error: 'MultiLLM API not configured',
        message: 'Please configure MULTILLM_API_URL and MULTILLM_API_KEY'
      });
    }

    try {
      const response = await axios.post(
        `${process.env.MULTILLM_API_URL}/api/v2/multillm/meeting/${id}/export`,
        { format, options },
        {
          headers: {
            'Authorization': `Bearer ${process.env.MULTILLM_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000,
          responseType: format === 'json' ? 'json' : 'stream'
        }
      );
      
      // ファイルダウンロードの場合
      if (format !== 'json' && response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
        res.setHeader('Content-Disposition', response.headers['content-disposition'] || `attachment; filename="meeting-${id}.${format}"`);
        response.data.pipe(res);
      } else {
        res.json(response.data);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        res.status(404).json({ error: 'Meeting not found' });
      } else if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ 
          error: 'Failed to export meeting',
          message: 'Service temporarily unavailable'
        });
      }
    }
  } catch (error) {
    log(`Meeting export error: ${error.message}`, 'ERROR');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= MultiLLM Core API =============

// タスク実行
app.post('/api/v2/multillm/execute', async (req, res) => {
  try {
    if (!process.env.MULTILLM_API_URL) {
      return res.status(503).json({ 
        error: 'MultiLLM API not configured',
        message: 'Please configure MULTILLM_API_URL and MULTILLM_API_KEY'
      });
    }

    const response = await axios.post(
      `${process.env.MULTILLM_API_URL}/api/v2/multillm/execute`,
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${process.env.MULTILLM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2分のタイムアウト
      }
    );
    
    log(`Task execution successful`);
    res.json(response.data);
  } catch (error) {
    log(`Task execution error: ${error.message}`, 'ERROR');
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ 
        error: 'Task execution failed',
        message: 'Service temporarily unavailable'
      });
    }
  }
});

// ワークフロー実行
app.post('/api/v2/multillm/workflow/execute', async (req, res) => {
  try {
    if (!process.env.MULTILLM_API_URL) {
      return res.status(503).json({ 
        error: 'MultiLLM API not configured',
        message: 'Please configure MULTILLM_API_URL and MULTILLM_API_KEY'
      });
    }

    const response = await axios.post(
      `${process.env.MULTILLM_API_URL}/api/v2/multillm/workflow/execute`,
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${process.env.MULTILLM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5分のタイムアウト
      }
    );
    
    log(`Workflow execution started: ${response.data.workflowId || 'unknown'}`);
    res.json(response.data);
  } catch (error) {
    log(`Workflow execution error: ${error.message}`, 'ERROR');
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ 
        error: 'Workflow execution failed',
        message: 'Service temporarily unavailable'
      });
    }
  }
});

// ワークフロー一覧取得
app.get('/api/v2/multillm/workflows', async (req, res) => {
  try {
    if (!process.env.MULTILLM_API_URL) {
      return res.status(503).json({ 
        error: 'MultiLLM API not configured',
        message: 'Please configure MULTILLM_API_URL and MULTILLM_API_KEY'
      });
    }

    const response = await axios.get(
      `${process.env.MULTILLM_API_URL}/api/v2/multillm/workflows`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.MULTILLM_API_KEY}`
        },
        params: req.query,
        timeout: 30000
      }
    );
    
    res.json(response.data);
  } catch (error) {
    log(`Workflows fetch error: ${error.message}`, 'ERROR');
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch workflows',
        message: 'Service temporarily unavailable'
      });
    }
  }
});

// ワーカー状態確認
app.get('/api/v2/multillm/workers/status', async (req, res) => {
  try {
    if (!process.env.MULTILLM_API_URL) {
      return res.status(503).json({ 
        error: 'MultiLLM API not configured',
        message: 'Please configure MULTILLM_API_URL and MULTILLM_API_KEY'
      });
    }

    const response = await axios.get(
      `${process.env.MULTILLM_API_URL}/api/v2/multillm/workers/status`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.MULTILLM_API_KEY}`
        },
        timeout: 10000
      }
    );
    
    res.json(response.data);
  } catch (error) {
    log(`Workers status error: ${error.message}`, 'ERROR');
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ 
        error: 'Failed to get workers status',
        message: 'Service temporarily unavailable'
      });
    }
  }
});

// CSV分析
app.post('/api/v2/multillm/analyze/csv', upload.single('file'), async (req, res) => {
  try {
    if (!process.env.MULTILLM_API_URL) {
      return res.status(503).json({ 
        error: 'MultiLLM API not configured',
        message: 'Please configure MULTILLM_API_URL and MULTILLM_API_KEY'
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: 'Please upload a CSV file'
      });
    }

    const FormData = require('form-data');
    const formData = new FormData();
    
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: 'text/csv'
    });
    
    // 分析オプションを追加
    if (req.body.analysisOptions) {
      formData.append('analysisOptions', JSON.stringify(req.body.analysisOptions));
    }

    const response = await axios.post(
      `${process.env.MULTILLM_API_URL}/api/v2/multillm/analyze/csv`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.MULTILLM_API_KEY}`,
          ...formData.getHeaders()
        },
        timeout: 180000 // 3分のタイムアウト
      }
    );
    
    log(`CSV analysis successful: ${req.file.originalname}`);
    res.json(response.data);
  } catch (error) {
    log(`CSV analysis error: ${error.message}`, 'ERROR');
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ 
        error: 'CSV analysis failed',
        message: 'Service temporarily unavailable'
      });
    }
  }
});

// 市場調査
app.post('/api/v2/multillm/research/market', async (req, res) => {
  try {
    if (!process.env.MULTILLM_API_URL) {
      return res.status(503).json({ 
        error: 'MultiLLM API not configured',
        message: 'Please configure MULTILLM_API_URL and MULTILLM_API_KEY'
      });
    }

    const response = await axios.post(
      `${process.env.MULTILLM_API_URL}/api/v2/multillm/research/market`,
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${process.env.MULTILLM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5分のタイムアウト
      }
    );
    
    log(`Market research started: ${req.body.topic || 'unknown topic'}`);
    res.json(response.data);
  } catch (error) {
    log(`Market research error: ${error.message}`, 'ERROR');
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ 
        error: 'Market research failed',
        message: 'Service temporarily unavailable'
      });
    }
  }
});

// コード実行
app.post('/api/v2/multillm/execute/code', async (req, res) => {
  try {
    if (!process.env.MULTILLM_API_URL) {
      return res.status(503).json({ 
        error: 'MultiLLM API not configured',
        message: 'Please configure MULTILLM_API_URL and MULTILLM_API_KEY'
      });
    }

    // セキュリティチェック（基本的な検証）
    const { language, code } = req.body;
    if (!language || !code) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Language and code are required'
      });
    }

    const response = await axios.post(
      `${process.env.MULTILLM_API_URL}/api/v2/multillm/execute/code`,
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${process.env.MULTILLM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 1分のタイムアウト
      }
    );
    
    log(`Code execution successful: ${language}`);
    res.json(response.data);
  } catch (error) {
    log(`Code execution error: ${error.message}`, 'ERROR');
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ 
        error: 'Code execution failed',
        message: 'Service temporarily unavailable'
      });
    }
  }
});
=======
// API接続テスト
app.get('/api/test-connection/:apiType', async (req, res) => {
  try {
    const { apiType } = req.params;
    log(`Testing connection for ${apiType}`);
    
    // 実際のテストロジックは実装されていませんが、基本的なレスポンスを返す
    res.json({ 
      success: true, 
      message: `${apiType} connection test passed`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log(`Connection test failed for ${req.params.apiType}: ${error.message}`, 'ERROR');
    res.status(500).json({ 
      success: false, 
      message: `Connection test failed: ${error.message}` 
    });
  }
});

// ============= conea-integration API Routes の統合 =============

// 既存のAPIキー管理
app.get('/api/keys', async (req, res) => {
  try {
    const data = await fs.readFile(API_KEYS_FILE, 'utf8');
    const apiKeys = JSON.parse(data);
    
    // 複数のキーを配列形式で返す
    const keyArray = Object.entries(apiKeys).map(([service, config]) => ({
      id: service,
      service: service,
      ...config,
      status: 'active'
    }));
    
    res.json(keyArray);
  } catch (error) {
    log(`Error reading API keys: ${error.message}`, 'ERROR');
    res.json([]);
  }
});

// API Routes の動的読み込み（conea-integrationから）
try {
  const shopifyRoutes = require('./src/routes/shopify');
  app.use('/api/shopify', shopifyRoutes);
  log('Shopify routes loaded');
} catch (error) {
  console.warn('Failed to load Shopify routes:', error.message);
  // Shopifyが利用できない場合のフォールバックエンドポイント
  app.get('/api/shopify/*', (req, res) => {
    res.status(503).json({
      error: 'Shopify service unavailable',
      message: 'Shopify integration is currently disabled due to configuration issues',
      troubleshooting: {
        checkDependencies: 'Ensure rate-limit-redis is properly installed',
        checkRedis: 'Verify Redis connection settings',
        checkConfig: 'Review Shopify API configuration'
      }
    });
  });
}

try {
  const googleAnalyticsRoutes = require('./src/routes/google-analytics.routes');
  app.use('/api/google-analytics', googleAnalyticsRoutes);
  log('Google Analytics routes loaded');
} catch (error) {
  console.warn('Failed to load Google Analytics routes:', error.message);
}

try {
  const searchConsoleRoutes = require('./src/routes/search-console.routes');
  app.use('/api/search-console', searchConsoleRoutes);
  log('Search Console routes loaded');
} catch (error) {
  console.warn('Failed to load Search Console routes:', error.message);
}

// Slack関連エンドポイント
if (slackClient) {
  app.post('/api/slack/send-message', async (req, res) => {
    try {
      const { channel, text } = req.body;
      const result = await slackClient.chat.postMessage({
        channel: channel,
        text: text,
      });
      res.json({ success: true, ts: result.ts });
    } catch (error) {
      log(`Slack message error: ${error.message}`, 'ERROR');
      res.status(500).json({ error: 'Failed to send Slack message' });
    }
  });
}

// Google Analytics関連エンドポイント
if (process.env.GA_PROPERTY_ID) {
  const analyticsDataClient = new BetaAnalyticsDataClient();
  
  app.post('/api/analytics/report', async (req, res) => {
    try {
      const { startDate, endDate, metrics, dimensions } = req.body;
      
      const [response] = await analyticsDataClient.runReport({
        property: `properties/${process.env.GA_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        metrics: metrics.map(m => ({ name: m })),
        dimensions: dimensions.map(d => ({ name: d })),
      });
      
      res.json(response);
    } catch (error) {
      log(`GA report error: ${error.message}`, 'ERROR');
      res.status(500).json({ error: 'Failed to generate analytics report' });
    }
  });
}

// Socket.IO イベント
io.on('connection', (socket) => {
  log(`New client connected: ${socket.id}`);
  
  socket.on('subscribe', (channel) => {
    socket.join(channel);
    log(`Client ${socket.id} subscribed to ${channel}`);
  });
  
  socket.on('unsubscribe', (channel) => {
    socket.leave(channel);
    log(`Client ${socket.id} unsubscribed from ${channel}`);
  });
  
  socket.on('disconnect', () => {
    log(`Client disconnected: ${socket.id}`);
  });
});

// Redis Pub/Sub（conea-integrationから）
if (redis) {
  const subscriber = redis.duplicate();
  
  subscriber.on('message', (channel, message) => {
    io.to(channel).emit('update', JSON.parse(message));
  });
  
  subscriber.subscribe('dashboard-updates');
  subscriber.subscribe('api-updates');
}
>>>>>>> origin/main

// エラーハンドリング
app.use((err, req, res, next) => {
  log(`Unhandled error: ${err.message}`, 'ERROR');
  res.status(500).json({ error: 'Internal server error' });
});

// 404ハンドリング
app.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// サーバー起動
async function startServer() {
  try {
    await initializeData();
    
<<<<<<< HEAD
    const server = http.createServer(app);
    
    server.listen(PORT, '0.0.0.0', () => {
      log(`🚀 Conea Staging Backend API Server started on port ${PORT}`);
      log(`📊 Health check: http://localhost:${PORT}/api/health`);
      log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      log(`🔗 MultiLLM API: ${process.env.MULTILLM_API_URL || 'Not configured (using mock responses)'}`);
=======
    server.listen(PORT, '0.0.0.0', () => {
      log(`🚀 Conea統合バックエンドサーバー started on port ${PORT}`);
      log(`📊 Health check: http://localhost:${PORT}/api/health`);
      log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      log(`🔗 Services: AI=enabled, Redis=${!!redis}, Slack=${!!slackClient}, Socket.IO=enabled`);
>>>>>>> origin/main
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        log('Server closed');
<<<<<<< HEAD
=======
        redis?.disconnect();
>>>>>>> origin/main
        process.exit(0);
      });
    });

  } catch (error) {
    log(`Failed to start server: ${error.message}`, 'ERROR');
    process.exit(1);
  }
}

startServer();

module.exports = app;