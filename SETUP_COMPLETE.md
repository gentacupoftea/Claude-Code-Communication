# 🎉 Claude Code MCP設定完了！

## ✅ 完了した設定

1. **MCPサーバー作成**
   - `/Users/mourigenta/shopify-mcp-server/debug_mcp_server.py`
   - デバッグ用のシンプルなMCPサーバー
   - JSON-RPCプロトコル対応

2. **Claude Desktop設定**
   - 設定ファイル: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Shopify MCPサーバーを追加
   - Python3のフルパスを指定: `/opt/homebrew/bin/python3`

3. **テストツール**
   - `test_mcp_connection.py` - 接続テスト用
   - `test_mcp.sh` - 簡易テストスクリプト

## 🚀 次のステップ

### 1. Claude Desktopを完全に終了して再起動

```bash
# Claude Desktopを終了
# メニューバーのClaudeアイコンから「Quit Claude」を選択

# または、ターミナルから強制終了
pkill -f "Claude"
```

### 2. Claude Desktopを再起動

アプリケーションフォルダからClaude Desktopを起動

### 3. 接続確認

Claude Desktopで以下のコマンドを試してください：

```
MCPツールを使って、healthチェックを実行して
```

期待される応答：
```
Server healthy at [現在時刻]
```

### 4. テストツールの使用

```
MCPツールのtestを使って、"Hello MCP!"というメッセージを送って
```

期待される応答：
```
Test response: Hello MCP!
```

## 🔧 トラブルシューティング

### 接続できない場合

1. **ログ確認**
   ```bash
   # Claude Desktopのログを確認
   tail -f ~/Library/Logs/Claude/*.log
   ```

2. **手動テスト**
   ```bash
   cd /Users/mourigenta/shopify-mcp-server
   python3 test_mcp_connection.py
   ```

3. **権限確認**
   ```bash
   ls -la ~/Library/Application\ Support/Claude/claude_desktop_config.json
   chmod 644 ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

### よくある問題

**問題**: "MCP server failed to start"
**解決策**: 
- Claude Desktopを完全に終了して再起動
- Python3のパスが正しいか確認

**問題**: "No MCP servers available"
**解決策**:
- 設定ファイルのJSONフォーマットを確認
- 設定ファイルの場所が正しいか確認

## 📝 設定内容

```json
{
  "mcpServers": {
    "shopify-mcp": {
      "command": "/opt/homebrew/bin/python3",
      "args": ["/Users/mourigenta/shopify-mcp-server/debug_mcp_server.py"],
      "env": {
        "PYTHONPATH": "/Users/mourigenta/shopify-mcp-server"
      }
    }
  }
}
```

## ✨ 利用可能なMCPツール

1. **test** - テストメッセージの送受信
2. **health** - サーバーヘルスチェック

設定は完了しました！Claude Desktopを再起動してMCPツールをお試しください。