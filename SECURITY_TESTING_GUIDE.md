# Security Testing Guide

このガイドでは、セキュリティ強化実装のローカルテスト手順を説明します。

## 準備

### 1. 依存関係のインストール

```bash
# セキュリティ関連の依存関係をインストール
npm install jsonwebtoken bcryptjs helmet cors joi speakeasy
npm install express-rate-limit rate-limiter-flexible
npm install ioredis winston uuid axios
npm install --save-dev nock jest supertest
```

### 2. Redisの起動

```bash
# Dockerを使用する場合
docker run -d -p 6379:6379 redis:alpine

# または、ローカルにインストールされている場合
redis-server
```

### 3. 環境変数の設定

`.env`ファイルを作成：

```env
# セキュリティ設定
JWT_SECRET=your-very-secure-jwt-secret-key-here
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Redis設定
REDIS_HOST=localhost
REDIS_PORT=6379

# Shopify設定
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your-access-token

# 開発設定
NODE_ENV=development
PORT=3000
```

## テスト実行

### 1. ユニットテスト

```bash
# セキュリティ関連のテストを実行
npm test -- --testPathPattern=security

# カバレッジレポート付き
npm test -- --coverage --testPathPattern=security
```

### 2. 統合テスト

```bash
# テストサーバーを起動
node src/security/implementation-example.js

# 別のターミナルで統合テストを実行
npm run test:integration
```

### 3. セキュリティスキャン

```bash
# 脆弱性スキャナーを実行
node scripts/run-security-scan.js

# npm脆弱性チェック
npm audit

# 依存関係の更新チェック
npm outdated
```

## 手動テスト

### 1. 認証フローのテスト

```bash
# ユーザー登録
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "SecurePassword123!",
    "email": "test@example.com"
  }'

# レスポンス例
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "abc123...",
  "totpQrCode": "otpauth://totp/..."
}
```

### 2. レート制限のテスト

```bash
# レート制限をテスト（連続リクエスト）
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username": "testuser", "password": "wrong"}' &
done

# 429エラーが返されることを確認
```

### 3. セキュリティヘッダーの確認

```bash
# セキュリティヘッダーをチェック
curl -I http://localhost:3000/api/health

# 期待されるヘッダー
HTTP/1.1 200 OK
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; ...
```

### 4. XSS対策のテスト

```bash
# XSSペイロードでテスト
curl -X GET "http://localhost:3000/api/search?q=<script>alert('XSS')</script>"

# サニタイズされたレスポンスを確認
```

### 5. CSRF保護のテスト

```bash
# CSRFトークンなしでPOSTリクエスト
curl -X POST http://localhost:3000/api/profile/update \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Name"}'

# 403エラーが返されることを確認
```

## パフォーマンステスト

### 1. レスポンスタイムの測定

```bash
# Apache Benchを使用
ab -n 1000 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/profile

# 結果を確認（セキュリティのオーバーヘッドが5ms以下）
```

### 2. メモリ使用量の監視

```bash
# Node.jsのメモリ使用量を監視
node --max-old-space-size=512 src/security/implementation-example.js

# 別のターミナルで
while true; do
  ps aux | grep node | grep -v grep
  sleep 5
done
```

## セキュリティ監査

### 1. 自動監査の実行

```bash
# セキュリティ監査チェックリストに基づく自動テスト
npm run security:audit

# レポートの確認
cat security-audit-report.json
```

### 2. 脆弱性スキャン

```bash
# OWASPベースのスキャン
node src/security/vulnerability-scanner.js \
  --target http://localhost:3000 \
  --output scan-report.json

# レポートの分析
cat scan-report.json | jq '.vulnerabilities[] | select(.severity == "high")'
```

## トラブルシューティング

### 一般的な問題と解決策

1. **Redisに接続できない**
   ```bash
   # Redisが起動しているか確認
   redis-cli ping
   
   # 接続をテスト
   redis-cli -h localhost -p 6379
   ```

2. **JWTエラー**
   ```bash
   # JWT秘密鍵の確認
   echo $JWT_SECRET
   
   # デバッグモードで実行
   DEBUG=security:* node src/security/implementation-example.js
   ```

3. **レート制限が機能しない**
   ```bash
   # Redisのキーを確認
   redis-cli KEYS "rl:*"
   
   # キャッシュをクリア
   redis-cli FLUSHDB
   ```

## 継続的なモニタリング

### ログの確認

```bash
# セキュリティログの監視
tail -f security.log | grep -E "(failed|error|warning)"

# アクセスログの分析
tail -f access.log | awk '{print $1}' | sort | uniq -c | sort -rn
```

### メトリクスの収集

```bash
# Prometheusメトリクスの確認
curl http://localhost:3000/metrics | grep security_

# Grafanaダッシュボードでの可視化
# （事前にPrometheusとGrafanaの設定が必要）
```

## ベストプラクティス

1. **定期的なテスト実行**
   - CI/CDパイプラインにセキュリティテストを統合
   - 週次でフルスキャンを実行

2. **アップデートの確認**
   - 依存関係の定期的な更新
   - セキュリティアドバイザリの監視

3. **ログの分析**
   - 異常なパターンの検出
   - 定期的なログレビュー

4. **ドキュメントの更新**
   - 新しい脅威に対する対策
   - テスト手順の改善

---

**最終更新**: 2024年1月
**作成者**: Shopify MCP Security Team