/**
 * Shopify接続テストスクリプト
 * 
 * 使用方法:
 * 1. .envファイルにShopify認証情報を設定
 * 2. node test-shopify-connection.js を実行
 */

require('dotenv').config();

console.log('🔍 Shopify接続テストを開始します...\n');

// 環境変数の確認
console.log('📋 環境変数の確認:');
console.log('SHOPIFY_STORE_DOMAIN:', process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_SHOP_NAME || '❌ 未設定');
console.log('SHOPIFY_ACCESS_TOKEN:', process.env.SHOPIFY_ACCESS_TOKEN ? '✅ 設定済み' : '❌ 未設定');
console.log('SHOPIFY_API_VERSION:', process.env.SHOPIFY_API_VERSION || 'デフォルト: 2024-01');
console.log('\n');

// テスト実行
async function testConnection() {
  try {
    const ShopifyClient = require('./src/services/shopifyClient');
    const client = new ShopifyClient();
    
    console.log('🔄 Shopify APIへの接続テスト中...\n');
    const result = await client.testConnection();
    
    if (result.success) {
      console.log('✅ 接続成功！\n');
      console.log('🏪 ショップ情報:');
      console.log(JSON.stringify(result.shop, null, 2));
    } else {
      console.error('❌ 接続失敗\n');
      console.error('エラー:', result.error);
      console.error('ステータス:', result.status);
      console.error('詳細:', JSON.stringify(result.details, null, 2));
      console.error('\n設定情報:', JSON.stringify(result.config, null, 2));
    }
  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
    console.error('\n💡 トラブルシューティング:');
    console.error('1. .envファイルが存在することを確認');
    console.error('2. SHOPIFY_STORE_DOMAINには店舗名のみを設定（例: mystore）');
    console.error('3. SHOPIFY_ACCESS_TOKENが有効なPrivate Appトークンであることを確認');
  }
}

testConnection();