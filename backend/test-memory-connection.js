// OpenMemory接続テスト用スクリプト
const http = require('http');

// シンプルなOpenMemory接続テスト
async function testOpenMemoryConnection() {
  console.log('🔍 OpenMemory接続テスト開始...');
  
  // テスト1: 基本接続
  console.log('\n1. 基本接続テスト');
  try {
    const response = await makeRequest('GET', '/health');
    console.log('✅ 基本接続: OK');
  } catch (error) {
    console.log('❌ 基本接続: FAILED -', error.message);
  }
  
  // テスト2: メモリ保存
  console.log('\n2. メモリ保存テスト');
  try {
    const memoryData = {
      app_id: "e8df73f3-bd96-437f-932a-dfecd1465815",
      user_id: "mourigenta",
      text: "Test memory from connection script"
    };
    
    const response = await makeRequest('POST', '/memories/', memoryData);
    console.log('✅ メモリ保存: OK -', response.id);
  } catch (error) {
    console.log('❌ メモリ保存: FAILED -', error.message);
  }
  
  // テスト3: メモリ取得
  console.log('\n3. メモリ取得テスト');
  try {
    const response = await makeRequest('GET', '/memories/?user_id=mourigenta&limit=5');
    if (response.memories) {
      console.log('✅ メモリ取得: OK -', response.memories.length, 'items');
    } else if (response.items) {
      console.log('✅ メモリ取得: OK -', response.items.length, 'items (legacy format)');
    } else {
      console.log('⚠️  メモリ取得: 空のレスポンス');
    }
  } catch (error) {
    console.log('❌ メモリ取得: FAILED -', error.message);
  }
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8765,
      path: `/api/v1${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            return;
          }
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (e) {
          reject(new Error(`Invalid JSON: ${responseData.substring(0, 100)}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Network error: ${e.message}`));
    });

    req.on('timeout', () => {
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// テスト実行
testOpenMemoryConnection().then(() => {
  console.log('\n🏁 テスト完了');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 テスト中にエラー:', error);
  process.exit(1);
});