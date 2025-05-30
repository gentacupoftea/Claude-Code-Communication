#!/usr/bin/env node
/**
 * MultiLLM API 接続テストスクリプト
 * 
 * 使用方法:
 * node test-llm-apis.js [--provider <provider>] [--model <model>] [--verbose]
 * 
 * 例:
 * node test-llm-apis.js                    # 全プロバイダーをテスト
 * node test-llm-apis.js --provider openai  # OpenAIのみテスト
 * node test-llm-apis.js --model gpt-4      # 特定のモデルのみテスト
 * node test-llm-apis.js --verbose          # 詳細なログを表示
 */

require('dotenv').config();
const AIService = require('./lib/ai-service');
const axios = require('axios');

// コマンドライン引数の解析
const args = process.argv.slice(2);
const options = {
  provider: null,
  model: null,
  verbose: args.includes('--verbose') || args.includes('-v'),
  help: args.includes('--help') || args.includes('-h')
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--provider' && i + 1 < args.length) {
    options.provider = args[i + 1];
  } else if (args[i] === '--model' && i + 1 < args.length) {
    options.model = args[i + 1];
  }
}

// ヘルプ表示
if (options.help) {
  console.log(`
MultiLLM API 接続テストスクリプト

使用方法:
  node test-llm-apis.js [オプション]

オプション:
  --provider <name>   特定のプロバイダーのみテスト (openai, anthropic, google)
  --model <name>      特定のモデルのみテスト
  --verbose, -v       詳細なログを表示
  --help, -h          このヘルプを表示

例:
  node test-llm-apis.js                    # 全プロバイダーをテスト
  node test-llm-apis.js --provider openai  # OpenAIのみテスト
  node test-llm-apis.js --model gpt-4      # GPT-4のみテスト
  node test-llm-apis.js --verbose          # 詳細なログを表示
  `);
  process.exit(0);
}

// テスト用メッセージ
const TEST_MESSAGES = [
  { role: 'user', content: 'Hello! Please respond with a brief greeting.' }
];

// カラー出力用のヘルパー
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logVerbose(message) {
  if (options.verbose) {
    log(`  ${message}`, 'cyan');
  }
}

// APIキーの検証
function validateApiKey(key, provider) {
  if (!key) return false;
  if (key.includes('your_') || key.includes('_here')) return false;
  
  // 基本的な形式チェック
  switch (provider) {
    case 'openai':
      return key.startsWith('sk-');
    case 'anthropic':
      return key.startsWith('sk-ant-');
    case 'google':
      return key.length > 10; // Gemini APIキーは形式が様々
    default:
      return true;
  }
}

// レスポンス時間測定
async function measureResponseTime(testFunction) {
  const startTime = Date.now();
  try {
    const result = await testFunction();
    const endTime = Date.now();
    return {
      success: true,
      responseTime: endTime - startTime,
      result
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      success: false,
      responseTime: endTime - startTime,
      error
    };
  }
}

// プロバイダー別テスト
async function testProvider(aiService, providerName, provider) {
  log(`\n📡 Testing ${providerName.toUpperCase()} Provider`, 'blue');
  
  // APIキー検証
  const isKeyValid = validateApiKey(provider.apiKey, providerName);
  if (!isKeyValid) {
    log(`  ❌ Invalid or missing API key`, 'red');
    return { success: false, reason: 'Invalid API key' };
  }
  
  logVerbose(`API key format: Valid`);
  logVerbose(`Enabled: ${provider.enabled}`);
  logVerbose(`Models: ${provider.models.join(', ')}`);
  
  // 各モデルをテスト
  const results = {};
  
  for (const model of provider.models) {
    if (options.model && model !== options.model) {
      continue; // 特定のモデルが指定されている場合はスキップ
    }
    
    log(`  🤖 Testing model: ${model}`, 'yellow');
    
    const testResult = await measureResponseTime(async () => {
      return await aiService.chat(TEST_MESSAGES, { 
        model, 
        max_tokens: 50,
        temperature: 0.1 
      });
    });
    
    if (testResult.success) {
      log(`    ✅ Success (${testResult.responseTime}ms)`, 'green');
      logVerbose(`Response: ${testResult.result.message.substring(0, 100)}...`);
      logVerbose(`Usage: ${JSON.stringify(testResult.result.usage)}`);
      
      results[model] = {
        success: true,
        responseTime: testResult.responseTime,
        responseLength: testResult.result.message.length,
        usage: testResult.result.usage
      };
    } else {
      log(`    ❌ Failed (${testResult.responseTime}ms)`, 'red');
      log(`    Error: ${testResult.error.message}`, 'red');
      
      results[model] = {
        success: false,
        responseTime: testResult.responseTime,
        error: testResult.error.message
      };
    }
  }
  
  // プロバイダー全体の結果
  const successfulTests = Object.values(results).filter(r => r.success).length;
  const totalTests = Object.keys(results).length;
  
  return {
    success: successfulTests > 0,
    successRate: totalTests > 0 ? (successfulTests / totalTests) * 100 : 0,
    results
  };
}

