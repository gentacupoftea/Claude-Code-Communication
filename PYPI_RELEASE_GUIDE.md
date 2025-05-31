# PyPIリリースガイド v0.2.0

## リリース状況

✅ **完了項目**:
- GraphQLクエリ深度制限機能の実装
- パッケージビルドと検証
- twineチェックに合格

## PyPIアップロード手順

### 1. テストPyPIへのアップロード（オプション）
```bash
cd /Users/mourigenta/shopify-mcp-server
python3 -m twine upload --repository testpypi dist/*
```

### 2. 本番PyPIへのアップロード
```bash
cd /Users/mourigenta/shopify-mcp-server
python3 -m twine upload dist/*
```

### 3. インストールテスト
```bash
pip install --upgrade shopify-mcp-server
# またはテストPyPIから
# pip install --index-url https://test.pypi.org/simple/ shopify-mcp-server
```

## リリースチェックリスト

- [x] GraphQL深度制限実装
- [x] パッケージビルド
- [x] twine検証
- [ ] PyPIアップロード
- [ ] インストールテスト
- [ ] GitHubリリース作成
- [ ] リリースアナウンス

## 注意事項

1. PyPI認証情報が必要です
2. CI問題があるため、ローカルからの直接アップロードを実施
3. GitHubリリースと並行して進める

## タイムライン

- **5/28-30**: PyPIアップロードとテスト
- **5/31**: 正式リリースアナウンス