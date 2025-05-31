# MultiLLM System ポート構成

## 🔌 ポート使用状況

| サービス | ポート | 説明 |
|---------|--------|------|
| OpenMemory | 3000 | メモリ管理サービス（既存・重要） |
| 既存サービス | 8000 | 他のサービスが使用中 |
| **MultiLLM API** | **9000** | このプロジェクトのAPIサーバー |
| **MultiLLM UI** | **3500** | このプロジェクトのフロントエンド |

## 🚀 起動方法

### 1. APIサーバーの起動（ターミナル1）
```bash
cd /Users/mourigenta/shopify-mcp-server/multiLLM_system
./start_server.sh
```
- URL: http://localhost:9000
- 自動的に仮想環境を作成・使用

### 2. UIの起動（ターミナル2）
```bash
cd /Users/mourigenta/shopify-mcp-server/multiLLM_system
./start_ui.sh
```
- URL: http://localhost:3500
- 改善されたチャット: http://localhost:3500/improved-chat

## 📝 カスタムポート設定

別のポートを使用したい場合：

### APIサーバー
```bash
PORT=8001 ./start_server.sh
```

### UI
```bash
# package.jsonを編集するか、環境変数で指定
PORT=3600 npm start
```

## ⚠️ 注意事項

- ポート3000はOpenMemoryが使用しているため変更しないでください
- ポート8000は既存のサービスが使用中です
- UIを起動する前にAPIサーバーが起動していることを確認してください

## 🔍 トラブルシューティング

### ポート使用状況の確認
```bash
# 特定のポートの確認
lsof -i :9000

# すべてのPythonプロセス
ps aux | grep python
```

### ポートが使用中の場合
```bash
# プロセスの終了
kill <PID>

# または別のポートを使用
PORT=9001 ./start_server.sh
```