// サーバー接続テスト
async function testServerEndpoints() {
  log(`\n🌐 Testing Server Endpoints`, 'blue');
  
  const baseUrl = `http://localhost:${process.env.PORT || 8000}`;
  const endpoints = [
    { path: '/api/health', method: 'GET' },
    { path: '/api/models', method: 'GET' },
    { path: '/api/providers/status', method: 'GET' }
  ];
  
  const results = {};
  
  for (const endpoint of endpoints) {
    try {
      logVerbose(`Testing ${endpoint.method} ${endpoint.path}`);
      
      const response = await axios({
        method: endpoint.method,
        url: `${baseUrl}${endpoint.path}`,
        timeout: 5000
      });
      
      log(`  ✅ ${endpoint.path} (${response.status})`, 'green');
      results[endpoint.path] = {
        success: true,
        status: response.status,
        data: response.data
      };
      
    } catch (error) {
      log(`  ❌ ${endpoint.path} (${error.response?.status || 'Connection failed'})`, 'red');
      results[endpoint.path] = {
        success: false,
        error: error.message
      };
    }
  }
  
  return results;
}

// 統計表示
function displayStatistics(allResults) {
  log(`\n📊 Test Statistics`, 'cyan');
  
  let totalTests = 0;
  let successfulTests = 0;
  let totalResponseTime = 0;
  let responseTimeCount = 0;
  
  Object.entries(allResults).forEach(([provider, result]) => {
    if (result.results) {
      Object.values(result.results).forEach(modelResult => {
        totalTests++;
        if (modelResult.success) {
          successfulTests++;
          totalResponseTime += modelResult.responseTime;
          responseTimeCount++;
        }
      });
    }
  });
  
  const successRate = totalTests > 0 ? (successfulTests / totalTests) * 100 : 0;
  const avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
  
  log(`  Total Tests: ${totalTests}`, 'white');
  log(`  Successful: ${successfulTests}`, 'green');
  log(`  Success Rate: ${successRate.toFixed(1)}%`, successRate > 80 ? 'green' : 'yellow');
  log(`  Average Response Time: ${avgResponseTime.toFixed(0)}ms`, 'white');
}

// メイン実行関数
async function main() {
  log('🚀 MultiLLM API Connection Test', 'cyan');
  log('================================', 'cyan');
  
  // AIService初期化
  const aiService = new AIService();
  const availableProviders = aiService.getAvailableProviders();
  const providerStatus = aiService.getProviderStatus();
  
  log(`\n📋 Configuration`, 'blue');
  log(`  Available Providers: ${availableProviders.join(', ') || 'None'}`, 'white');
  log(`  Test Mode: ${options.provider ? `Single provider (${options.provider})` : 'All providers'}`, 'white');
  log(`  Model Filter: ${options.model || 'All models'}`, 'white');
  log(`  Verbose: ${options.verbose}`, 'white');
  
  // プロバイダーがない場合の警告
  if (availableProviders.length === 0) {
    log(`\n⚠️  Warning: No AI providers are available!`, 'yellow');
    log(`  Please check your API key configuration in .env file.`, 'yellow');
    return;
  }
  
  // プロバイダーテスト実行
  const allResults = {};
  
  for (const [providerName, provider] of Object.entries(providerStatus)) {
    if (options.provider && providerName !== options.provider) {
      continue; // 特定のプロバイダーが指定されている場合はスキップ
    }
    
    if (!provider.available) {
      log(`\n⏭️  Skipping ${providerName}: Not available`, 'yellow');
      continue;
    }
    
    allResults[providerName] = await testProvider(aiService, providerName, provider);
  }
  
  // サーバーエンドポイントテスト
  try {
    const serverResults = await testServerEndpoints();
    allResults['server_endpoints'] = serverResults;
  } catch (error) {
    log(`\n⚠️  Server endpoint tests skipped: ${error.message}`, 'yellow');
  }
  
  // 結果表示
  displayStatistics(allResults);
  
  // 推奨事項
  log(`\n💡 Recommendations`, 'cyan');
  
  const failedProviders = Object.entries(allResults)
    .filter(([name, result]) => name !== 'server_endpoints' && !result.success)
    .map(([name]) => name);
  
  if (failedProviders.length > 0) {
    log(`  🔧 Check API key configuration for: ${failedProviders.join(', ')}`, 'yellow');
  }
  
  const slowProviders = Object.entries(allResults)
    .filter(([name, result]) => {
      if (name === 'server_endpoints' || !result.results) return false;
      const avgTime = Object.values(result.results)
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.responseTime, 0) / 
        Object.values(result.results).filter(r => r.success).length;
      return avgTime > 5000;
    })
    .map(([name]) => name);
  
  if (slowProviders.length > 0) {
    log(`  🐌 Consider optimizing slow providers: ${slowProviders.join(', ')}`, 'yellow');
  }
  
  if (availableProviders.length >= 2) {
    log(`  ✅ Multi-provider setup is ready for production`, 'green');
  }
  
  log(`\n✨ Test completed!`, 'cyan');
}

// 実行
if (require.main === module) {
  main().catch(error => {
    log(`\n💥 Test script failed: ${error.message}`, 'red');
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  });
}

module.exports = { testProvider, validateApiKey, measureResponseTime };