/**
 * Firebase Custom Domain Setup Script
 * 
 * このスクリプトでFirebaseホスティングにカスタムドメインを設定するためのコマンドを生成します
 */

// 必要な設定
const config = {
  projectId: 'conea-48fcf',
  site: 'staging-conea-ai',
  customDomain: 'staging.conea.ai',
};

console.log(`
Firebase ホスティングにカスタムドメイン "${config.customDomain}" を設定するコマンド:

1. Firebase Hostingサイト一覧の確認:
   firebase hosting:sites:list

2. ドメイン所有権確認のためのDNSレコード情報の取得:
   firebase hosting:sites:update ${config.site} --project=${config.projectId}
   
   システムが対話モードでカスタムドメインの追加を促します。
   - "${config.customDomain}" と入力してください
   - DNSレコード情報（TXTレコード）が表示されます
   - TXTレコードをDNSプロバイダに追加してください

3. DNS TXTレコードを追加した後、以下のコマンドで確認プロセスを完了:
   firebase hosting:sites:update ${config.site} --project=${config.projectId}
   
   再度対話モードが表示されます:
   - "staging.conea.ai" と入力してください
   - "Yes" を選択してDNS確認を続行してください

注意: カスタムドメイン設定はFirebase CLIの対話モードを必要とし、完全に自動化できません。
コンソール (https://console.firebase.google.com/project/${config.projectId}/hosting/sites) からも設定可能です。
`);