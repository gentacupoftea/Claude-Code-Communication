#!/bin/bash
set -e

cd /Users/mourigenta/projects/conea-integration

echo "=== Firebase Hosting リリース履歴の確認 ==="

# Firebase CLI のログイン状態を確認
echo "1. Firebase CLI ログイン状態確認..."
firebase login:list

# プロジェクトの確認
echo "2. 現在のFirebaseプロジェクト:"
firebase use

# Hosting リリース履歴を取得
echo "3. Firebase Hosting のリリース履歴を取得..."
firebase hosting:releases:list --site stagingapp-conea-ai > hosting-releases.txt 2>&1 || true

# 結果を表示
echo "4. リリース履歴:"
cat hosting-releases.txt

# 12ed7aを含むリリースを検索
echo ""
echo "5. ハッシュ '12ed7a' を含むリリースを検索..."
grep -i "12ed7a" hosting-releases.txt || echo "該当するハッシュが見つかりませんでした"

# 別の方法でデプロイ履歴を確認
echo ""
echo "6. 最近のデプロイ履歴（詳細）:"
firebase hosting:channel:list --site stagingapp-conea-ai || true

# 現在デプロイされているサイトの情報
echo ""
echo "7. 現在のライブサイト情報:"
curl -s -I https://stagingapp.conea.ai | head -20

# Firebaseプロジェクトの設定を再確認
echo ""
echo "8. .firebaserc の内容:"
cat .firebaserc || echo ".firebaserc ファイルが見つかりません"

echo ""
echo "=== 次のステップの準備 ==="
echo "現在stagingapp.conea.aiにデプロイされているファイルを直接ダウンロードして復元します..."