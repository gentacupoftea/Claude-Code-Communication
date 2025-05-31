# 認証システムテストガイド

## テスト実行方法

### 前提条件
```bash
# 依存関係のインストール
pip install -r requirements.txt

# テスト用データベースの準備
export DATABASE_URL="sqlite:///./test.db"
```

### 全テストの実行
```bash
# 認証システムの全テストを実行
pytest tests/auth/ -v

# カバレッジ付きで実行
pytest tests/auth/ --cov=src/auth --cov-report=html
```

### 個別テストの実行
```bash
# セキュリティサービスのテスト
pytest tests/auth/test_security_service.py -v

# 統合テスト
pytest tests/auth/test_enhanced_auth_flow.py -v

# セキュリティシナリオテスト
pytest tests/auth/test_security_scenarios.py -v
```

## テストカテゴリー

### 1. ユニットテスト (`test_security_service.py`)
- ✅ トークン生成
- ✅ パスワードポリシー検証
- ✅ アカウントロックアウト
- ✅ セッション管理
- ✅ 2FA機能
- ✅ 監査ログ

### 2. 統合テスト (`test_enhanced_auth_flow.py`)
- ✅ 完全な登録フロー（メール認証含む）
- ✅ ログインフロー（2FA含む）
- ✅ パスワード履歴
- ✅ セッション管理
- ✅ Remember Me機能

### 3. セキュリティシナリオ (`test_security_scenarios.py`)
- ✅ ブルートフォース攻撃防御
- ✅ タイミング攻撃防御
- ✅ セッションハイジャック防御
- ✅ CSRF防御
- ✅ SQLインジェクション防御
- ✅ XSS防御
- ✅ メール列挙防止

## 手動テストチェックリスト

### 基本認証フロー
- [ ] 新規ユーザー登録
- [ ] メール認証リンククリック
- [ ] ログイン（正しいパスワード）
- [ ] ログイン（間違ったパスワード）
- [ ] 5回失敗後のアカウントロック

### パスワード管理
- [ ] パスワード変更
- [ ] パスワードリセット要求
- [ ] リセットトークンでパスワード変更
- [ ] 弱いパスワードの拒否
- [ ] 過去のパスワード再利用防止

### 2FA設定
- [ ] 2FA有効化
- [ ] QRコードスキャン
- [ ] TOTPコード入力
- [ ] バックアップコード使用
- [ ] 2FAでのログイン

### セッション管理
- [ ] アクティブセッション一覧表示
- [ ] 特定セッションの無効化
- [ ] 全セッションからログアウト
- [ ] Remember Me有効時の長期セッション

### セキュリティ機能
- [ ] 連続ログイン失敗でのレート制限
- [ ] 異なるIPからのアクセス検知
- [ ] 監査ログの確認
- [ ] 期限切れトークンの拒否

## パフォーマンステスト

```bash
# 負荷テスト（locust使用）
locust -f tests/auth/performance/locustfile.py --host=http://localhost:8000

# 同時ログインテスト
python tests/auth/performance/concurrent_login_test.py
```

## セキュリティテスト

```bash
# セキュリティスキャン
bandit -r src/auth/

# 依存関係の脆弱性チェック
safety check

# SQLインジェクションテスト
sqlmap -u "http://localhost:8000/api/v1/auth/login" --data="username=test&password=test"
```

## デバッグ方法

### ログ確認
```python
# テスト実行時の詳細ログ
pytest tests/auth/ -v -s --log-cli-level=DEBUG

# 特定のテストのみデバッグ
pytest tests/auth/test_security_service.py::TestSecurityService::test_password_policy_validation -v -s
```

### データベース確認
```python
# テストDB内容確認
sqlite3 test.db
.tables
SELECT * FROM users;
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
```

## トラブルシューティング

### よくある問題

1. **ImportError**
   ```bash
   # パスを追加
   export PYTHONPATH="${PYTHONPATH}:/path/to/shopify-mcp-server"
   ```

2. **データベースエラー**
   ```bash
   # テストDBをリセット
   rm test.db
   alembic upgrade head
   ```

3. **レート制限エラー**
   ```python
   # テスト用にレート制限を無効化
   @limiter.limit("1000/minute")  # テスト環境用
   ```

## CI/CD統合

### GitHub Actions設定例
```yaml
name: Auth Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: 3.9
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
      - name: Run tests
        run: |
          pytest tests/auth/ --cov=src/auth
      - name: Upload coverage
        uses: codecov/codecov-action@v1
```

## テスト結果の解釈

### カバレッジ目標
- 全体: 80%以上
- コアセキュリティ機能: 95%以上
- エッジケース: 70%以上

### パフォーマンス基準
- ログイン応答: < 200ms
- トークン検証: < 50ms
- セッション確認: < 30ms

### セキュリティ基準
- パスワードハッシュ: bcrypt/argon2
- トークン長: 32文字以上
- セッション有効期限: 24時間以内