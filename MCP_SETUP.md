# Shopify MCP Server - Claude Desktop Setup Guide

## 前提条件

1. Claude Desktop アプリがインストールされている
2. Node.js 16+ がインストールされている
3. Python 3.9+ がインストールされている

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/gentacupoftea/shopify-mcp-server.git
cd shopify-mcp-server
```

### 2. 依存関係のインストール

```bash
# Python依存関係
pip install -r requirements.txt

# Node.js依存関係（必要な場合）
cd frontend && npm install && cd ..
```

### 3. 環境変数の設定

```bash
cp .env.example .env
```

`.env`ファイルを編集して必要な値を設定：

```env
# Shopify設定
SHOPIFY_API_KEY=your-api-key
SHOPIFY_API_SECRET=your-api-secret
SHOPIFY_ACCESS_TOKEN=your-access-token
SHOPIFY_SHOP_URL=your-shop.myshopify.com

# データベース設定
DATABASE_URL=sqlite:///./shopify_mcp.db

# セキュリティ設定
SECRET_KEY=your-secret-key-here
```

### 4. MCPサーバーの起動

```bash
# 開発モード
python -m shopify-mcp-server

# または
uvicorn src.main:app --reload --port 8000
```

### 5. Claude Desktopへの追加

Claude Desktopの設定ファイルを編集：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

以下の設定を追加：

```json
{
  "mcpServers": {
    "shopify-mcp": {
      "command": "python",
      "args": ["-m", "shopify-mcp-server"],
      "cwd": "/Users/mourigenta/shopify-mcp-server",
      "env": {
        "PYTHONPATH": "/Users/mourigenta/shopify-mcp-server",
        "DATABASE_URL": "sqlite:///./shopify_mcp.db"
      }
    }
  }
}
```

### 6. Claude Desktopを再起動

設定を反映させるため、Claude Desktopアプリを完全に終了して再起動してください。

## 利用可能な機能

MCPサーバーが正常に接続されると、以下の機能が利用可能になります：

### Shopify操作
- 商品の取得・作成・更新
- 注文の管理
- 顧客情報の取得
- 在庫管理

### 認証機能
- ユーザー登録・ログイン
- 二要素認証（2FA）
- セッション管理
- 監査ログ

## トラブルシューティング

### 接続できない場合

1. **ログを確認**
   ```bash
   tail -f ~/.claude/logs/mcp.log
   ```

2. **ポートの確認**
   ```bash
   lsof -i :8000
   ```

3. **Python環境の確認**
   ```bash
   which python
   python --version
   ```

### よくある問題

**問題**: "Module not found" エラー
**解決策**: 
```bash
pip install -e .
```

**問題**: "Permission denied" エラー
**解決策**:
```bash
chmod +x shopify-mcp-server.py
```

## 開発者向け情報

### API エンドポイント

- `GET /api/v1/shopify/products` - 商品一覧
- `POST /api/v1/shopify/products` - 商品作成
- `GET /api/v1/shopify/orders` - 注文一覧
- `GET /api/v1/auth/me` - 現在のユーザー情報

### テスト実行

```bash
pytest tests/ -v
```

### ドキュメント

APIドキュメントは http://localhost:8000/docs で確認できます。

## サポート

問題が発生した場合は、以下までお問い合わせください：

- GitHub Issues: https://github.com/gentacupoftea/shopify-mcp-server/issues
- Email: support@shopify-mcp-server.com