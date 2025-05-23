# 🧪 Conea Admin Dashboard - 動作テスト完全ガイド

## 📋 現在の実装状況

### ✅ **完全実装済み**
- **フロントエンド**: React/TypeScript UI (100%)
- **Mock API**: 開発・デモ用データサービス (100%)
- **UI/UX**: 全機能動作確認済み (100%)

### 🔄 **実装オプション**
- **簡易バックエンド**: Express.js API (新規作成)
- **データ永続化**: JSONファイルベース (新規作成)

---

## 🎮 **テスト方法 1: Mock環境 (即座テスト可能)**

### **起動手順**
```bash
# 管理ダッシュボード起動
cd admin_dashboard
npm start

# アクセス
# URL: http://localhost:4000
# ログイン: admin / password (任意)
```

### **テスト可能機能**
```
✅ API Key管理
- 新規作成・編集・削除
- 接続テスト (Mock応答)
- プロバイダー管理 (Claude/OpenAI/Gemini)

✅ Slack統合設定
- Token設定・接続テスト
- 機能有効化・チャンネル管理
- 接続状態管理

✅ 監視・分析
- リアルタイムチャット表示
- エージェント状態監視
- コスト・使用量追跡

✅ プロジェクト管理
- 検索・フィルタ機能
- 詳細情報表示
```

### **Mock動作の特徴**
- **データ**: メモリ上で動作 (リロード時リセット)
- **API接続テスト**: ランダム成功/失敗 (80%成功率)
- **応答時間**: 現実的な遅延シミュレーション
- **通知**: 成功・エラーメッセージ表示

---

## 🚀 **テスト方法 2: 実際のバックエンドAPI (永続化対応)**

### **バックエンド起動**
```bash
# 1. バックエンド依存関係インストール
cd backend
npm install

# 2. サーバー起動
npm start
# → http://localhost:8000 で起動

# 3. フロントエンド設定変更
cd ../admin_dashboard
echo "REACT_APP_USE_REAL_API=true" >> .env

# 4. フロントエンド再起動
npm start
# → http://localhost:4000 でアクセス
```

### **実際のAPI動作**
```
✅ データ永続化
- JSONファイルにデータ保存
- 再起動後もデータ保持
- 実際のCRUD操作

✅ REST API
- GET/POST/PUT/DELETE エンドポイント
- エラーハンドリング
- 現実的な応答時間

✅ ファイルベースDB
- backend/data/ ディレクトリに保存
- api_keys.json, users.json, slack_config.json
```

---

## 🔧 **詳細テストシナリオ**

### **API Key管理テスト**
```bash
# 1. 新規作成テスト
1. "New API Key" ボタンクリック
2. Provider: Claude 選択
3. Name: "Test Claude Key" 入力
4. API Key: "sk-test-key-12345" 入力
5. "Create" ボタン → カード追加確認

# 2. 編集テスト
1. 作成したカードの "Edit" ボタンクリック
2. Name: "Updated Claude Key" に変更
3. "Update" ボタン → 変更反映確認

# 3. 接続テスト
1. "Test" ボタンクリック
2. 2秒待機後に成功/失敗メッセージ確認
3. ステータスアイコン変化確認

# 4. 削除テスト
1. 削除アイコンクリック
2. 確認ダイアログで "Delete" 選択
3. カード削除確認
```

### **Slack統合テスト**
```bash
# 1. 設定テスト
1. /slack ページアクセス
2. Bot Token: "xoxb-test-token" 入力
3. App Token: "xapp-test-token" 入力
4. Workspace: "test-workspace" 入力
5. "Save Configuration" → 保存確認

# 2. 接続テスト
1. "Test Connection" ボタンクリック
2. 2.5秒待機後に結果確認
3. 成功時はワークスペース名表示確認

# 3. 機能設定テスト
1. "Features" タブ選択
2. Mention Commands ON/OFF 切り替え
3. Slash Commands ON/OFF 切り替え
4. 設定保存確認

# 4. チャンネル管理テスト
1. "Channels" タブ選択
2. "Add Channel" ボタンクリック
3. "#test-channel" 入力
4. チャンネル追加確認
5. "Remove" ボタンで削除確認
```

---

## 📊 **期待される動作確認項目**

### **UI/UX確認**
```
✅ レスポンシブデザイン
- デスクトップ・タブレット・モバイル対応
- サイドバーの適切な表示・非表示

✅ 通知システム
- 成功・エラー・警告メッセージ表示
- 自動非表示 (6秒後)

✅ ローディング状態
- ボタン押下時のスピナー表示
- 適切な無効化状態

✅ フォーム検証
- 必須項目チェック
- エラー状態表示
```

### **データフロー確認**
```
✅ Mock環境
- データ変更 → 即座UI反映
- リロード → 初期データに戻る
- セッション中の状態保持

✅ 実API環境  
- データ変更 → サーバー保存 → UI反映
- リロード → データ保持確認
- エラー時の適切な処理
```

---

## 🔍 **トラブルシューティング**

### **よくある問題と解決方法**

#### **フロントエンドが起動しない**
```bash
# 依存関係再インストール
cd admin_dashboard
rm -rf node_modules package-lock.json
npm install
npm start
```

#### **バックエンドが起動しない**
```bash
# Node.js バージョン確認
node --version  # v16以上推奨

# ポート競合確認
lsof -i :8000
# 他プロセスが使用中の場合は終了

# 依存関係インストール
cd backend
npm install
npm start
```

#### **API接続エラー**
```bash
# 環境変数確認
cat admin_dashboard/.env
# REACT_APP_USE_REAL_API=true
# REACT_APP_API_BASE_URL=http://localhost:8000

# バックエンド起動確認
curl http://localhost:8000/health
# {"status":"ok","timestamp":"2025-01-20T..."}
```

---

## 🎯 **次のステップ**

### **本格運用への移行**
1. **データベース統合**: PostgreSQL/MongoDB
2. **認証強化**: JWT + OAuth
3. **外部API統合**: 実際のLLM API接続
4. **監視強化**: Prometheus + Grafana
5. **デプロイ**: Docker + Kubernetes

### **機能拡張**
1. **ユーザー管理**: 詳細権限設定
2. **監査ログ**: 操作履歴追跡  
3. **レポート機能**: 使用量レポート自動生成
4. **アラート**: 予算・使用量閾値通知

---

## 📞 **サポート**

問題が発生した場合:
1. **ログ確認**: ブラウザ開発者ツール Console
2. **サーバーログ**: バックエンド起動コンソール
3. **設定確認**: .env ファイル内容
4. **動作環境**: Node.js/npm バージョン

---

**🎉 完全な動作テスト環境が準備できました！**
**Mock環境で即座テスト開始、または実APIで本格動作確認が可能です！** ✨