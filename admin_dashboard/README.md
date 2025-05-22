# 🎯 Conea Admin Dashboard

MultiLLM自律システム管理ダッシュボード

## 🚀 クイックスタート

### 開発サーバー起動

```bash
cd admin_dashboard
npm install
npm start
```

**アクセス URL**: [http://localhost:4000](http://localhost:4000) 🎯

> ⚠️ **ポート設定**: OpenMemoryが3000番を使用中のため、4000番で起動します

### 本番ビルド

```bash
npm run build
npm run start:prod
```

## 📊 主要機能

### ✅ **実装済み機能**

1. **🤖 AI エージェント管理**
   - Claude・OpenAI・Gemini統合
   - リアルタイム状態監視
   - パフォーマンス追跡

2. **🔑 API Key管理**
   - 3プロバイダー対応
   - 暗号化保存
   - 接続テスト機能
   - 権限管理

3. **📈 リアルタイム監視**
   - チャットベースUI
   - WebSocket統合
   - コスト追跡
   - 使用量分析

4. **📦 プロジェクト管理**
   - GitHub PR統合
   - 問い合わせ追跡
   - AI タスク管理
   - 進捗可視化

5. **💳 課金・請求管理**
   - プロバイダー別コスト
   - 予算管理
   - 使用量アラート

## 🛠️ 技術スタック

- **React 18** + **TypeScript**
- **Material-UI 5** (デザインシステム)
- **React Router** (ルーティング)
- **WebSocket** (リアルタイム通信)
- **Toast** (通知システム)

## 📁 プロジェクト構造

```
admin_dashboard/
├── public/                 # 静的ファイル
├── src/
│   ├── components/         # 再利用コンポーネント
│   │   ├── Auth/           # 認証関連
│   │   ├── Layout/         # レイアウト
│   │   └── Notifications/  # 通知システム
│   ├── contexts/           # React Context
│   │   ├── AuthContext.tsx
│   │   └── DashboardContext.tsx
│   ├── pages/              # ページコンポーネント
│   │   ├── APIKeys/        # API Key管理
│   │   ├── Monitoring/     # 監視・分析
│   │   ├── Projects/       # プロジェクト管理
│   │   ├── Billing/        # 課金管理
│   │   └── Settings/       # 設定
│   ├── App.tsx             # メインアプリ
│   └── index.tsx           # エントリーポイント
├── .env                    # 環境変数
├── package.json
└── README.md
```

## ⚙️ 環境変数設定

`.env` ファイルで設定:

```bash
# ポート設定
PORT=4000

# API エンドポイント  
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_WEBSOCKET_URL=ws://localhost:8001

# 機能フラグ
REACT_APP_ENABLE_WEBSOCKET=true
REACT_APP_ENABLE_NOTIFICATIONS=true
```

## 🔧 開発コマンド

```bash
# 開発サーバー (ポート4000)
npm start

# 開発サーバー (ブラウザ自動起動なし)
npm run start:dev

# 本番ビルド
npm run build

# 本番サーバー起動
npm run start:prod

# テスト実行
npm test
```

## 🌐 アクセス情報

- **開発環境**: http://localhost:4000
- **デフォルトログイン**: admin / password
- **API エンドポイント**: http://localhost:8000
- **WebSocket**: ws://localhost:8001

## 🎯 利用方法

### 1. **API Key設定**
   1. サイドバーから「API キー管理」選択
   2. Claude・OpenAI・Gemini のAPIキー入力
   3. 「テスト」ボタンで接続確認

### 2. **リアルタイム監視**
   1. 「監視・分析」ページアクセス
   2. AI エージェント活動をリアルタイム表示
   3. コスト・使用量を可視化

### 3. **プロジェクト管理**
   1. 「プロジェクト」ページで一覧表示
   2. 検索・フィルタで目的のプロジェクト検索
   3. 詳細モーダルで包括的管理

## 🔐 セキュリティ

- **認証**: JWT ベース認証
- **権限管理**: ロールベースアクセス制御
- **API Key**: 暗号化保存
- **通信**: HTTPS/WSS (本番環境)

## 📞 サポート

問題や質問がある場合:

1. **GitHub Issues**: プロジェクトリポジトリ
2. **ドキュメント**: 詳細な実装ガイド
3. **ログ確認**: ブラウザ開発者ツール

---

**🎉 Conea Admin Dashboard - MultiLLM自律システム管理の完全ソリューション！**