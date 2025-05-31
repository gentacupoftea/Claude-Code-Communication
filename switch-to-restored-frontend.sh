#!/bin/bash
set -e

cd /Users/mourigenta/projects/conea-integration

echo "=== 復元コードのfrontendディレクトリへの換装 ==="

echo "1. 現在のディレクトリ構造を確認:"
ls -la | grep -E "frontend|restored"

echo ""
echo "2. 既存のfrontendディレクトリをバックアップ:"
if [ -d "frontend" ]; then
    echo "既存のfrontendをバックアップ..."
    mv frontend frontend-backup-$(date +%Y%m%d_%H%M%S)
    echo "バックアップ完了"
else
    echo "既存のfrontendディレクトリが見つかりません"
fi

echo ""
echo "3. 復元されたコードを新しいfrontendディレクトリとして設定:"
cp -r restored-firebase-deployment frontend
echo "復元コードをfrontendにコピー完了"

echo ""
echo "4. frontendディレクトリの内容確認:"
ls -la frontend/

echo ""
echo "5. 不要なファイルのクリーンアップ:"
cd frontend
# Gitの初期化をクリーンアップ
rm -rf .git
# サーバーファイルを削除（不要）
rm -f server.js server-3001.js

echo ""
echo "6. package.jsonの確認:"
cat package.json | head -20

echo ""
echo "7. Git状態の確認:"
cd ..
git status

echo ""
echo "=== 換装作業完了 ==="
echo "次のステップ: git add と commit"