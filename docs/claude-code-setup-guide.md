# Shopify-MCP-Server & Claude Desktop連携ガイド

このガイドでは、Claude Codeを使用してShopify-MCP-ServerとClaude Desktopを連携させる方法を説明します。

## 前提条件
- Python 3.12以上がインストール済み
- Shopify-MCP-Server v0.2.2以上がインストール済み
- Claude Desktop最新版がインストール済み
- Claude Codeがインストール済み
- Shopify APIキーとシークレットが用意されている

## 1. 環境準備

```bash
# 1.1 Python環境の確認
claude-code "実行してください: python --version"

# 1.2 仮想環境の作成と有効化
claude-code "以下のコマンドをステップバイステップで実行してください:
1. python -m venv ~/shopify_env_312
2. source ~/shopify_env_312/bin/activate"

# 1.3 Shopify-MCP-Serverのインストール
claude-code "以下のコマンドを実行してShopify-MCP-Serverをインストールしてください: 
pip install shopify-mcp-server==0.2.2"
```

## 2. 設定ファイルの作成と編集

```bash
# 2.1 設定ディレクトリの作成
claude-code "以下のコマンドを実行して設定ディレクトリを作成してください:
mkdir -p ~/.shopify-mcp-server/logs"

# 2.2 設定ファイルの作成
claude-code "以下の内容の設定ファイルを~/.shopify-mcp-server/config.jsonに作成してください。APIキーとシークレット、アクセストークン、ショップURLはあなたのShopify情報に置き換えてください:
{
  \"api\": {
    \"shopify_api_key\": \"YOUR_SHOPIFY_API_KEY\",
    \"shopify_api_secret\": \"YOUR_SHOPIFY_API_SECRET\",
    \"access_token\": \"YOUR_ACCESS_TOKEN\",
    \"shop_url\": \"your-store.myshopify.com\",
    \"api_version\": \"2024-10\"
  },
  \"server\": {
    \"host\": \"127.0.0.1\",
    \"port\": 5000,
    \"debug\": false
  },
  \"cache\": {
    \"enabled\": true,
    \"ttl\": 3600
  },
  \"logging\": {
    \"level\": \"INFO\",
    \"file\": \"~/.shopify-mcp-server/logs/server.log\"
  },
  \"graphql\": {
    \"enabled\": true,
    \"batch_size\": 50
  }
}"
```

## 3. Shopify-MCP-Serverの起動と接続テスト

```bash
# 3.1 サーバーの起動
claude-code "以下のコマンドを実行してShopify-MCP-Serverを起動してください:
python -m shopify_mcp_server"

# 3.2 別のターミナルを開いて接続テスト
claude-code "新しいターミナルを開き、以下のコマンドを実行して接続をテストしてください:
curl http://127.0.0.1:5000/health"

# 3.3 期待される結果
claude-code "上記コマンドの出力結果を確認してください。以下のようなJSONレスポンスが表示されるはずです:
{
  \"status\": \"ok\",
  \"version\": \"0.2.2\"
}"
```

## 4. Claude Desktopの設定

```bash
# 4.1 Claude Desktopの起動
claude-code "Claude Desktopアプリケーションを起動してください"

# 4.2 MCP設定画面へのアクセス
claude-code "以下の手順でMCP設定画面にアクセスしてください:
1. 画面右上の設定アイコン（歯車マーク）をクリック
2. 「拡張機能」または「Extensions」メニューを選択
3. 「MCP設定」または「MCP Settings」を選択"

# 4.3 接続情報の入力
claude-code "以下の接続情報を入力してください:
- ホスト: 127.0.0.1
- ポート: 5000
- エンドポイント: /api/v1/shopify
入力後、「保存」または「Save」をクリックしてください"

# 4.4 接続テスト
claude-code "「テスト接続」または「Test Connection」ボタンをクリックして、接続をテストしてください。成功すると「接続に成功しました」などのメッセージが表示されます"
```

## 5. 動作確認

```bash
# 5.1 Claude Desktopでの動作確認
claude-code "Claude Desktopで新しい会話を開始し、以下のような質問をしてみてください:
- 「Shopifyストアの最近の注文状況を教えて」
- 「先週の売上総額はいくらですか？」
- 「最も人気のある商品は何ですか？」"

# 5.2 GraphQL機能の確認
claude-code "以下のようなより複雑な質問をして、GraphQL機能による効率的なデータ取得を確認してください:
- 「過去3ヶ月の月別売上と注文数の推移を教えて」
- 「顧客セグメント別の購入傾向を分析して」
- 「在庫が10個以下の商品のリストを作成して」"
```

## 6. トラブルシューティング

```bash
# 6.1 ログの確認
claude-code "問題が発生した場合、以下のコマンドでログを確認してください:
cat ~/.shopify-mcp-server/logs/server.log"

# 6.2 一般的な問題の解決
claude-code "以下の一般的な問題と解決策を確認してください:
1. 接続エラー: サーバーが起動しているか確認し、ファイアウォール設定を確認してください
2. 認証エラー: Shopify APIキーと認証情報が正しいか確認してください
3. データ取得エラー: APIバージョンが正しいか確認し、必要に応じて更新してください"
```

## 補足情報

- **自動化の可能性**: このガイドの多くのステップは、実際のシェルスクリプトとして自動化することも可能です
- **APIバージョン**: 現在対応しているShopify APIバージョンは2024-10です
- **パフォーマンス**: GraphQL機能を有効にすることで、API呼び出しが約70%削減されます
- **更新情報**: このセットアップガイドは定期的に更新されます。最新情報はリポジトリを確認してください

## 次のステップ

- Shopifyデータのバックアップや定期的な同期の設定
- カスタムレポートフォーマットの作成
- 高度なデータ分析・可視化パイプラインの構築
- エラー通知システムの導入

---

*このガイドは、Shopify-MCP-Server v0.2.2およびClaude Desktop最新版に対応しています。*
*最終更新: 2025-05-18*