# Firebase Hostingのカスタムドメイン設定ガイド

Firebaseホスティングにカスタムドメイン「staging.conea.ai」を設定するための詳細ガイドです。

## 前提条件

1. Firebase Consoleへのアクセス権限
2. 「staging.conea.ai」ドメインのDNS設定権限
3. デプロイ済みのコンテンツ（実施済み）

## 手順

### 1. Firebase Consoleにアクセス

- https://console.firebase.google.com/project/conea-48fcf/hosting/sites/staging-conea-ai

### 2. カスタムドメインの追加

1. 「カスタムドメインを追加」ボタンをクリック
2. ドメイン入力フィールドに「staging.conea.ai」と入力
3. 「続行」をクリック

### 3. ドメイン所有権の確認

Firebase Consoleに表示されるTXTレコードをDNSプロバイダに追加します：

1. DNSプロバイダのコントロールパネルにアクセス
2. 以下のようなTXTレコードを追加：

```
TYPE: TXT
NAME: @  または  staging (プロバイダによって異なります)
VALUE: google-site-verification=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TTL: 3600 (またはデフォルト)
```

Firebase Consoleに表示される正確な値を使用してください。

### 4. DNSレコードの変更を待機

DNSレコードの伝播には時間がかかる場合があります（最大24時間）。Firebase ConsoleでDNS確認が完了すると、次のステップに進みます。

### 5. Aレコードの追加

Firebase Consoleに表示されるIPアドレスを指すAレコードを追加します：

```
TYPE: A
NAME: staging または @  (プロバイダによって異なります)
VALUE: Firebase提供のIPアドレス (通常は2つ以上あります)
TTL: 3600 (またはデフォルト)
```

### 6. SSL証明書のプロビジョニング

Firebase は Let's Encrypt を使用して自動的にSSL証明書を発行します。この処理も時間がかかる場合があります（最大24時間）。

### 7. HTTPS接続の検証

SSL証明書がプロビジョニングされた後、以下のURLにアクセスして接続を検証します：

```
https://staging.conea.ai
```

## トラブルシューティング

### DNS設定の検証

DNSレコードが正しく設定されているか確認するには、以下のコマンドを実行します：

```bash
# TXTレコードの確認
dig TXT staging.conea.ai

# Aレコードの確認
dig A staging.conea.ai
```

### SSL証明書の問題

SSL証明書がプロビジョニングされない場合：

1. CAA DNSレコードがある場合、Let's Encryptを許可しているか確認
2. 正しいドメイン名でAレコードが設定されているか確認
3. Firebaseのエラーメッセージを確認

### リダイレクトの設定

HTTPトラフィックをHTTPSに自動的にリダイレクトするには、Firebase Consoleの「ホスティング」セクションで「HTTPSリダイレクト」を有効にします。

## DNS設定例

以下は一般的なDNSプロバイダでの設定例です：

### Google Domains

1. Google Domainsコンソールにアクセス
2. 「DNS」セクションを選択
3. 「カスタムレコード」セクションで新しいレコードを追加
4. Firebase Consoleの指示に従って値を入力

### Cloudflare

1. Cloudflareダッシュボードにアクセス
2. 適切なドメインを選択
3. 「DNS」タブを選択
4. 「レコードを追加」をクリック
5. Firebase Consoleの指示に従って値を入力
6. SSL/TLS設定が「フル」または「フル（厳格）」であることを確認

## 注意事項

1. DNS変更には時間がかかる場合があります
2. Firebase のフリーティアには月間のストレージとデータ転送に制限があります
3. 複数のカスタムドメインを同じサイトに接続することもできます（必要に応じて）