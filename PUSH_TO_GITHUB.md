# GitHub へのプッシュ手順

## 1. GitHub Personal Access Token の作成

1. GitHub にログイン後、以下にアクセス:
   https://github.com/settings/tokens/new

2. 以下の設定で新しいトークンを作成:
   - Note: `shopify-mcp-server`
   - Expiration: 任意（90日など）
   - スコープ（権限）:
     - ✅ repo (全体)
     - ✅ workflow

3. トークンをコピー（一度しか表示されません）

## 2. リポジトリにプッシュ

ターミナルで以下のコマンドを実行:

```bash
cd /Users/mourigenta/shopify-mcp-server

# リモートオリジンの設定
git remote set-url origin https://gentacupoftea:YOUR_TOKEN@github.com/gentacupoftea/shopify-mcp-server.git

# プッシュ
git push -u origin main
```

**注意**: `YOUR_TOKEN` を実際のアクセストークンに置き換えてください。

## 3. 安全のためトークンを削除

プッシュ後は、セキュリティのため URL からトークンを削除:

```bash
git remote set-url origin https://github.com/gentacupoftea/shopify-mcp-server.git
```

## 4. 代替方法: SSH の使用

もし SSH キーを設定している場合:

```bash
git remote set-url origin git@github.com:gentacupoftea/shopify-mcp-server.git
git push -u origin main
```