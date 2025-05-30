const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function testAPIs() {
  console.log('🧪 新しいAPIのテスト開始...\n');
  
  // Google Analytics テスト
  try {
    const gaResponse = await axios.get(`${BASE_URL}/api/google-analytics/report?startDate=7daysAgo&endDate=today`);
    console.log('✅ Google Analytics API: 接続可能');
  } catch (error) {
    console.log('❌ Google Analytics API:', error.response?.status === 400 ? 'API設定が必要' : error.message);
  }
  
  // Search Console テスト
  try {
    const scResponse = await axios.get(`${BASE_URL}/api/search-console/analytics?startDate=2025-05-01&endDate=2025-05-29`);
    console.log('✅ Search Console API: 接続可能');
  } catch (error) {
    console.log('❌ Search Console API:', error.response?.status === 400 ? 'API設定が必要' : error.message);
  }
  
  // スマレジ テスト
  try {
    const srResponse = await axios.get(`${BASE_URL}/api/smaregi/products`);
    console.log('✅ スマレジ API: 接続可能');
  } catch (error) {
    console.log('❌ スマレジ API:', error.response?.status === 500 ? 'API設定が必要' : error.message);
  }
  
  console.log('\n📝 テスト完了！環境変数を設定してAPIを有効化してください。');
}

testAPIs();