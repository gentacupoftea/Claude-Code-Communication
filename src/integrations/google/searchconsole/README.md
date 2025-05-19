# Google Search Console Integration

Shopify MCP Server用のGoogle Search Console API統合モジュール。SEOデータの取得、分析、レポート生成機能を提供します。

## 機能

- 検索クエリデータの取得と分析
- URLパフォーマンスの追跡
- デバイス別・国別のパフォーマンス分析
- トレンド分析と機会の特定
- ビジュアルレポートの生成
- ダッシュボードAPIエンドポイント
- 日本語検索キーワードのサポート

## セットアップ

### 1. 環境変数の設定

`.env.example`をコピーして`.env`を作成し、必要な認証情報を設定します：

```bash
cp .env.example .env
```

### 2. Google Cloud Console設定

#### サービスアカウント認証（推奨）

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成または既存のプロジェクトを選択
3. APIとサービス > 認証情報を開く
4. サービスアカウントを作成
5. JSON形式の秘密鍵をダウンロード
6. `GSC_SERVICE_ACCOUNT_PATH`に秘密鍵ファイルのパスを設定

#### OAuth 2.0認証

1. OAuth 2.0クライアントIDを作成
2. `GSC_CLIENT_ID`と`GSC_CLIENT_SECRET`を設定
3. リダイレクトURIを設定

### 3. Search Console APIの有効化

1. Google Cloud Consoleで「Search Console API」を検索
2. APIを有効化
3. Search Consoleでサイトの所有権を確認
4. サービスアカウントまたはOAuthアカウントにサイトへのアクセス権を付与

## 使用方法

### 基本的な使用例

```javascript
const { GSCIntegration } = require('./src/integrations/google/searchconsole');

// データ同期
const syncResult = await GSCIntegration.syncData({
  siteUrl: 'https://example.com',
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});

// 分析実行
const analysisResult = await GSCIntegration.analyze({
  siteUrl: 'https://example.com',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  previousStartDate: '2023-12-01',
  previousEndDate: '2023-12-31'
});

// レポート生成
const reportResult = await GSCIntegration.generateReport({
  siteUrl: 'https://example.com',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  analysisData: analysisResult.analysis
});
```

### APIエンドポイント

```javascript
const express = require('express');
const { router } = require('./src/integrations/google/searchconsole');

const app = express();
app.use('/api/gsc', router);
```

#### 利用可能なエンドポイント

- `GET /api/gsc/auth/status` - 認証状態の確認
- `GET /api/gsc/sites` - 利用可能なサイト一覧
- `POST /api/gsc/sync` - データ同期の実行
- `POST /api/gsc/analyze` - 分析の実行
- `POST /api/gsc/report` - レポート生成
- `GET /api/gsc/queries` - クエリデータの取得
- `GET /api/gsc/performance` - パフォーマンスデータの取得
- `GET /api/gsc/dashboard` - ダッシュボードデータの取得

## データモデル

### QueryData

検索クエリのパフォーマンスデータを管理：

```javascript
{
  query: string,          // 検索クエリ
  page: string,          // ランディングページURL
  country: string,       // 国コード
  device: string,        // デバイスタイプ
  date: Date,           // 日付
  clicks: number,       // クリック数
  impressions: number,  // インプレッション数
  ctr: number,         // クリック率
  position: number     // 平均掲載順位
}
```

### PerformanceData

サイト全体のパフォーマンスメトリクスを管理：

```javascript
{
  siteUrl: string,      // サイトURL
  date: Date,          // 日付
  dataType: string,    // データタイプ（total, device, country）
  clicks: number,      // クリック数
  impressions: number, // インプレッション数
  ctr: number,        // クリック率
  position: number    // 平均掲載順位
}
```

## 分析機能

### キーワード分析

- トップキーワードの特定
- ロングテールキーワード分析
- ブランドキーワード分析
- 検索意図の分類

### ページ分析

- ページ別パフォーマンス
- ランキング分布
- 改善機会の特定

### トレンド分析

- 時系列トレンド
- 季節性の検出
- 前期比較

### 相関分析

- 掲載順位とCTRの相関
- デバイスとパフォーマンスの相関

## レポート機能

### HTMLレポート

- エグゼクティブサマリー
- パフォーマンストレンド
- トップキーワード/ページ
- デバイス別分析
- 推奨事項

### チャート生成

- トレンドチャート
- 分布チャート
- 比較チャート
- デバイス/国別チャート

## ベストプラクティス

1. **定期的なデータ同期**
   - 毎日の増分同期を推奨
   - 大量データの場合はバッチ処理を使用

2. **キャッシュの活用**
   - 頻繁にアクセスされるデータはキャッシュから取得
   - キャッシュTTLを適切に設定

3. **レート制限への対応**
   - API制限を考慮した実装
   - リトライ機構の活用

4. **エラーハンドリング**
   - 適切なエラーメッセージ
   - ログ記録の徹底

## トラブルシューティング

### 認証エラー

```
Error: 認証が完了していません
```

対処法：
1. 環境変数が正しく設定されているか確認
2. サービスアカウントキーファイルのパスを確認
3. Search Console APIが有効になっているか確認

### データ取得エラー

```
Error: サイトへのアクセス権限がありません
```

対処法：
1. Search Consoleでサイトの所有権を確認
2. サービスアカウントにアクセス権を付与
3. 正しいサイトURLを使用しているか確認

### レート制限エラー

```
Error: API rate limit exceeded
```

対処法：
1. リクエスト間隔を調整
2. バッチサイズを縮小
3. キャッシュを活用

## 開発

### テスト実行

```bash
npm test -- src/integrations/google/searchconsole/tests/
```

### E2Eテスト（実際のAPIを使用）

```bash
GSC_E2E_TEST=true npm test
```

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## サポート

- GitHubイシュー: [shopify-mcp-server/issues](https://github.com/your-repo/shopify-mcp-server/issues)
- ドキュメント: [Google Search Console API](https://developers.google.com/webmaster-tools/search-console-api-original)