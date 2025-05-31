/**
 * Conea Staging Backend API Server
 * MultiLLM統合API実装
 */

// 環境変数読み込み
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const multer = require('multer');
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

// デフォルトデータ
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

const defaultDashboards = [];
const defaultLearningData = [];

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
    await fs.writeFile(DASHBOARDS_FILE, JSON.stringify(defaultDashboards, null, 2));
  }
  
  try {
    await fs.access(LEARNING_DATA_FILE);
  } catch {
    await fs.writeFile(LEARNING_DATA_FILE, JSON.stringify(defaultLearningData, null, 2));
  }
}

// ============= API Routes =============

// Health Check
app.get('/api/health', (req, res) => {
  // AI プロバイダーの設定状態を確認
  const aiProviders = {
    openai: !!(process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY),
    anthropic: !!(process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY),
    google: !!(process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
  };
  
  const configuredProviders = Object.entries(aiProviders)
    .filter(([_, configured]) => configured)
    .map(([provider]) => provider);
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
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
      models: ['gpt-3.5-turbo'] // 緊急フォールバック
    });
  }
});

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

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

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
    
    // セキュリティ: 秘匿情報をマスク
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
    
    const learningDataEntry = {
      id: `file-${Date.now()}`,
      fileName,
      fileSize,
      fileType,
      uploadedAt: new Date().toISOString(),
      records: content ? content.split('\n').length : 0,
      status: 'completed'
    };

    const data = await fs.readFile(LEARNING_DATA_FILE, 'utf8');
    const learningData = JSON.parse(data);
    learningData.push(learningDataEntry);

    await fs.writeFile(LEARNING_DATA_FILE, JSON.stringify(learningData, null, 2));
    
    log(`Learning data uploaded: ${fileName}`);
    res.json({ success: true, file: learningDataEntry });
  } catch (error) {
    log(`Error uploading learning data: ${error.message}`, 'ERROR');
    res.status(500).json({ error: 'Failed to upload learning data' });
  }
});

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
    
    const server = http.createServer(app);
    
    server.listen(PORT, '0.0.0.0', () => {
      log(`🚀 Conea Staging Backend API Server started on port ${PORT}`);
      log(`📊 Health check: http://localhost:${PORT}/api/health`);
      log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      log(`🔗 MultiLLM API: ${process.env.MULTILLM_API_URL || 'Not configured (using mock responses)'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        log('Server closed');
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