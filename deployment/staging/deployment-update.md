# Coneaステージング環境デプロイ状況更新

## デプロイ概要

**デプロイ日時**: 2025年5月22日
**環境**: Firebase Hosting
**バージョン**: staging-20250522024431
**アクセスURL**: https://conea-48fcf.web.app
**目標URL**: https://staging.conea.ai

## デプロイ実施内容

Coneaフロントエンド（UI）を Firebase Hosting にデプロイしました。以下の手順を実施しました：

1. Firebase プロジェクト (conea-48fcf) への認証
2. Firebase Hosting 設定ファイル (firebase.json) の作成
3. デプロイするファイルのビルドと静的置換
4. Firebase Hosting へのデプロイ

## デプロイ結果

デプロイは成功し、フロントエンドは現在以下のURLでアクセス可能です：

```
https://conea-48fcf.web.app
```

## カスタムドメイン設定

まだカスタムドメイン (staging.conea.ai) の設定は完了していません。カスタムドメインを設定するための詳細な手順は以下のドキュメントに記載しています：

- [Firebase カスタムドメイン設定手順](./FIREBASE-CUSTOM-DOMAIN.md)

カスタムドメイン設定には、以下の作業が必要です：

1. Firebase コンソールでカスタムドメインの追加
2. DNSレコードの設定（ドメイン所有権確認用TXTレコード）
3. AレコードまたはCNAMEレコードの設定
4. SSL証明書のプロビジョニング

## 次のステップ

1. カスタムドメインの設定
2. デプロイの自動化（GitHub Actions など）
3. バックエンドAPIとの接続テスト
4. デプロイされた環境でのE2Eテスト

## ログと監視

- Firebase コンソール: https://console.firebase.google.com/project/conea-48fcf/overview
- Firebase Hosting ログ: https://console.firebase.google.com/project/conea-48fcf/hosting/sites

## 課題と対応

1. 環境変数の補間問題：
   - 解決: 静的置換スクリプト (env-config.js) の使用
   - 状態: 対応済み

2. ビルドの安定性：
   - 解決: 手動HTMLによる対応と静的ファイルの作成
   - 状態: 対応済み（長期的には改善の余地あり）

3. カスタムドメイン設定：
   - 解決: Firebase コンソールでの設定とDNS変更が必要
   - 状態: 未対応