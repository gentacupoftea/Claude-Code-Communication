# 🚨 緊急修復計画書

## 問題概要
backend/server.jsの深刻なマージコンフリクトと認証システムの重複実装により、フォールバックシステムが機能不全状態。

## 修復優先順位

### Phase 1: 即座の安定化 (緊急)
1. **マージコンフリクトの解決**
   - HEADとorigin/mainの統合
   - 重複コードの除去
   - 設定の一元化

2. **認証システムの統合**
   - NestJS認証とOAuth2の共存
   - エンドポイントの分離
   - 設定競合の解決

### Phase 2: 機能統合 (高優先)
1. **Redis設定の統一**
   - 接続プールの共有
   - 設定の一元管理

2. **ミドルウェアの最適化**
   - 重複CORS設定の解決
   - セキュリティ設定の統合

### Phase 3: システム強化 (中優先)
1. **エラーハンドリングの統合**
2. **ログシステムの一元化**
3. **モニタリングの統合**

## 具体的な修復手順

### 1. server.js統合版の作成
```javascript
// 統合版 server.js の構造
require('dotenv').config();
const { validateEnvironment } = require('./src/config/env-validation');

// 1. 環境変数検証（統合版）
const envCheck = validateEnvironment();
if (!envCheck.valid && process.env.NODE_ENV === 'production') {
  process.exit(1);
}

// 2. 統合ミドルウェア設定
app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true
}));

// 3. 認証システム統合
app.use('/auth', nestAuthRoutes);     // NestJS認証
app.use('/oauth', oauth2Routes);      // OAuth2認証
```

### 2. 認証システム統合アーキテクチャ
```
┌─────────────────┐
│   Frontend      │
└─────┬───────────┘
      │
      ▼
┌─────────────────┐
│  API Gateway    │ ← 統合エンドポイント
├─────────────────┤
│ /auth/*         │ ← NestJS (TypeORM)
│ /oauth/*        │ ← OAuth2 (Redis)
└─────────────────┘
```

### 3. Redis統合設定
```javascript
// 共有Redis接続
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100
});

// 用途別プレフィックス
// auth:tokens:*     ← OAuth2トークン
// auth:sessions:*   ← NestJSセッション
// cache:*           ← 一般キャッシュ
```

## 緊急対応コード

### A. 最小限動作版 server.js
```javascript
// 緊急用最小構成
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// 最低限のミドルウェア
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'emergency_mode',
    timestamp: new Date().toISOString()
  });
});

// フォールバック
app.use('*', (req, res) => {
  res.status(503).json({ 
    error: 'System under maintenance',
    message: 'Integration conflicts being resolved'
  });
});

app.listen(PORT, () => {
  console.log(`🚨 Emergency mode: Server running on port ${PORT}`);
});
```

### B. 設定統合スクリプト
```bash
#!/bin/bash
# fix-integration.sh

echo "🚨 緊急修復開始..."

# 1. バックアップ作成
cp backend/server.js backend/server.js.backup

# 2. コンフリクト解決
git checkout --theirs backend/server.js
git add backend/server.js

# 3. 統合版で上書き
cp emergency-server.js backend/server.js

# 4. 依存関係チェック
npm audit fix

echo "✅ 緊急修復完了"
```

## 検証項目

### 即座の確認事項
- [ ] サーバー起動の成功
- [ ] ヘルスチェックの応答
- [ ] CORS設定の動作
- [ ] 基本API機能

### 統合後の確認事項
- [ ] NestJS認証の動作
- [ ] OAuth2機能の動作
- [ ] Redis接続の安定性
- [ ] WebSocket接続

## リスク評価

### 高リスク
- データ損失の可能性（Redis設定変更時）
- 認証システムの一時停止

### 中リスク
- 既存セッションの無効化
- 設定不整合によるサービス断続

### 低リスク
- ログ出力の重複
- パフォーマンス一時低下

## 連絡体制

### エスカレーション
1. **即座**: 基本機能復旧
2. **30分以内**: 認証システム復旧
3. **1時間以内**: 完全統合完了

### 報告先
- PRESIDENT経由でアポロに状況報告
- 修復進捗の30分毎更新