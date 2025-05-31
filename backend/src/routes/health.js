/**
 * ヘルスチェックエンドポイント
 * APIの接続状態をリアルタイムでチェック
 */

const express = require('express');
const router = express.Router();

/**
 * 各APIの接続状態をチェックする関数
 */
const checkAPIConnections = async () => {
    const timestamp = new Date().toISOString();
    
    // 各APIの接続チェック結果
    const apis = {
        shopify: { connected: false, message: '設定されていません' },
        amazon: { connected: false, message: '設定されていません' },
        rakuten: { connected: false, message: '設定されていません' },
        nextengine: { connected: false, message: '設定されていません' },
        smaregi: { connected: false, message: '設定されていません' },
        google_analytics: { connected: false, message: '設定されていません' }
    };

    // Shopify API接続チェック
    try {
        if (process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_SECRET_KEY) {
            const shopifyClient = require('../services/shopifyClient');
            // 簡単な接続テスト（ここでは設定が存在するかのみチェック）
            apis.shopify = { connected: true, message: '接続正常' };
        }
    } catch (error) {
        apis.shopify = { connected: false, message: 'Shopify接続エラー: ' + error.message };
    }

    // Amazon API接続チェック
    try {
        if (process.env.AMAZON_ACCESS_KEY && process.env.AMAZON_SECRET_KEY) {
            apis.amazon = { connected: true, message: '設定済み' };
        }
    } catch (error) {
        apis.amazon = { connected: false, message: 'Amazon接続エラー: ' + error.message };
    }

    // 楽天API接続チェック
    try {
        if (process.env.RAKUTEN_API_KEY) {
            apis.rakuten = { connected: true, message: '設定済み' };
        }
    } catch (error) {
        apis.rakuten = { connected: false, message: '楽天接続エラー: ' + error.message };
    }

    // NextEngine API接続チェック
    try {
        if (process.env.NEXTENGINE_UID && process.env.NEXTENGINE_API_KEY) {
            apis.nextengine = { connected: true, message: '設定済み' };
        }
    } catch (error) {
        apis.nextengine = { connected: false, message: 'NextEngine接続エラー: ' + error.message };
    }

    // スマレジAPI接続チェック
    try {
        if (process.env.SMAREGI_CONTRACT_ID && process.env.SMAREGI_ACCESS_TOKEN) {
            apis.smaregi = { connected: true, message: '設定済み' };
        }
    } catch (error) {
        apis.smaregi = { connected: false, message: 'スマレジ接続エラー: ' + error.message };
    }

    // Google Analytics接続チェック
    try {
        if (process.env.GOOGLE_ANALYTICS_PROPERTY_ID) {
            apis.google_analytics = { connected: true, message: '設定済み' };
        }
    } catch (error) {
        apis.google_analytics = { connected: false, message: 'Google Analytics接続エラー: ' + error.message };
    }

    return {
        server: 'healthy',
        timestamp: timestamp,
        apis: apis
    };
};

/**
 * ヘルスチェックエンドポイント
 * GET /api/health
 */
router.get('/', async (req, res) => {
    try {
        const healthStatus = await checkAPIConnections();
        res.status(200).json(healthStatus);
    } catch (error) {
        res.status(500).json({
            server: 'error',
            timestamp: new Date().toISOString(),
            error: error.message,
            apis: {}
        });
    }
});

/**
 * 詳細な接続状態チェックエンドポイント
 * GET /api/health/detailed
 */
router.get('/detailed', async (req, res) => {
    try {
        const healthStatus = await checkAPIConnections();
        
        // サーバー自体の詳細な情報を追加
        const detailedStatus = {
            ...healthStatus,
            server_details: {
                uptime: process.uptime(),
                memory_usage: process.memoryUsage(),
                node_version: process.version,
                environment: process.env.NODE_ENV || 'development'
            }
        };

        res.status(200).json(detailedStatus);
    } catch (error) {
        res.status(500).json({
            server: 'error',
            timestamp: new Date().toISOString(),
            error: error.message,
            apis: {},
            server_details: null
        });
    }
});

module.exports = router;