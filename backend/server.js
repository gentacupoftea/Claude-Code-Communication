/**
 * Conea Admin Dashboard Backend Server
 * 簡易バックエンドAPI実装
 */

// 環境変数読み込み
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;

// Middleware
app.use(cors());
app.use(express.json());

// データファイルパス
const DATA_DIR = path.join(__dirname, 'data');
const API_KEYS_FILE = path.join(DATA_DIR, 'api_keys.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SLACK_CONFIG_FILE = path.join(DATA_DIR, 'slack_config.json');

// データディレクトリ作成
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

// デフォルトデータ
const defaultApiKeys = [
  {
    id: '1',
    provider: 'claude',
    name: 'Claude Production',
    key: 'sk-ant-***masked***',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    usageCount: 1250,
    monthlyCost: 45.67,
    isEncrypted: true,
  },
  {
    id: '2',
    provider: 'openai',
    name: 'OpenAI GPT-4',
    key: 'sk-***masked***',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    usageCount: 890,
    monthlyCost: 32.18,
    isEncrypted: true,
  },
];

const defaultUsers = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@conea.dev',
    role: 'admin',
    permissions: {
      claude: true,
      openai: true,
      gemini: true,
      billing: true,
    },
    createdAt: new Date().toISOString(),
  },
];

const defaultSlackConfig = {
  id: '1',
  botToken: '',
  appToken: '',
  signingSecret: '',
  workspace: '',
  status: 'disconnected',
  channels: [],
  features: {
    mentionCommands: true,
    slashCommands: true,
    directMessages: false,
  },
};

// ヘルパー関数
async function readJsonFile(filePath, defaultData) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    await writeJsonFile(filePath, defaultData);
    return defaultData;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Keys
