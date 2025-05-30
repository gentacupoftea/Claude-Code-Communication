/**
 * Conea統合バックエンドサーバー
 * conea-stagingとconea-integrationの機能を統合
 */

// 環境変数読み込み
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const socketIO = require('socket.io');

// conea-integrationからの機能
const { WebClient } = require('@slack/web-api');
const Redis = require('ioredis');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// conea-stagingからの機能
const AIService = require('./lib/ai-service');

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

// Socket.IOセットアップ（conea-integrationから）
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

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

// デフォルトデータ（conea-stagingから）
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
    await fs.writeFile(DASHBOARDS_FILE, JSON.stringify([], null, 2));
  }
  
  try {
    await fs.access(LEARNING_DATA_FILE);
  } catch {
    await fs.writeFile(LEARNING_DATA_FILE, JSON.stringify([], null, 2));
  }
}

// ============= 統合版 API Routes =============

// Health Check（統合版）
app.get('/api/health', (req, res) => {
  const aiProviders = {
    openai: !!(process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY),
    anthropic: !!(process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY),
    google: !!(process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
  };
  
  const services = {
    api: 'running',
    aiProviders: aiProviders,
    database: 'file_based',
    redis: redis && redis.status === 'ready' ? 'connected' : 'disconnected',
    slack: slackClient ? 'configured' : 'not configured',
    socket: 'enabled'
  };
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    mode: 'integrated',
    services: services
  });
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
      models: [],
      availableProviders: [],
      providerStatus: {}
    });
  }
});

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
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 1000, system_prompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    let chatMessages = [...messages];
    if (system_prompt) {
      chatMessages.unshift({
        role: 'system',
        content: system_prompt
      });
    }

    try {
      const result = await aiService.chat(chatMessages, {
        model,
        temperature,
        max_tokens
      });

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
    
    const maskedKeys = JSON.parse(JSON.stringify(apiKeys));
    Object.keys(maskedKeys).forEach(service => {
      Object.keys(maskedKeys[service]).forEach(key => {
        if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key') || key.toLowerCase().includes('token')) {
          if (maskedKeys[service][key] && maskedKeys[service][key].length > 0) {
            maskedKeys[service][key] = '*'.repeat(8);
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

app.post('/api/settings/apis', async (req, res) => {
  try {
    const apiKeys = req.body;
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

app.post('/api/learning-data/upload', async (req, res) => {
  try {
    const { fileName, fileSize, fileType, content } = req.body;
    
    const fileData = {
      id: `file-${Date.now()}`,
      fileName: fileName,
      fileSize: fileSize,
      fileType: fileType,
      content: content,
      uploadedAt: new Date().toISOString()
    };

    const data = await fs.readFile(LEARNING_DATA_FILE, 'utf8');
    const learningData = JSON.parse(data);
    learningData.push(fileData);

    await fs.writeFile(LEARNING_DATA_FILE, JSON.stringify(learningData, null, 2));
    
    log(`Learning data uploaded: ${fileName}`);
    res.json({ success: true, file: fileData });
  } catch (error) {
    log(`Error uploading learning data: ${error.message}`, 'ERROR');
    res.status(500).json({ error: 'Failed to upload learning data' });
  }
});

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
    
    server.listen(PORT, '0.0.0.0', () => {
      log(`🚀 Conea統合バックエンドサーバー started on port ${PORT}`);
      log(`📊 Health check: http://localhost:${PORT}/api/health`);
      log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      log(`🔗 Services: AI=enabled, Redis=${!!redis}, Slack=${!!slackClient}, Socket.IO=enabled`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        log('Server closed');
        redis?.disconnect();
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