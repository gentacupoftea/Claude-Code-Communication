# Firebase カスタムドメイン設定手順

Firebase のカスタムドメイン設定を行い、staging.conea.ai をFirebaseホスティングに紐づけるための手順を説明します。

## 前提条件

- Firebase プロジェクト (conea-48fcf) へのアクセス権限
- staging.conea.ai のドメイン管理権限
- DNSレコードを変更する権限

## カスタムドメイン設定手順

1. Firebase コンソールにアクセス：
   - https://console.firebase.google.com/project/conea-48fcf/hosting/sites

2. Firebase Hosting セクションで「カスタムドメインを追加」をクリック

3. カスタムドメインとして「staging.conea.ai」を入力

4. ドメイン所有権の確認：
   - TXTレコードを使用したドメイン所有権の確認
   - コンソールに表示されるDNSレコード情報をドメインのDNS設定に追加

5. Aレコードの追加：
   - Firebase が提供するIPアドレスを指すAレコードを追加
   - 例： 
     ```
     A   staging.conea.ai   151.101.1.195
     A   staging.conea.ai   151.101.65.195
     ```

6. CNAMEレコードの追加（必要な場合）：
   ```
   CNAME   www.staging.conea.ai   staging.conea.ai
   ```

7. DNSレコードの伝播を待つ（最大24時間）

8. Firebase コンソールでドメイン確認プロセスを完了

## SSL証明書の設定

Firebase は Let's Encrypt を使用して自動的にSSL証明書を発行・更新します：

1. ドメイン所有権確認後、Firebase は証明書をプロビジョニング
2. 証明書のプロビジョニングには最大24時間かかる場合がある
3. SSL証明書が有効になると、HTTPSが自動で有効になる

## トラブルシューティング

以下の問題が発生した場合の対処法：

1. **DNSレコード確認の問題**：
   - DNSレコードが正しく追加されたか確認
   - `dig TXT staging.conea.ai` などのDNSツールでレコードを確認
   - DNSキャッシュクリアを試す

2. **SSL証明書の問題**：
   - 証明書プロビジョニングに時間がかかる場合は待機
   - CAA DNSレコードがある場合、Let's Encryptを許可しているか確認

3. **リダイレクトの問題**：
   - HTTPからHTTPSへの自動リダイレクトを確認
   - リダイレクトループが発生していないか確認

## 確認方法

1. ブラウザで https://staging.conea.ai にアクセス
2. 証明書情報を確認（ブラウザのアドレスバーで鍵アイコンをクリック）
3. ページが正しく表示されることを確認

## 注意事項

1. DNS変更には時間がかかる場合があります（最大24時間）
2. SSL証明書の初回プロビジョニングにも時間がかかる場合があります
3. ドメインのDNS管理がFirebaseの設定と競合していないか確認してください