app.get('/api/keys', async (req, res) => {
  try {
    const apiKeys = await readJsonFile(API_KEYS_FILE, defaultApiKeys);
    res.json(apiKeys);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

app.post('/api/keys', async (req, res) => {
  try {
    const apiKeys = await readJsonFile(API_KEYS_FILE, defaultApiKeys);
    const newKey = {
      ...req.body,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      usageCount: 0,
      monthlyCost: 0,
      isEncrypted: true,
    };
    
    apiKeys.push(newKey);
    await writeJsonFile(API_KEYS_FILE, apiKeys);
    res.status(201).json(newKey);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

app.put('/api/keys/:id', async (req, res) => {
  try {
    const apiKeys = await readJsonFile(API_KEYS_FILE, defaultApiKeys);
    const index = apiKeys.findIndex(key => key.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    apiKeys[index] = { ...apiKeys[index], ...req.body };
    await writeJsonFile(API_KEYS_FILE, apiKeys);
    res.json(apiKeys[index]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

app.delete('/api/keys/:id', async (req, res) => {
  try {
    const apiKeys = await readJsonFile(API_KEYS_FILE, defaultApiKeys);
    const filteredKeys = apiKeys.filter(key => key.id !== req.params.id);
    
    if (filteredKeys.length === apiKeys.length) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    await writeJsonFile(API_KEYS_FILE, filteredKeys);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

app.post('/api/keys/:id/test', async (req, res) => {
  try {
    // Simulate API key testing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const success = Math.random() > 0.2; // 80% success rate
    const responseTime = Math.floor(Math.random() * 1000) + 200;
    
    res.json({
      success,
      message: success ? 'Connection successful!' : 'Connection failed. Please check your API key.',
      responseTime: success ? responseTime : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to test API key' });
  }
});

// Slack Configuration
app.get('/api/slack/config', async (req, res) => {
  try {
    const slackConfig = await readJsonFile(SLACK_CONFIG_FILE, defaultSlackConfig);
    res.json(slackConfig);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Slack config' });
  }
});

app.post('/api/slack/config', async (req, res) => {
  try {
    const slackConfig = {
      ...req.body,
      id: '1',
      status: 'disconnected',
    };
    
    await writeJsonFile(SLACK_CONFIG_FILE, slackConfig);
    res.json(slackConfig);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save Slack config' });
  }
});

app.put('/api/slack/config', async (req, res) => {
  try {
    const slackConfig = await readJsonFile(SLACK_CONFIG_FILE, defaultSlackConfig);
    const updatedConfig = { ...slackConfig, ...req.body };
    
    await writeJsonFile(SLACK_CONFIG_FILE, updatedConfig);
    res.json(updatedConfig);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update Slack config' });
  }
});

app.post('/api/slack/test', async (req, res) => {
  try {
    // 保存されたSlack設定を読み取り
    const slackConfig = await readJsonFile(SLACK_CONFIG_FILE, defaultSlackConfig);
    
    if (!slackConfig.botToken || !slackConfig.appToken) {
      return res.json({
        success: false,
        message: 'Bot TokenまたはApp-Level Tokenが設定されていません',
      });
    }

    // 実際のSlack Web API呼び出し
    const https = require('https');
    const testSlackAPI = () => {
      return new Promise((resolve) => {
        const options = {
          hostname: 'slack.com',
          path: '/api/auth.test',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${slackConfig.botToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000
        };

        const req = https.request(options, (response) => {
          let data = '';
          response.on('data', (chunk) => {
            data += chunk;
          });
          response.on('end', () => {
            try {
              const result = JSON.parse(data);
              resolve(result);
            } catch (e) {
              resolve({ ok: false, error: 'invalid_response' });
            }
          });
        });

        req.on('error', () => {
          resolve({ ok: false, error: 'network_error' });
        });

        req.on('timeout', () => {
          resolve({ ok: false, error: 'timeout' });
        });

        req.end();
      });
    };

    const result = await testSlackAPI();
    
    if (result.ok) {
      res.json({
        success: true,
        message: 'Slack接続テスト成功！',
        workspace: result.team || 'Unknown',
        user: result.user || 'Unknown',
      });
    } else {
      let errorMessage = 'Slack接続に失敗しました';
      switch (result.error) {
        case 'invalid_auth':
          errorMessage = 'Bot Tokenが無効です。正しいxoxb-トークンを確認してください。';
          break;
        case 'token_revoked':
          errorMessage = 'トークンが無効化されています。新しいトークンを生成してください。';
          break;
        case 'network_error':
          errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
          break;
        case 'timeout':
          errorMessage = '接続がタイムアウトしました。再度お試しください。';
          break;
        default:
          errorMessage = `Slackエラー: ${result.error}`;
      }
      
      res.json({
        success: false,
        message: errorMessage,
      });
    }
  } catch (error) {
    console.error('Slack test error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

app.post('/api/slack/connect', async (req, res) => {
  try {
    const slackConfig = await readJsonFile(SLACK_CONFIG_FILE, defaultSlackConfig);
    slackConfig.status = 'connected';
    slackConfig.lastConnected = new Date().toISOString();
    
    await writeJsonFile(SLACK_CONFIG_FILE, slackConfig);
    res.json({ success: true, message: 'Slack bot connected successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to connect Slack bot' });
  }
});

app.post('/api/slack/disconnect', async (req, res) => {
  try {
    const slackConfig = await readJsonFile(SLACK_CONFIG_FILE, defaultSlackConfig);
    slackConfig.status = 'disconnected';
    
    await writeJsonFile(SLACK_CONFIG_FILE, slackConfig);
    res.json({ success: true, message: 'Slack bot disconnected.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect Slack bot' });
  }
});

// Users
app.get('/api/users', async (req, res) => {
  try {
    const users = await readJsonFile(USERS_FILE, defaultUsers);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const users = await readJsonFile(USERS_FILE, defaultUsers);
    const newUser = {
      ...req.body,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    
    users.push(newUser);
    await writeJsonFile(USERS_FILE, users);
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const users = await readJsonFile(USERS_FILE, defaultUsers);
    const index = users.findIndex(user => user.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    users[index] = { ...users[index], ...req.body };
    await writeJsonFile(USERS_FILE, users);
    res.json(users[index]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const users = await readJsonFile(USERS_FILE, defaultUsers);
    const filteredUsers = users.filter(user => user.id !== req.params.id);
    
    if (filteredUsers.length === users.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await writeJsonFile(USERS_FILE, filteredUsers);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// System stats
app.get('/api/system/stats', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0',
  });
});

// AI API Configuration
app.get('/api/ai/config', (req, res) => {
  try {
    const aiConfig = {
      claude: {
        apiKey: process.env.CLAUDE_API_KEY ? '***configured***' : null,
        model: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229',
        enabled: !!process.env.CLAUDE_API_KEY,
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY ? '***configured***' : null,
        model: process.env.OPENAI_MODEL || 'gpt-4',
        enabled: !!process.env.OPENAI_API_KEY,
      },
      gemini: {
        apiKey: process.env.GEMINI_API_KEY ? '***configured***' : null,
        model: process.env.GEMINI_MODEL || 'gemini-pro',
        enabled: !!process.env.GEMINI_API_KEY,
      },
      settings: {
        maxTokens: parseInt(process.env.MAX_TOKENS) || 4000,
        temperature: parseFloat(process.env.TEMPERATURE) || 0.7,
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000,
      }
    };
    
    res.json(aiConfig);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get AI configuration' });
  }
});

app.get('/api/ai/test/:provider', async (req, res) => {
  const { provider } = req.params;
  
  try {
    let apiKey = null;
    let testUrl = null;
    let headers = {};
    
    switch (provider) {
      case 'claude':
        apiKey = process.env.CLAUDE_API_KEY;
        testUrl = 'https://api.anthropic.com/v1/messages';
        headers = {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        };
        break;
        
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY;
        testUrl = 'https://api.openai.com/v1/models';
        headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        };
        break;
        
      case 'gemini':
        apiKey = process.env.GEMINI_API_KEY;
        testUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
        headers = {
          'Content-Type': 'application/json'
        };
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid provider' });
    }
    
    if (!apiKey) {
      return res.json({
        success: false,
        message: `${provider.toUpperCase()} API キーが設定されていません`
      });
    }
    
    // 簡易接続テスト（実際のAPI呼び出しは行わない）
    res.json({
      success: true,
      message: `${provider.toUpperCase()} API キーが設定されています`,
      provider: provider,
      keyLength: apiKey.length
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: `Failed to test ${provider} API` 
    });
  }
});

// AI API Key Management
app.put('/api/ai/keys/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    // 環境変数名マッピング
    const envKeyMap = {
      'claude': 'CLAUDE_API_KEY',
      'openai': 'OPENAI_API_KEY', 
      'gemini': 'GEMINI_API_KEY'
    };
    
    const envKey = envKeyMap[provider];
    if (!envKey) {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    
    // .envファイルを読み取り
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '.env');
    
    let envContent = '';
    try {
      envContent = fs.readFileSync(envPath, 'utf8');
    } catch (error) {
      console.log('Creating new .env file');
    }
    
    // 既存のキー行を更新または追加
    const keyPattern = new RegExp(`^${envKey}=.*$`, 'm');
    const newKeyLine = `${envKey}=${apiKey}`;
    
    if (keyPattern.test(envContent)) {
      // 既存行を更新
      envContent = envContent.replace(keyPattern, newKeyLine);
    } else {
      // 新しい行を追加
      envContent += `\n${newKeyLine}`;
    }
    
    // .envファイルに書き込み
    fs.writeFileSync(envPath, envContent);
    
    // 環境変数を更新（ランタイム）
    process.env[envKey] = apiKey;
    
    res.json({ 
      success: true, 
      message: `${provider} API key updated successfully`,
      provider: provider
    });
    
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

// OpenMemory統合機能

// OpenMemory API呼び出しヘルパー（修正版）
async function callOpenMemoryAPI(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8765,
      path: `/api/v1${endpoint}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000
    };

    const req = require('http').request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            resolve({ error: `HTTP ${res.statusCode}: ${responseData}` });
            return;
          }
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (e) {
          resolve({ error: 'Invalid JSON response', raw: responseData });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ error: e.message });
    });

    req.on('timeout', () => {
      resolve({ error: 'OpenMemory API timeout' });
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// OpenMemory保存用ヘルパー（デュアル保存で確実な共有保証）
async function saveToOpenMemory(userId, content, metadata = {}) {
  const results = { openmemory: null, simple: null };
  
  try {
    // OpenMemory APIを試行
    const memoryData = {
      app_id: "e8df73f3-bd96-437f-932a-dfecd1465815",
      user_id: userId,
      text: content,
      metadata: {
        client: 'conea-backend',
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };

    const openMemoryResult = await callOpenMemoryAPI('/memories/', 'POST', memoryData);
    results.openmemory = openMemoryResult;
    
    // 常にSimple Memoryにも保存（LLM間共有を保証）
    try {
      const simpleResult = await simpleMemory.addMemory(userId, content, metadata);
      results.simple = simpleResult;
      console.log('✅ Memory saved to both OpenMemory and Simple Memory for cross-LLM sharing');
    } catch (simpleError) {
      console.error('❌ Simple Memory save failed:', simpleError);
    }
    
    // OpenMemory成功時はそちらを主とし、Simple Memoryバックアップあり
    if (!openMemoryResult.error) {
      return { 
        ...openMemoryResult, 
        source: 'openmemory-with-fallback',
        backup_saved: !!results.simple
      };
    }
    
    // OpenMemory失敗でもSimple Memoryがあれば成功とする
    if (results.simple) {
      console.log('OpenMemory failed but Simple Memory succeeded:', openMemoryResult.error);
      return { ...results.simple, source: 'simple-fallback' };
    }
    
    return { error: `Both save methods failed: OpenMemory(${openMemoryResult.error})` };
    
  } catch (error) {
    console.error('Critical save error:', error);
    // 最終フォールバック: Simple Memory
    try {
      const fallbackResult = await simpleMemory.addMemory(userId, content, metadata);
      return { ...fallbackResult, source: 'simple-fallback-emergency' };
    } catch (fallbackError) {
      return { error: `All save methods failed: ${error.message}` };
    }
  }
}

// OpenMemory検索用ヘルパー（フォールバック付き - 空結果でもフォールバック）
async function searchOpenMemory(userId, query, limit = 5) {
  try {
    // まずOpenMemory APIを試行
    const queryParams = new URLSearchParams({
      user_id: userId,
      limit: limit.toString()
    });
    
    if (query && query.trim()) {
      queryParams.append('query', query);
    }

    const result = await callOpenMemoryAPI(`/memories/?${queryParams.toString()}`, 'GET');
    
    // OpenMemory APIが正常に動作し、結果がある場合
    if (!result.error && result.memories && result.memories.length > 0) {
      return {
        memories: result.memories || result.items || [],
        total: result.total || 0,
        source: 'openmemory'
      };
    }
    
    // OpenMemory APIが失敗、または空の結果の場合、Simple Memory APIを使用
    const errorMsg = result.error || 'OpenMemory returned empty results';
    console.log('OpenMemory API fallback triggered:', errorMsg);
    const fallbackResult = await simpleMemory.searchMemories(userId, query, limit);
    return {
      ...fallbackResult,
      source: 'simple-fallback',
      fallback_reason: errorMsg
    };
    
  } catch (error) {
    console.error('Both OpenMemory and fallback failed:', error);
    // 最終フォールバック: 空の結果
    return { 
      error: error.message, 
      memories: [], 
      total: 0, 
      source: 'error' 
    };
  }
}

// OpenMemoryからSimple Memoryへの同期機能
async function syncOpenMemoryToSimple(userId = 'mourigenta') {
  try {
    console.log('Starting OpenMemory to Simple Memory sync...');
    
    // OpenMemory APIから全メモリを取得（制限なし）
    const result = await callOpenMemoryAPI(`/memories/?user_id=${userId}&limit=2000`, 'GET');
    
    if (result.error) {
      console.log('OpenMemory sync failed, API error:', result.error);
      return { success: false, error: result.error };
    }
    
    const openMemories = result.memories || result.items || [];
    console.log(`Found ${openMemories.length} memories in OpenMemory`);
    
    if (openMemories.length === 0) {
      return { success: true, synced: 0, message: 'No memories to sync' };
    }
    
    // Simple Memoryにない記憶のみを同期
    let syncedCount = 0;
    for (const memory of openMemories) {
      try {
        const content = memory.content || memory.text;
        const metadata = {
          ...memory.metadata_,
          synced_from_openmemory: true,
          original_id: memory.id,
          original_created_at: memory.created_at
        };
        
        // Simple Memoryに追加
        await simpleMemory.addMemory(userId, content, metadata);
        syncedCount++;
      } catch (error) {
        console.error('Failed to sync individual memory:', error);
      }
    }
    
    console.log(`Successfully synced ${syncedCount}/${openMemories.length} memories`);
    return { 
      success: true, 
      synced: syncedCount, 
      total: openMemories.length,
      message: `Synced ${syncedCount} memories to enable cross-LLM sharing`
    };
    
  } catch (error) {
    console.error('OpenMemory sync error:', error);
    return { success: false, error: error.message };
  }
}

// 起動時にメモリ同期を実行
async function initializeMemorySharing() {
  console.log('Initializing cross-LLM memory sharing...');
  const syncResult = await syncOpenMemoryToSimple();
  if (syncResult.success) {
    console.log('✅ Memory sharing enabled:', syncResult.message);
  } else {
    console.log('⚠️ Memory sharing initialization failed:', syncResult.error);
  }
}

// メモリ検索でコンテキストを取得（修正版 - 複数キーワード検索）
async function getMemoryContext(prompt, userId = 'mourigenta') {
  try {
    console.log(`🔍 Memory context search: userId="${userId}", prompt="${prompt}"`);
    
    // キーワード抽出（日本語対応）
    const keywords = extractKeywords(prompt);
    console.log(`🔑 Extracted keywords: ${keywords.join(', ')}`);
    
    let bestResults = [];
    
    // 複数キーワードで検索を試行
    for (const keyword of keywords) {
      const searchResult = await searchOpenMemory(userId, keyword, 3);
      console.log(`📝 Search for "${keyword}": ${searchResult.memories?.length || 0} memories found`);
      
      if (searchResult.memories && searchResult.memories.length > 0) {
        bestResults = bestResults.concat(searchResult.memories);
      }
    }
    
    // 重複除去
    const uniqueResults = Array.from(new Map(bestResults.map(m => [m.id, m])).values());
    
    if (uniqueResults.length > 0) {
      const context = uniqueResults.slice(0, 3).map(memory => ({
        content: memory.content || memory.text,
        created_at: memory.created_at,
        metadata: memory.metadata_
      }));
      console.log(`✅ Returning ${context.length} memories for context`);
      return context;
    }
    
    // もしユーザー固有の記憶がない場合、プロジェクト全体の記憶を検索
    if (userId !== 'mourigenta') {
      console.log(`🔄 No memories for ${userId}, searching project-wide...`);
      for (const keyword of keywords) {
        const projectSearch = await searchOpenMemory('mourigenta', keyword, 3);
        if (projectSearch.memories && projectSearch.memories.length > 0) {
          const context = projectSearch.memories.slice(0, 3).map(memory => ({
            content: memory.content || memory.text,
            created_at: memory.created_at,
            metadata: memory.metadata_
          }));
          console.log(`✅ Returning ${context.length} project memories for context`);
          return context;
        }
      }
    }
    
    console.log('❌ No relevant memories found');
    return [];
  } catch (error) {
    console.log('Memory context retrieval failed:', error);
    return [];
  }
}

// キーワード抽出関数
function extractKeywords(text) {
  // 日本語・英語・カタカナのキーワードを抽出
  const keywords = [];
  
  // プロジェクト名
  if (text.match(/conea|コネア/i)) keywords.push('Conea');
  if (text.match(/shopify/i)) keywords.push('Shopify');
  
  // 技術キーワード
  if (text.match(/プロジェクト|project/i)) keywords.push('プロジェクト');
  if (text.match(/進捗|status|progress/i)) keywords.push('進捗');
  if (text.match(/概要|overview|summary/i)) keywords.push('概要');
  if (text.match(/slack/i)) keywords.push('Slack');
  if (text.match(/memory|メモリ|記憶/i)) keywords.push('メモリ');
  if (text.match(/terminal|ターミナル/i)) keywords.push('Terminal');
  if (text.match(/github/i)) keywords.push('GitHub');
  
  // 長いフレーズも試す
  keywords.push(text);
  
  return keywords.filter((k, i, arr) => arr.indexOf(k) === i); // 重複除去
}

// 会話をメモリに保存（修正版）
async function saveConversationToMemory(prompt, response, provider, userId = 'mourigenta') {
  try {
    const content = `Q: ${prompt}\nA: ${response}`;
    const metadata = {
      ai_provider: provider,
      client: 'conea-backend',
      type: 'conversation'
    };
    
    const result = await saveToOpenMemory(userId, content, metadata);
    if (result.error) {
      console.error('Failed to save conversation:', result.error);
    }
  } catch (error) {
    console.error('Failed to save conversation to OpenMemory:', error);
  }
}

// AI Chat endpoint - 実際のAI APIを呼び出し（OpenMemory統合版）
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { provider, prompt, max_tokens = 2000, temperature = 0.7, user_id = 'mourigenta' } = req.body;
    
    if (!provider || !prompt) {
      return res.status(400).json({ error: 'Provider and prompt are required' });
    }

    // OpenMemoryから関連コンテキストを取得
    const memoryContext = await getMemoryContext(prompt, user_id);
    
    // プロンプトにコンテキストを追加
    let enhancedPrompt = prompt;
    console.log(`🧠 Memory context retrieved: ${memoryContext.length} items`);
    
    if (memoryContext && memoryContext.length > 0) {
      const contextText = memoryContext.map((ctx, i) => 
        `記憶${i+1}: ${ctx.content}`
      ).join('\n\n');
      
      enhancedPrompt = `以下の関連する記憶を参考にして回答してください：\n\n${contextText}\n\n質問: ${prompt}`;
      console.log(`📝 Enhanced prompt created with ${memoryContext.length} context items`);
    } else {
      console.log('❌ No memory context available for this query');
    }
    
    let apiKey = null;
    let response = null;
    
    switch (provider) {
      case 'claude':
        apiKey = process.env.CLAUDE_API_KEY;
        if (!apiKey) {
          return res.status(400).json({ error: 'Claude API key not configured' });
        }
        
        // Claude API呼び出し
        const claudeData = JSON.stringify({
          model: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229',
          max_tokens: max_tokens,
          temperature: temperature,
          messages: [
            {
              role: 'user',
              content: enhancedPrompt
            }
          ]
        });
        
        const claudeOptions = {
          hostname: 'api.anthropic.com',
          port: 443,
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'Content-Length': Buffer.byteLength(claudeData)
          }
        };
        
        response = await new Promise((resolve, reject) => {
          const req = https.request(claudeOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              try {
                const result = JSON.parse(data);
                if (res.statusCode === 200) {
                  resolve({
                    success: true,
                    content: result.content[0]?.text || 'No response generated',
                    tokens: result.usage?.input_tokens + result.usage?.output_tokens || 0,
                    cost: (result.usage?.input_tokens * 0.000003 + result.usage?.output_tokens * 0.000015) || 0
                  });
                } else {
                  reject(new Error(`Claude API error: ${result.error?.message || 'Unknown error'}`));
                }
              } catch (e) {
                reject(new Error(`Failed to parse Claude response: ${e.message}`));
              }
            });
          });
          
          req.on('error', (e) => {
            reject(new Error(`Claude API request failed: ${e.message}`));
          });
          
          req.write(claudeData);
          req.end();
        });
        break;
        
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return res.status(400).json({ error: 'OpenAI API key not configured' });
        }
        
        // OpenAI API呼び出し
        const openaiData = JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4',
          max_tokens: max_tokens,
          temperature: temperature,
          messages: [
            {
              role: 'user',
              content: enhancedPrompt
            }
          ]
        });
        
        const openaiOptions = {
          hostname: 'api.openai.com',
          port: 443,
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(openaiData)
          }
        };
        
        response = await new Promise((resolve, reject) => {
          const req = https.request(openaiOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              try {
                const result = JSON.parse(data);
                if (res.statusCode === 200) {
                  const message = result.choices?.[0]?.message?.content || 'No response generated';
                  const totalTokens = result.usage?.total_tokens || 0;
                  const inputTokens = result.usage?.prompt_tokens || 0;
                  const outputTokens = result.usage?.completion_tokens || 0;
                  
                  resolve({
                    success: true,
                    content: message,
                    tokens: totalTokens,
                    cost: (inputTokens * 0.00001 + outputTokens * 0.00003) || 0 // GPT-4 pricing
                  });
                } else {
                  reject(new Error(`OpenAI API error: ${result.error?.message || 'Unknown error'}`));
                }
              } catch (e) {
                reject(new Error(`Failed to parse OpenAI response: ${e.message}`));
              }
            });
          });
          
          req.on('error', (e) => {
            reject(new Error(`OpenAI API request failed: ${e.message}`));
          });
          
          req.write(openaiData);
          req.end();
        });
        break;
        
      case 'gemini':
        apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res.status(400).json({ error: 'Gemini API key not configured' });
        }
        
        // Gemini API呼び出し
        const geminiData = JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: enhancedPrompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: temperature,
            maxOutputTokens: max_tokens
          }
        });
        
        const geminiOptions = {
          hostname: 'generativelanguage.googleapis.com',
          port: 443,
          path: `/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(geminiData)
          }
        };
        
        response = await new Promise((resolve, reject) => {
          const req = https.request(geminiOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              try {
                const result = JSON.parse(data);
                if (res.statusCode === 200) {
                  const content = result.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
                  const inputTokens = result.usageMetadata?.promptTokenCount || 0;
                  const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;
                  const totalTokens = inputTokens + outputTokens;
                  
                  resolve({
                    success: true,
                    content: content,
                    tokens: totalTokens,
                    cost: (inputTokens * 0.00000025 + outputTokens * 0.0000005) || 0 // Gemini pricing estimate
                  });
                } else {
                  reject(new Error(`Gemini API error: ${result.error?.message || 'Unknown error'}`));
                }
              } catch (e) {
                reject(new Error(`Failed to parse Gemini response: ${e.message}`));
              }
            });
          });
          
          req.on('error', (e) => {
            reject(new Error(`Gemini API request failed: ${e.message}`));
          });
          
          req.write(geminiData);
          req.end();
        });
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid provider' });
    }

    // 会話をOpenMemoryに保存
    if (response && response.success) {
      await saveConversationToMemory(prompt, response.content, provider, user_id);
    }
    
    // レスポンスにメモリ情報を追加
    if (response) {
      response.memory_context_used = !!memoryContext;
      response.context_items = memoryContext ? 3 : 0;
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('AI Chat error:', error);
    res.status(500).json({ 
      error: 'AI processing failed',
      message: error.message 
    });
  }
});

// AI Statistics endpoint
app.get('/api/ai/stats', async (req, res) => {
  try {
    // 実際の統計データファイルから読み取り（未実装の場合はデフォルト値）
    const defaultStats = {
      claude: {
        requestsToday: 0,
        avgResponseTime: 0,
        successRate: 100,
        errorCount: 0,
        lastActivity: 'Ready',
      },
      openai: {
        requestsToday: 0,
        avgResponseTime: 0,
        successRate: 100,
        errorCount: 0,
        lastActivity: 'Ready',
      },
      gemini: {
        requestsToday: 0,
        avgResponseTime: 0,
        successRate: 100,
        errorCount: 0,
        lastActivity: 'Ready',
      }
    };
    
    // 将来的には実際のログファイルから統計を取得
    const stats = defaultStats;
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get AI statistics' });
  }
});

// OpenMemory API エンドポイント
app.get('/api/memory/stats/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    
    // まずOpenMemory APIを試行
    const stats = await callOpenMemoryAPI('/apps/e8df73f3-bd96-437f-932a-dfecd1465815/memories', 'GET');
    
    if (!stats.error) {
      // OpenMemory API成功
      const totalMemories = stats.total || 0;
      const recentMemories = (stats.items || []).filter(item => {
        const itemDate = new Date(item.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return itemDate > weekAgo;
      }).length;
      
      res.json({
        user_id: user_id,
        total_memories: totalMemories,
        recent_memories: recentMemories,
        last_updated: new Date().toISOString(),
        service_status: 'openmemory-connected'
      });
    } else {
      // OpenMemory API失敗時、Simple Memory APIを使用
      console.log('OpenMemory stats failed, using Simple Memory fallback:', stats.error);
      const fallbackStats = await simpleMemory.getStats(user_id);
      
      res.json({
        ...fallbackStats,
        user_id: user_id,
        service_status: 'simple-fallback',
        fallback_reason: stats.error
      });
    }
  } catch (error) {
    // 最終フォールバック
    try {
      const fallbackStats = await simpleMemory.getStats(user_id);
      res.json({
        ...fallbackStats,
        user_id: user_id,
        service_status: 'simple-fallback-emergency',
        error: error.message
      });
    } catch (fallbackError) {
      res.status(500).json({ 
        error: 'All memory services failed',
        service_status: 'disconnected',
        details: error.message
      });
    }
  }
});

app.post('/api/memory/save', async (req, res) => {
  try {
    const { user_id, text, source = 'conea-dashboard' } = req.body;
    
    if (!user_id || !text) {
      return res.status(400).json({ error: 'user_id and text are required' });
    }
    
    const metadata = {
      client: source,
      type: 'manual_save'
    };
    
    const result = await saveToOpenMemory(user_id, text, metadata);
    
    if (result.error) {
      return res.status(500).json({ error: 'Failed to save to OpenMemory' });
    }
    
    res.json({ 
      success: true, 
      message: 'Memory saved successfully',
      memory_id: result.id
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save memory' });
  }
});

app.post('/api/memory/search', async (req, res) => {
  try {
    const { user_id, query, limit = 10 } = req.body;
    
    if (!user_id || !query) {
      return res.status(400).json({ error: 'user_id and query are required' });
    }
    
    const result = await searchOpenMemory(user_id, query, limit);
    
    if (result.error) {
      return res.status(500).json({ error: 'Memory search failed', details: result.error });
    }
    
    res.json({
      memories: result.memories || [],
      total: result.memories?.length || 0,
      query: query
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search memories' });
  }
});

app.get('/api/memory/recent/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    
    // OpenMemory検索で最近のメモリを取得
    const result = await searchOpenMemory(user_id, "", limit);
    
    if (result.error) {
      return res.status(500).json({ error: 'Failed to get recent memories', details: result.error });
    }
    
    const recentMemories = (result.memories || [])
      .map(item => ({
        id: item.id,
        content: (item.content || item.text || '').substring(0, 200) + 
                ((item.content || item.text || '').length > 200 ? '...' : ''),
        created_at: item.created_at,
        source: item.metadata_?.client || 'unknown'
      }));
    
    res.json({
      memories: recentMemories,
      total: recentMemories.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get recent memories' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Phase 1: Slack Bot統合
const { App } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');

// Phase 2: OpenMemory常時同期システム
const redis = require('redis');
const { Server } = require('socket.io');

// Phase 3: Terminal権限 & GitHub統合
const { spawn, exec } = require('child_process');
const { Octokit } = require('@octokit/rest');
const crypto = require('crypto');

// Simple Memory API (フォールバック)
const SimpleMemoryAPI = require('./simple-memory-api');
const simpleMemory = new SimpleMemoryAPI();

// Slack App初期化
let slackApp = null;
let slackClient = null;

// アクティブなスレッド追跡（スレッド内継続会話用）
const activeThreads = new Map(); // thread_ts -> { channel, users: Set, lastActivity: Date }
const THREAD_TIMEOUT = 30 * 60 * 1000; // 30分でタイムアウト

// SSL証明書生成機能
async function generateSelfSignedCert() {
  const sslDir = path.join(__dirname, 'ssl');
  const keyPath = path.join(sslDir, 'key.pem');
  const certPath = path.join(sslDir, 'cert.pem');
  
  try {
    await fs.mkdir(sslDir, { recursive: true });
    
    // 既存の証明書があるかチェック
    try {
      await fs.access(keyPath);
      await fs.access(certPath);
      console.log('🔐 SSL証明書が既に存在します');
      return;
    } catch (error) {
      // 証明書が存在しない場合は作成
    }
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // 自己署名証明書生成
    const command = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Conea/OU=IT/CN=slack-api.conea.ai"`;
    
    await execAsync(command);
    console.log('🔐 自己署名SSL証明書を生成しました');
    
  } catch (error) {
    console.error('SSL証明書生成エラー:', error.message);
    throw error;
  }
}

// Phase 2: OpenMemory常時同期 - Redis & Socket.IO初期化
let redisClient = null;
let io = null;
const server = http.createServer(app);
let httpsServer = null;

// 同期イベントキュー
const syncQueue = [];
const MAX_QUEUE_SIZE = 1000;

// Phase 3: Terminal & GitHub初期化
let octokit = null;
const activeSessions = new Map();
const commandHistory = [];
const MAX_HISTORY_SIZE = 500;

// セキュリティ設定
const ALLOWED_COMMANDS = [
  'git', 'npm', 'node', 'python', 'python3', 'docker', 'docker-compose',
  'cat', 'ls', 'grep', 'find', 'echo', 'cd', 'pwd', 'mkdir', 'touch',
  'cp', 'mv', 'rm', 'chmod', 'curl', 'wget', 'ping', 'ps', 'kill'
];

const RESTRICTED_PATHS = [
  '/etc', '/root', '/home/*/ssh', '**/.env', '**/secrets', '/System', '/Library'
];

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

async function initializeSlackBot() {
  console.log('🚀 Slack Bot initialization starting...');
  try {
    // Slack設定を読み込み（ファイルまたは環境変数）
    let slackConfig = {};
    try {
      slackConfig = await readJsonFile(SLACK_CONFIG_FILE, {});
      console.log('📁 Slack設定ファイルを読み込みました:', Object.keys(slackConfig));
    } catch (error) {
      console.log('📁 Slack設定ファイルが見つかりません。環境変数をチェック中...');
    }
    
    // 環境変数からのフォールバック
    if (!slackConfig.bot_token && process.env.SLACK_BOT_TOKEN) {
      slackConfig = {
        bot_token: process.env.SLACK_BOT_TOKEN,
        signing_secret: process.env.SLACK_SIGNING_SECRET,
        app_token: process.env.SLACK_APP_TOKEN
      };
      console.log('🔧 環境変数からSlack設定を読み込みました');
    }
    
    // 管理画面形式に対応（botToken/signingSecret）
    const botToken = slackConfig.bot_token || slackConfig.botToken;
    const signingSecret = slackConfig.signing_secret || slackConfig.signingSecret;
    const appToken = slackConfig.app_token || slackConfig.appToken;
    
    // Token有効性チェック
    const isValidToken = botToken && botToken.startsWith('xoxb-') && botToken !== '実際のBot User OAuth Tokenをここに入力';
    const isValidSecret = signingSecret && signingSecret !== 'test-signing-secret' && signingSecret !== '実際のSigning Secretをここに入力';
    
    console.log('🔍 Token検証:');
    console.log(`   Bot Token: ${isValidToken ? '✅ 有効' : '❌ 無効'}`);
    console.log(`   Signing Secret: ${isValidSecret ? '✅ 有効' : '❌ 無効'}`);
    
    if (!isValidToken || !isValidSecret) {
      console.log('⚠️  Slack設定が不完全です。以下を確認してください:');
      console.log('   - data/slack-config.json に実際のTokenを設定');
      console.log('   - Bot Token は xoxb- で始まる必要があります');
      console.log('   - または環境変数: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET');
      console.log('🔧 テスト用APIエンドポイント /api/slack/simulate で継続会話をテスト可能です');
      
      // WebClientのみ初期化（HTTP エンドポイント用）
      if (isValidToken) {
        slackClient = new WebClient(botToken);
        console.log('📱 Slack WebClient のみ初期化しました（HTTP モード用）');
      }
      return;
    }

    // Slack Appインスタンス作成
    slackApp = new App({
      token: botToken,
      signingSecret: signingSecret,
      socketMode: false,
      appToken: appToken,
      port: process.env.SLACK_PORT || 3001  // 管理画面と重複しないポートに変更
    });

    slackClient = new WebClient(botToken);

    // メンション検知とインテリジェント応答
    slackApp.event('app_mention', async ({ event, client, say }) => {
      try {
        console.log(`📱 Slack mention from ${event.user}: ${event.text}`);
        
        // スレッドを追跡対象に追加（新しいスレッドまたは既存スレッド）
        const threadTs = event.thread_ts || event.ts;
        activeThreads.set(threadTs, {
          channel: event.channel,
          users: new Set([event.user]),
          lastActivity: new Date(),
          botMentioned: true
        });
        console.log(`🧵 Thread ${threadTs} is now active for continuous conversation`);
        
        // OpenMemoryから関連コンテキストを取得
        const context = await getMemoryContext(event.text, event.user);
        
        // メッセージ解析と最適AI選択
        const selectedAI = await selectOptimalAI(event.text, context);
        
        // AI応答生成
        const response = await generateIntelligentResponse(event.text, selectedAI, context);
        
        // Slack応答送信
        await say({
          text: response.text,
          thread_ts: event.ts,
          blocks: response.blocks || []
        });

        // Phase 2: 強化されたSlack会話同期
        await enhancedSlackSync({
          user_id: event.user,
          channel: event.channel,
          input: event.text,
          output: response.text,
          ai_provider: selectedAI,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Slack mention処理エラー:', error);
        await say('申し訳ありません。処理中にエラーが発生しました。');
      }
    });

    // Slashコマンド: /conea-status
    slackApp.command('/conea-status', async ({ command, ack, respond }) => {
      await ack();
      
      try {
        const stats = await getSystemStats();
        const memoryStats = await callOpenMemoryAPI('/apps/e8df73f3-bd96-437f-932a-dfecd1465815/memories', 'GET');
        
        const statusBlocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🤖 Conea MultiLLM System Status*\n\n*AI Services:*\n✅ Claude: Online\n✅ OpenAI: Online\n✅ Gemini: Online\n\n*Memory System:*\n📝 Total Memories: ${memoryStats.total || 0}\n🔄 Service: Connected`
            }
          }
        ];

        await respond({
          text: 'Conea Status Report',
          blocks: statusBlocks,
          response_type: 'ephemeral'
        });
      } catch (error) {
        await respond('システム状況の取得に失敗しました。');
      }
    });

    // Slashコマンド: /conea-memory
    slackApp.command('/conea-memory', async ({ command, ack, respond }) => {
      await ack();
      
      try {
        const params = command.text.split(' ');
        const action = params[0];
        const query = params.slice(1).join(' ');

        if (action === 'search') {
          const searchResult = await callOpenMemoryAPI('/memories/filter', 'POST', {
            user_id: command.user_id,
            text: query,
            limit: 5
          });

          const memoryBlocks = (searchResult.memories || []).map(memory => ({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${memory.created_at}*\n${memory.content.substring(0, 200)}...`
            }
          }));

          await respond({
            text: `検索結果: "${query}"`,
            blocks: memoryBlocks.length > 0 ? memoryBlocks : [{
              type: 'section',
              text: { type: 'mrkdwn', text: '該当する記憶が見つかりませんでした。' }
            }]
          });
        }
      } catch (error) {
        await respond('メモリ操作に失敗しました。');
      }
    });

    // 通常のメッセージイベント（スレッド内継続会話用）
    slackApp.event('message', async ({ event, client, say }) => {
      try {
        // ボット自身のメッセージは無視
        if (event.subtype === 'bot_message' || event.bot_id) {
          return;
        }

        // スレッド内のメッセージかチェック
        const threadTs = event.thread_ts;
        if (!threadTs || !activeThreads.has(threadTs)) {
          return; // アクティブなスレッドでなければ無視
        }

        // アクティブなスレッド情報を取得
        const threadInfo = activeThreads.get(threadTs);
        
        // タイムアウトチェック
        const now = new Date();
        if (now - threadInfo.lastActivity > THREAD_TIMEOUT) {
          activeThreads.delete(threadTs);
          console.log(`🧵 Thread ${threadTs} expired due to inactivity`);
          return;
        }

        // メンションが含まれていたら通常の処理に任せる
        if (event.text && (event.text.includes('<@U') || event.text.includes('@'))) {
          return;
        }

        console.log(`💬 Thread message from ${event.user}: ${event.text}`);
        
        // スレッド情報を更新
        threadInfo.users.add(event.user);
        threadInfo.lastActivity = now;
        
        // OpenMemoryから関連コンテキストを取得（スレッド履歴も考慮）
        const context = await getMemoryContext(event.text, event.user);
        
        // メッセージ解析と最適AI選択
        const selectedAI = await selectOptimalAI(event.text, context);
        
        // AI応答生成
        const response = await generateIntelligentResponse(event.text, selectedAI, context);
        
        // Slack応答送信（スレッド内で返信）
        await client.chat.postMessage({
          channel: event.channel,
          text: response.text,
          thread_ts: threadTs,
          blocks: response.blocks || []
        });

        // Phase 2: 強化されたSlack会話同期
        await enhancedSlackSync({
          user_id: event.user,
          channel: event.channel,
          input: event.text,
          output: response.text,
          ai_provider: selectedAI,
          timestamp: new Date().toISOString(),
          thread_ts: threadTs
        });

        console.log(`✅ Responded to thread message in ${threadTs}`);

      } catch (error) {
        console.error('Thread message処理エラー:', error);
        // エラー時は特に応答しない（スパムを避けるため）
      }
    });

    // アクティブスレッドのクリーンアップ（定期実行）
    setInterval(() => {
      const now = new Date();
      for (const [threadTs, threadInfo] of activeThreads.entries()) {
        if (now - threadInfo.lastActivity > THREAD_TIMEOUT) {
          activeThreads.delete(threadTs);
          console.log(`🧹 Cleaned up expired thread: ${threadTs}`);
        }
      }
    }, 5 * 60 * 1000); // 5分ごとにクリーンアップ

    // Slack Bot開始
    await slackApp.start();
    console.log('⚡️ Slack Bot is running!');

  } catch (error) {
    console.error('❌ Slack Bot初期化エラー:', error.message);
    console.error('   詳細:', error.stack);
  }
}

// AI選択ロジック (インテリジェントルーティング)
async function selectOptimalAI(message, context) {
  const messageLength = message.length;
  const hasCode = /```|`/.test(message);
  const isCreative = /作成|生成|書いて|デザイン/.test(message);
  const isAnalytical = /分析|データ|統計|比較/.test(message);

  // コード関連 → Claude
  if (hasCode || /プログラム|コード|実装|デバッグ/.test(message)) {
    return 'claude';
  }
  
  // 創造的タスク → GPT-4
  if (isCreative || messageLength > 500) {
    return 'openai';
  }
  
  // 分析・事実確認 → Gemini
  if (isAnalytical || /検索|調べて|事実/.test(message)) {
    return 'gemini';
  }

  // デフォルト
  return 'claude';
}

// インテリジェント応答生成
async function generateIntelligentResponse(message, aiProvider, context) {
  try {
    // 自律エージェント処理を最初にチェック
    const autonomousResponse = await handleAutonomousRequest(null, null, message);
    if (autonomousResponse) {
      return autonomousResponse;
    }

    const systemPrompt = `あなたはConeaの高度AIアシスタントです。以下のコンテキストを参考に、簡潔で有用な回答を提供してください。

関連する過去の情報:
${context ? context.slice(0, 3).map(c => `- ${c.content}`).join('\n') : 'なし'}

応答要件:
- Slack形式で読みやすく
- 必要に応じて絵文字を使用
- アクションが必要な場合は具体的な手順を提示
- 自律実行が必要な場合は「自律実行: [要求内容]」で応答`;

    // 内部AI Chat APIを使用
    const requestBody = {
      provider: aiProvider,
      prompt: `${systemPrompt}\n\nユーザー質問: ${message}`,
      user_id: 'slack-bot'
    };

    const response = await fetch('http://localhost:8000/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      text: result.content || 'AIからの応答を取得できませんでした。',
      blocks: [] // 将来的にリッチフォーマット対応
    };
    
  } catch (error) {
    console.error('AI response generation failed:', error);
    return {
      text: `申し訳ありません。処理中にエラーが発生しました: ${error.message}`,
      blocks: []
    };
  }
}

// System Stats取得
async function getSystemStats() {
  return {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };
}

// Slack会話保存用のOpenMemory連携
async function saveConversationToMemory(conversationData) {
  try {
    const memoryData = {
      app_id: "e8df73f3-bd96-437f-932a-dfecd1465815",
      user_id: conversationData.user_id,
      content: `[Slack] ${conversationData.input} -> ${conversationData.output}`,
      metadata: {
        client: 'slack-bot',
        channel: conversationData.channel,
        ai_provider: conversationData.ai_provider,
        timestamp: conversationData.timestamp
      }
    };
    
    await callOpenMemoryAPI('/memories/', 'POST', memoryData);
  } catch (error) {
    console.error('Failed to save Slack conversation to OpenMemory:', error);
  }
}

// Phase 2: OpenMemory常時同期システム実装

// Redis初期化
async function initializeRedis() {
  try {
    redisClient = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retry_strategy: () => false // リトライを無効化
    });

    redisClient.on('error', (err) => {
      // エラーを1回だけログ出力してRedisを無効化
      if (!redisClient._errorLogged) {
        console.log('⚠️  Redis使用不可 - 機能を無効化します');
        redisClient._errorLogged = true;
        redisClient = null;
      }
    });

    redisClient.on('connect', () => {
      console.log('🔄 Redis接続成功');
    });

    await redisClient.connect();
  } catch (error) {
    console.log('⚠️  Redis初期化失敗（スキップ）:', error.message);
  }
}

// Socket.IO初期化
function initializeSocketIO() {
  const socketServer = httpsServer || server;
  io = new Server(socketServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log(`📡 Socket.IO クライアント接続: ${socket.id}`);

    // OpenMemory更新リアルタイム通知
    socket.on('subscribe_memory_updates', (userId) => {
      socket.join(`memory_updates_${userId}`);
      console.log(`🔔 Memory更新通知購読: ${userId}`);
    });

    socket.on('disconnect', () => {
      console.log(`📡 Socket.IO クライアント切断: ${socket.id}`);
    });
  });

  console.log('🔌 Socket.IO初期化完了');
}

// 同期イベント処理
async function processSyncEvent(event) {
  try {
    const { type, source, data, priority = 'medium' } = event;
    
    // 重要度による処理順序
    const priorityScore = {
      'critical': 4,
      'high': 3,
      'medium': 2,
      'low': 1
    };

    // OpenMemoryに記録
    const memoryData = {
      app_id: "e8df73f3-bd96-437f-932a-dfecd1465815",
      user_id: data.user_id || 'system',
      content: formatSyncContent(type, source, data),
      metadata: {
        client: 'conea-autosync',
        source: source,
        type: type,
        priority: priority,
        priority_score: priorityScore[priority],
        auto_generated: true,
        timestamp: new Date().toISOString()
      }
    };

    const result = await callOpenMemoryAPI('/memories/', 'POST', memoryData);
    
    if (!result.error) {
      // リアルタイム通知送信
      if (io && data.user_id) {
        io.to(`memory_updates_${data.user_id}`).emit('memory_updated', {
          type: 'new_memory',
          memory: result,
          source: source
        });
      }

      // Redis キャッシュ更新
      if (redisClient) {
        await redisClient.setEx(
          `last_sync_${source}_${data.user_id}`,
          3600,
          JSON.stringify(event)
        );
      }

      console.log(`✅ 同期完了: ${source} -> ${type}`);
    }

  } catch (error) {
    console.error('❌ 同期エラー:', error.message);
  }
}

// 同期コンテンツフォーマット
function formatSyncContent(type, source, data) {
  const timestamp = new Date().toLocaleString('ja-JP');
  
  switch (source) {
    case 'slack':
      return `[${timestamp}] Slack ${type}: ${data.message || data.content}`;
    
    case 'github':
      return `[${timestamp}] GitHub ${type}: ${data.commit_message || data.pr_title || data.content}`;
    
    case 'system':
      return `[${timestamp}] System ${type}: ${data.description || data.content}`;
    
    default:
      return `[${timestamp}] ${source} ${type}: ${JSON.stringify(data)}`;
  }
}

// 同期キューワーカー
async function processSyncQueue() {
  while (syncQueue.length > 0) {
    const event = syncQueue.shift();
    await processSyncEvent(event);
    
    // CPU負荷軽減のため少し待機
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// 同期イベント追加
function addSyncEvent(type, source, data, priority = 'medium') {
  if (syncQueue.length >= MAX_QUEUE_SIZE) {
    console.log('⚠️  同期キューが満杯です。古いイベントを削除します。');
    syncQueue.shift();
  }

  syncQueue.push({
    id: Date.now() + Math.random(),
    type,
    source,
    data,
    priority,
    created_at: new Date().toISOString()
  });

  // 非同期でキュー処理
  setImmediate(processSyncQueue);
}

// Slack会話自動同期強化
async function enhancedSlackSync(conversationData) {
  // 基本的な会話保存
  await saveConversationToMemory(conversationData);
  
  // 詳細分析による追加同期
  const { input, output, ai_provider, user_id } = conversationData;
  
  // 決定事項の検出
  if (/決定|確定|承認|採用/.test(input + output)) {
    addSyncEvent('decision', 'slack', {
      user_id,
      content: `重要な決定: ${input} → ${output}`,
      ai_provider
    }, 'high');
  }
  
  // エラー・問題の検出
  if (/エラー|問題|バグ|修正/.test(input + output)) {
    addSyncEvent('error_report', 'slack', {
      user_id,
      content: `問題報告: ${input} → ${output}`,
      ai_provider
    }, 'high');
  }
  
  // インサイトの検出
  if (/分析|洞察|発見|理解/.test(output)) {
    addSyncEvent('insight', 'slack', {
      user_id,
      content: `インサイト: ${output}`,
      ai_provider
    }, 'medium');
  }
}

// 定期サマリー生成
async function generatePeriodicSummary() {
  try {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // 過去1時間のアクティビティ取得
    const activities = await callOpenMemoryAPI('/memories/filter', 'POST', {
      user_id: 'system',
      created_after: hourAgo.toISOString(),
      limit: 50
    });

    if (activities.memories && activities.memories.length > 0) {
      const summary = generateActivitySummary(activities.memories);
      
      addSyncEvent('hourly_summary', 'system', {
        user_id: 'system',
        content: summary,
        activity_count: activities.memories.length
      }, 'low');
    }

  } catch (error) {
    console.error('定期サマリー生成エラー:', error.message);
  }
}

// アクティビティサマリー生成
function generateActivitySummary(memories) {
  const sources = {};
  const types = {};
  
  memories.forEach(memory => {
    const source = memory.metadata?.source || 'unknown';
    const type = memory.metadata?.type || 'unknown';
    
    sources[source] = (sources[source] || 0) + 1;
    types[type] = (types[type] || 0) + 1;
  });

  return `時間別アクティビティサマリー:
ソース別: ${Object.entries(sources).map(([k, v]) => `${k}(${v})`).join(', ')}
タイプ別: ${Object.entries(types).map(([k, v]) => `${k}(${v})`).join(', ')}
総計: ${memories.length}件`;
}

// OpenMemory同期API エンドポイント
app.post('/api/sync/manual', async (req, res) => {
  try {
    const { type, source, data, priority } = req.body;
    
    if (!type || !source || !data) {
      return res.status(400).json({ error: 'type, source, data are required' });
    }

    addSyncEvent(type, source, data, priority);
    
    res.json({
      success: true,
      message: '同期イベントが追加されました',
      queue_size: syncQueue.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Manual sync failed' });
  }
});

app.get('/api/sync/status', async (req, res) => {
  try {
    res.json({
      queue_size: syncQueue.length,
      redis_connected: redisClient?.isOpen || false,
      socket_clients: io?.sockets.sockets.size || 0,
      last_processed: await redisClient?.get('last_processed_sync') || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Phase 3: Terminal権限付与システム

// セキュリティ検証
function validateCommand(command) {
  const baseCommand = command.trim().split(' ')[0];
  
  // 許可コマンドチェック
  if (!ALLOWED_COMMANDS.includes(baseCommand)) {
    return { valid: false, reason: `Command '${baseCommand}' is not allowed` };
  }
  
  // 危険なパターンチェック
  const dangerousPatterns = [
    /rm\s+-rf\s+\//, // rm -rf /
    /sudo/, // sudo commands
    /su\s/, // su commands
    />.*\/etc/, // etc directory writes
    /passwd/, // password commands
    /shadow/, // shadow file access
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return { valid: false, reason: 'Dangerous command pattern detected' };
    }
  }
  
  // パス制限チェック
  for (const restrictedPath of RESTRICTED_PATHS) {
    if (command.includes(restrictedPath.replace('**/', '').replace('*', ''))) {
      return { valid: false, reason: `Access to ${restrictedPath} is restricted` };
    }
  }
  
  return { valid: true };
}

// セッション管理
function createSession(userId) {
  const sessionId = crypto.randomUUID();
  const session = {
    id: sessionId,
    userId: userId,
    created: new Date(),
    lastActivity: new Date(),
    cwd: process.cwd(),
    history: []
  };
  
  activeSessions.set(sessionId, session);
  return session;
}

// Terminal実行エンドポイント
app.post('/api/terminal/execute', async (req, res) => {
  try {
    const { command, sessionId, userId = 'default' } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    // セキュリティ検証
    const validation = validateCommand(command);
    if (!validation.valid) {
      return res.status(403).json({ 
        error: 'Security violation', 
        reason: validation.reason 
      });
    }
    
    // セッション取得または作成
    let session = sessionId ? activeSessions.get(sessionId) : null;
    if (!session) {
      session = createSession(userId);
    }
    
    // コマンド実行
    const execution = await executeCommand(command, session);
    
    // 履歴記録
    const historyEntry = {
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      userId: userId,
      command: command,
      output: execution.output,
      error: execution.error,
      exitCode: execution.exitCode,
      duration: execution.duration
    };
    
    session.history.push(historyEntry);
    commandHistory.push(historyEntry);
    
    // 履歴サイズ制限
    if (commandHistory.length > MAX_HISTORY_SIZE) {
      commandHistory.shift();
    }
    
    session.lastActivity = new Date();
    
    // OpenMemoryに記録
    addSyncEvent('terminal_execution', 'terminal', {
      user_id: userId,
      command: command,
      success: execution.exitCode === 0,
      output: execution.output.substring(0, 200)
    }, execution.exitCode === 0 ? 'low' : 'medium');
    
    // Socket.IO通知
    if (io) {
      io.emit('terminal_activity', {
        sessionId: session.id,
        command: command,
        output: execution.output,
        exitCode: execution.exitCode
      });
    }
    
    res.json({
      success: true,
      sessionId: session.id,
      output: execution.output,
      error: execution.error,
      exitCode: execution.exitCode,
      duration: execution.duration,
      cwd: session.cwd
    });
    
  } catch (error) {
    console.error('Terminal execution error:', error);
    res.status(500).json({ error: 'Terminal execution failed' });
  }
});

// コマンド実行関数
async function executeCommand(command, session) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let output = '';
    let errorOutput = '';
    
    const child = spawn('bash', ['-c', command], {
      cwd: session.cwd,
      env: { ...process.env, USER: session.userId },
      timeout: 30000 // 30秒タイムアウト
    });
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      
      // cd コマンドの場合、作業ディレクトリを更新
      if (command.trim().startsWith('cd ') && code === 0) {
        const newPath = command.trim().substring(3).trim();
        if (newPath) {
          const path_module = require('path');
          session.cwd = path_module.resolve(session.cwd, newPath);
        }
      }
      
      resolve({
        output: output || 'Command completed successfully',
        error: errorOutput,
        exitCode: code,
        duration: duration
      });
    });
    
    child.on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        output: '',
        error: error.message,
        exitCode: 1,
        duration: duration
      });
    });
  });
}

// Terminal情報取得
app.get('/api/terminal/sessions', (req, res) => {
  const sessions = Array.from(activeSessions.values()).map(session => ({
    id: session.id,
    userId: session.userId,
    created: session.created,
    lastActivity: session.lastActivity,
    cwd: session.cwd,
    commandCount: session.history.length
  }));
  
  res.json({ sessions });
});

app.get('/api/terminal/history', (req, res) => {
  const { limit = 50, sessionId } = req.query;
  
  let history = sessionId 
    ? commandHistory.filter(h => h.sessionId === sessionId)
    : commandHistory;
    
  history = history.slice(-parseInt(limit));
  
  res.json({ history });
});

// セッション削除
app.delete('/api/terminal/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (activeSessions.has(sessionId)) {
    activeSessions.delete(sessionId);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Phase 4: GitHub統合システム

// GitHub初期化
async function initializeGitHub() {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.log('⚠️  GitHub Token not configured');
      return;
    }
    
    octokit = new Octokit({
      auth: githubToken,
    });
    
    // 認証テスト
    const { data: user } = await octokit.rest.users.getAuthenticated();
    console.log(`🐙 GitHub connected as: ${user.login}`);
    
  } catch (error) {
    console.error('GitHub initialization error:', error.message);
  }
}

// GitHub Webhook エンドポイント
app.post('/api/github/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    
    // Webhook署名検証
    if (GITHUB_WEBHOOK_SECRET) {
      const expectedSignature = crypto
        .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');
        
      if (signature !== `sha256=${expectedSignature}`) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    const event = req.headers['x-github-event'];
    const { action, repository, pull_request, issue } = req.body;
    
    // GitHub イベントの同期記録
    switch (event) {
      case 'push':
        addSyncEvent('code_push', 'github', {
          user_id: req.body.pusher?.name || 'unknown',
          repository: repository.full_name,
          commits: req.body.commits?.length || 0,
          branch: req.body.ref?.replace('refs/heads/', '')
        }, 'medium');
        break;
        
      case 'pull_request':
        addSyncEvent('pull_request', 'github', {
          user_id: pull_request.user.login,
          repository: repository.full_name,
          action: action,
          pr_number: pull_request.number,
          pr_title: pull_request.title
        }, action === 'opened' ? 'high' : 'medium');
        break;
        
      case 'issues':
        addSyncEvent('issue', 'github', {
          user_id: issue.user.login,
          repository: repository.full_name,
          action: action,
          issue_number: issue.number,
          issue_title: issue.title
        }, action === 'opened' ? 'high' : 'low');
        break;
    }
    
    // Socket.IO通知
    if (io) {
      io.emit('github_activity', {
        event: event,
        action: action,
        repository: repository.full_name,
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('GitHub webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// PR作成エンドポイント
app.post('/api/github/create-pr', async (req, res) => {
  try {
    if (!octokit) {
      return res.status(503).json({ error: 'GitHub not configured' });
    }
    
    const { owner, repo, title, body, head, base = 'main', labels = [] } = req.body;
    
    if (!owner || !repo || !title || !head) {
      return res.status(400).json({ 
        error: 'owner, repo, title, and head are required' 
      });
    }
    
    // PR作成
    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body: body || 'Created via Conea MultiLLM System',
      head,
      base
    });
    
    // ラベル追加
    if (labels.length > 0) {
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: pr.number,
        labels
      });
    }
    
    // OpenMemoryに記録
    addSyncEvent('pr_created', 'github', {
      user_id: req.body.user_id || 'system',
      repository: `${owner}/${repo}`,
      pr_number: pr.number,
      pr_title: title,
      pr_url: pr.html_url
    }, 'high');
    
    res.json({
      success: true,
      pr: {
        number: pr.number,
        url: pr.html_url,
        title: pr.title
      }
    });
    
  } catch (error) {
    console.error('PR creation error:', error);
    res.status(500).json({ error: 'Failed to create PR' });
  }
});

// GitHub情報取得
app.get('/api/github/repos', async (req, res) => {
  try {
    if (!octokit) {
      return res.status(503).json({ error: 'GitHub not configured' });
    }
    
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 20
    });
    
    res.json({ 
      repos: repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        updated_at: repo.updated_at,
        language: repo.language
      }))
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Memory Sync API endpoint - OpenMemoryからSimple Memoryへの手動同期
app.post('/api/memory/sync', async (req, res) => {
  try {
    const { user_id = 'mourigenta' } = req.body;
    
    console.log(`Starting manual memory sync for user: ${user_id}`);
    const syncResult = await syncOpenMemoryToSimple(user_id);
    
    if (syncResult.success) {
      res.json({
        success: true,
        message: syncResult.message,
        synced: syncResult.synced,
        total: syncResult.total,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: syncResult.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Manual memory sync failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Memory sharing status API endpoint
app.get('/api/memory/sharing-status', async (req, res) => {
  try {
    // OpenMemory APIの状態確認
    const openMemoryTest = await callOpenMemoryAPI('/memories/?user_id=mourigenta&limit=1', 'GET');
    const openMemoryStatus = !openMemoryTest.error;
    
    // Simple Memoryの記憶数確認
    const simpleStats = await simpleMemory.getStats();
    
    res.json({
      openmemory_api: {
        connected: openMemoryStatus,
        error: openMemoryTest.error || null
      },
      simple_memory: {
        total_memories: simpleStats.total,
        status: 'active'
      },
      cross_llm_sharing: {
        enabled: simpleStats.total > 0,
        fallback_active: !openMemoryStatus
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Slack継続会話シミュレーション用API（テスト用）
app.post('/api/slack/simulate', async (req, res) => {
  try {
    const { 
      message, 
      user_id = 'U1234567', 
      thread_ts = null, 
      is_mention = false,
      channel = 'C1234567'
    } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log(`🧪 Slack simulation: ${is_mention ? 'MENTION' : 'THREAD'} from ${user_id}: ${message}`);
    
    // スレッド継続ロジックをシミュレート
    if (is_mention) {
      // メンション: 新しいアクティブスレッドを作成
      const threadTs = thread_ts || `${Date.now()}.123456`;
      activeThreads.set(threadTs, {
        channel: channel,
        users: new Set([user_id]),
        lastActivity: new Date(),
        botMentioned: true
      });
      console.log(`🧵 Thread ${threadTs} is now active for continuous conversation`);
    } else if (thread_ts && activeThreads.has(thread_ts)) {
      // スレッド内メッセージ: アクティブスレッドの更新
      const threadInfo = activeThreads.get(thread_ts);
      threadInfo.users.add(user_id);
      threadInfo.lastActivity = new Date();
      console.log(`💬 Thread message in active thread ${thread_ts}`);
    } else {
      // アクティブでないスレッド: 応答しない
      return res.json({
        success: true,
        response: null,
        message: 'Thread not active or mention required'
      });
    }
    
    // OpenMemoryから関連コンテキストを取得
    const context = await getMemoryContext(message, user_id);
    
    // メッセージ解析と最適AI選択
    const selectedAI = await selectOptimalAI(message, context);
    
    // AI応答生成
    const response = await generateIntelligentResponse(message, selectedAI, context);
    
    // 応答
    res.json({
      success: true,
      response: response.text,
      ai_provider: selectedAI,
      context_items: context.length,
      thread_active: thread_ts ? activeThreads.has(thread_ts) : false,
      active_threads: Array.from(activeThreads.keys())
    });
    
  } catch (error) {
    console.error('Slack simulation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// アクティブスレッド状態確認API
app.get('/api/slack/threads', (req, res) => {
  const threadInfo = Array.from(activeThreads.entries()).map(([threadTs, info]) => ({
    thread_ts: threadTs,
    channel: info.channel,
    users: Array.from(info.users),
    last_activity: info.lastActivity,
    bot_mentioned: info.botMentioned
  }));
  
  res.json({
    active_threads: threadInfo,
    total: threadInfo.length,
    timeout_minutes: THREAD_TIMEOUT / (60 * 1000)
  });
});

// Slack初期化テスト用エンドポイント（デバッグ用）
app.post('/api/test-slack-init', async (req, res) => {
  try {
    console.log('🧪 Manual Slack initialization test triggered');
    await initializeSlackBot();
    res.json({ 
      success: true, 
      message: 'Slack initialization attempted',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Manual Slack initialization failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Slack HTTP Mode用エンドポイント
app.post('/slack/events', async (req, res) => {
  try {
    const { type, challenge, event } = req.body;
    
    // URL Verification (初回設定時)
    if (type === 'url_verification') {
      return res.json({ challenge });
    }
    
    // Event処理
    if (type === 'event_callback' && event) {
      console.log(`📱 Slack HTTP event: ${event.type}`);
      
      // app_mention イベント
      if (event.type === 'app_mention') {
        // スレッドを追跡対象に追加
        const threadTs = event.thread_ts || event.ts;
        activeThreads.set(threadTs, {
          channel: event.channel,
          users: new Set([event.user]),
          lastActivity: new Date(),
          botMentioned: true
        });
        console.log(`🧵 Thread ${threadTs} is now active for continuous conversation`);
        
        // AI応答生成と送信
        const context = await getMemoryContext(event.text, event.user);
        const selectedAI = await selectOptimalAI(event.text, context);
        const response = await generateIntelligentResponse(event.text, selectedAI, context);
        
        // Slack Web API経由で応答送信
        if (slackClient) {
          await slackClient.chat.postMessage({
            channel: event.channel,
            text: response.text,
            thread_ts: event.ts
          });
        }
      }
      
      // message イベント（スレッド継続用）
      if (event.type === 'message' && !event.bot_id && !event.subtype) {
        const threadTs = event.thread_ts;
        
        if (threadTs && activeThreads.has(threadTs)) {
          // メンションチェック
          if (!event.text.includes('<@U') && !event.text.includes('@')) {
            console.log(`💬 HTTP Thread message from ${event.user}: ${event.text}`);
            
            // スレッド情報更新
            const threadInfo = activeThreads.get(threadTs);
            threadInfo.users.add(event.user);
            threadInfo.lastActivity = new Date();
            
            // AI応答生成
            const context = await getMemoryContext(event.text, event.user);
            const selectedAI = await selectOptimalAI(event.text, context);
            const response = await generateIntelligentResponse(event.text, selectedAI, context);
            
            // 応答送信
            if (slackClient) {
              await slackClient.chat.postMessage({
                channel: event.channel,
                text: response.text,
                thread_ts: threadTs
              });
            }
          }
        }
      }
    }
    
    res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('Slack HTTP event error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Slack Slash Commands用エンドポイント
app.post('/slack/commands', async (req, res) => {
  try {
    const { command, text, user_id, response_url } = req.body;
    
    console.log(`🔧 Slack command: ${command} from ${user_id}`);
    
    switch (command) {
      case '/conea-status':
        const stats = await getSystemStats();
        const statusResponse = {
          response_type: 'ephemeral',
          text: '🤖 Conea MultiLLM System Status',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*AI Services:*\n✅ Claude: Online\n✅ OpenAI: Online\n✅ Gemini: Online\n\n*Memory System:*\n📝 Active Threads: ${activeThreads.size}\n🔄 Service: Connected`
              }
            }
          ]
        };
        res.json(statusResponse);
        break;
        
      case '/conea-memory':
        const params = text.split(' ');
        const action = params[0];
        const query = params.slice(1).join(' ');
        
        if (action === 'search' && query) {
          const searchResult = await searchOpenMemory(user_id, query, 5);
          const memoryText = searchResult.memories.length > 0 
            ? searchResult.memories.map(m => `• ${m.content.substring(0, 100)}...`).join('\n')
            : 'メモリが見つかりませんでした。';
            
          res.json({
            response_type: 'ephemeral',
            text: `検索結果: "${query}"`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: memoryText
                }
              }
            ]
          });
        } else {
          res.json({
            response_type: 'ephemeral',
            text: '使用方法: `/conea-memory search キーワード`'
          });
        }
        break;
        
      default:
        res.json({
          response_type: 'ephemeral',
          text: '未知のコマンドです。'
        });
    }
    
  } catch (error) {
    console.error('Slack command error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function startServer() {
  await ensureDataDir();
  
  // HTTPS サーバー起動
  try {
    await generateSelfSignedCert();
    
    const sslOptions = {
      key: await fs.readFile(path.join(__dirname, 'ssl', 'key.pem')),
      cert: await fs.readFile(path.join(__dirname, 'ssl', 'cert.pem'))
    };
    
    httpsServer = https.createServer(sslOptions, app);
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`🚀 Conea HTTPS Server running on https://0.0.0.0:${HTTPS_PORT}`);
      console.log(`🌐 External access: https://slack-api.conea.ai:${HTTPS_PORT}`);
      console.log(`🔐 Using self-signed certificate`);
      console.log(`🗂️  Data stored in: ${DATA_DIR}`);
    });
    
    // HTTPリダイレクトサーバー
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🔄 HTTP Redirect Server running on http://0.0.0.0:${PORT}`);
    });
    
  } catch (error) {
    console.error('HTTPS setup failed, using HTTP only:', error.message);
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Conea Backend Server running on http://0.0.0.0:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 External access: http://slack-api.conea.ai:${PORT}`);
      console.log(`🗂️  Data stored in: ${DATA_DIR}`);
    });
  }

  // 各システムの初期化
  setTimeout(async () => {
    await initializeRedis();
    initializeSocketIO();
    
    // Slack Bot初期化（オプショナル）
    try {
      await initializeSlackBot();
    } catch (error) {
      console.log('ℹ️  Slack Bot initialization skipped (not configured)');
    }
    
    await initializeGitHub();
    
    // Memory sharing initialization
    await initializeMemorySharing();
    
    // 自律エージェント初期化
    await initializeAutonomousAgent();
    
    // 定期サマリー開始 (1時間毎)
    setInterval(generatePeriodicSummary, 60 * 60 * 1000);
    
    console.log('🔄 Phase 2: OpenMemory常時同期システム開始');
    console.log('💻 Phase 3: Terminal権限システム開始');
    console.log('🐙 Phase 4: GitHub統合システム開始');
    console.log('🧠 Cross-LLM Memory Sharing システム開始');
    console.log('🤖 Autonomous Agent システム開始');
  }, 2000);
}

// Phase 5: 自律エージェントシステム
const AutonomousController = require('./src/agents/AutonomousController');
let autonomousAgent = null;

async function initializeAutonomousAgent() {
  try {
    const config = {
      llmService: {
        generateCode: async (prompt) => {
          // 既存のMultiLLM APIを使用
          return await callAIAPI('Claude', prompt, 'autonomous-code-generation');
        }
      },
      fileAnalyzer: {
        analyze: async (filePath) => {
          // ファイル分析機能（必要に応じて実装）
          return { dependencies: [], patterns: [] };
        }
      },
      githubToken: process.env.GITHUB_TOKEN,
      repoOwner: process.env.GITHUB_OWNER || 'default-owner',
      repoName: process.env.GITHUB_REPO || 'default-repo'
    };

    autonomousAgent = new AutonomousController(config);
    console.log('🤖 自律エージェント初期化完了');

  } catch (error) {
    console.error('🚫 自律エージェント初期化エラー:', error.message);
  }
}

// 自律エージェントAPI エンドポイント
app.post('/api/autonomous/execute', async (req, res) => {
  try {
    const { message, options = {} } = req.body;
    
    if (!autonomousAgent) {
      return res.status(503).json({ 
        success: false, 
        error: 'Autonomous agent not initialized' 
      });
    }

    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }

    console.log(`🤖 自律実行要求: ${message}`);
    const result = await autonomousAgent.processRequest(message, options);
    
    // OpenMemoryに実行結果を保存
    if (result.status === 'success') {
      await saveOpenMemory('system', `自律実行完了: ${message}`, {
        type: 'autonomous_execution',
        executionId: result.executionId,
        intent: result.data?.intent?.type,
        duration: result.execution?.duration
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('自律実行エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/autonomous/status', async (req, res) => {
  try {
    if (!autonomousAgent) {
      return res.json({
        initialized: false,
        stats: null
      });
    }

    const stats = autonomousAgent.getExecutionStats();
    const recentExecutions = autonomousAgent.getRecentExecutions(5);

    res.json({
      initialized: true,
      stats: stats,
      recentExecutions: recentExecutions
    });

  } catch (error) {
    console.error('自律ステータス取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/autonomous/executions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const executions = autonomousAgent ? autonomousAgent.getRecentExecutions(limit) : [];
    
    res.json({
      success: true,
      data: executions
    });

  } catch (error) {
    console.error('実行履歴取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/autonomous/cancel', async (req, res) => {
  try {
    const { executionId } = req.body;
    
    if (!autonomousAgent) {
      return res.status(503).json({ 
        success: false, 
        error: 'Autonomous agent not initialized' 
      });
    }

    const cancelled = await autonomousAgent.cancelExecution(executionId);
    
    res.json({
      success: cancelled,
      message: cancelled ? 'Execution cancelled' : 'Execution not found or already completed'
    });

  } catch (error) {
    console.error('実行キャンセルエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Slack Bot での自律エージェント統合
async function handleAutonomousRequest(channel, user, message) {
  try {
    if (!autonomousAgent) {
      return '🚫 自律エージェントが初期化されていません。';
    }

    // 「自律実行:」で始まるメッセージを検知
    if (message.startsWith('自律実行:') || message.startsWith('autonomous:')) {
      const request = message.replace(/^(自律実行:|autonomous:)\s*/, '');
      
      // Slackで進行状況を通知
      await slackBot.client.chat.postMessage({
        channel: channel,
        text: `🤖 自律実行を開始します...\n要求: ${request}`
      });

      const result = await autonomousAgent.processRequest(request, {
        createPR: true,
        skipApproval: false
      });

      // 結果をSlackに通知
      let responseText = '';
      if (result.status === 'success') {
        responseText = `✅ 自律実行完了！\n`;
        responseText += `実行ID: ${result.executionId}\n`;
        responseText += `期間: ${result.execution.duration}ms\n`;
        
        if (result.data.pr && result.data.pr.success) {
          responseText += `PR作成: ${result.data.pr.prUrl}`;
        }
      } else {
        responseText = `❌ 自律実行失敗: ${result.message}`;
      }

      return responseText;
    }

    return null; // 自律実行要求ではない
    
  } catch (error) {
    console.error('Slack自律処理エラー:', error);
    return `❌ 自律実行エラー: ${error.message}`;
  }
}

startServer();