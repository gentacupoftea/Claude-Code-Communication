# Security Enhancement PR

## 概要
Shopify MCP Serverの包括的なセキュリティ強化実装

## 変更内容

### 🔐 新機能
- [ ] JWT認証の強化（有効期限、署名、スコープ検証）
- [ ] セキュリティヘッダーの実装（CSP, HSTS, X-Content-Type-Options等）
- [ ] CSRF対策の強化
- [ ] レート制限とブルートフォース防御
- [ ] 2要素認証（TOTP）サポート
- [ ] 脆弱性スキャナーの実装

### 📁 新規ファイル
- `src/security/security-manager.js` - セキュリティ管理クラス
- `src/security/security-middleware.js` - セキュリティミドルウェア
- `src/security/vulnerability-scanner.js` - 脆弱性スキャナー
- `src/security/implementation-example.js` - 実装例
- `docs/SECURITY_AUDIT_CHECKLIST.md` - 監査チェックリスト
- `docs/VULNERABILITY_RESPONSE_PROCESS.md` - 脆弱性対応プロセス

### 🔧 統合
- CSVプロセッサーとのセキュリティ統合
- GraphQL API最適化との連携
- 既存のエクスポート機能との互換性維持

## セキュリティ改善点

### OWASP Top 10対応
1. **Injection** - パラメータ化クエリ、入力検証
2. **Broken Authentication** - 強化されたJWT、2FA
3. **Sensitive Data Exposure** - 暗号化、HTTPS強制
4. **XXE** - XMLパーサーの安全な設定
5. **Broken Access Control** - RBAC実装
6. **Security Misconfiguration** - セキュリティヘッダー
7. **XSS** - 出力エンコーディング、CSP
8. **Insecure Deserialization** - 入力検証
9. **Known Vulnerabilities** - 依存関係スキャン
10. **Logging & Monitoring** - 包括的な監査ログ

## テスト

### 自動テスト
```bash
npm test -- --testPathPattern=security
```

### セキュリティスキャン
```bash
npm run security:scan
```

### 脆弱性チェック
```bash
npm audit
```

## パフォーマンスへの影響
- レート制限による最小限のオーバーヘッド
- Redisキャッシングによる効率的な処理
- 非同期処理による応答性の維持

## 破壊的変更
- なし（後方互換性を維持）

## チェックリスト
- [ ] コードがプロジェクトのスタイルガイドに従っている
- [ ] セルフレビューを実施した
- [ ] コメントを追加した（特に複雑な部分）
- [ ] ドキュメントを更新した
- [ ] 変更により新しい警告が発生しない
- [ ] テストを追加した
- [ ] すべてのテストがパスしている
- [ ] セキュリティスキャンを実行した

## レビュアー向け

### 重点レビューポイント
1. JWT実装のセキュリティ
2. 暗号化実装の正確性
3. レート制限の適切性
4. エラーハンドリング

### テスト方法
1. 認証フローのテスト
2. レート制限の動作確認
3. 脆弱性スキャナーの実行
4. パフォーマンステスト

## 関連Issues
- Fixes #[issue number]
- Addresses security audit findings from [date]

## Screenshots/Demos
該当なし（バックエンド実装）