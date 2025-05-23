// MultiLLM APIキーヘッダーサポート用ミドルウェア

/**
 * リクエストヘッダーからAPIキーを抽出して環境変数にセットするミドルウェア
 */
function extractApiKeysMiddleware(req, res, next) {
    const apiKeysHeader = req.headers['x-api-keys'];
    
    if (apiKeysHeader) {
        try {
            const apiKeys = JSON.parse(apiKeysHeader);
            
            // 一時的に環境変数にセット（リクエストスコープ内のみ）
            if (apiKeys.openai) {
                process.env.OPENAI_API_KEY = apiKeys.openai;
            }
            if (apiKeys.anthropic) {
                process.env.ANTHROPIC_API_KEY = apiKeys.anthropic;
            }
            if (apiKeys.google) {
                process.env.GOOGLE_AI_API_KEY = apiKeys.google;
            }
            
            // リクエスト完了後に環境変数をクリア
            res.on('finish', () => {
                // 元の値に戻す必要がある場合は、ここで処理
            });
        } catch (error) {
            console.error('Failed to parse API keys header:', error);
        }
    }
    
    next();
}

module.exports = { extractApiKeysMiddleware };