#!/bin/bash
set -e

cd /Users/mourigenta/projects/conea-integration

echo "=== GitHubへのプッシュ作業 ==="

echo "1. 現在のブランチを確認:"
git branch --show-current

echo ""
echo "2. mainブランチに切り替え:"
git checkout main || echo "mainブランチへの切り替えに失敗"

echo ""
echo "3. 最新の変更を取得:"
git pull origin main || echo "プルに失敗（競合の可能性）"

echo ""
echo "4. 新しいブランチを作成:"
BRANCH_NAME="feature/frontend-firebase-restoration-$(date +%Y%m%d)"
git checkout -b $BRANCH_NAME
echo "ブランチ作成: $BRANCH_NAME"

echo ""
echo "5. 変更内容の最終確認:"
git status --short | head -20

echo ""
echo "6. コミット:"
git commit -m "feat: Firebase復元版をメインのfrontendディレクトリに換装

- ハッシュ12ed7aのFirebaseデプロイメントから復元したコードを採用
- restored-firebase-deploymentの内容をfrontendディレクトリに移行
- 今後このバージョンをメインとして開発を継続

変更内容:
- Reactアプリケーション（Vite + TypeScript）
- Firebase設定済み
- EC運営支援AI機能実装済み
- ダッシュボード機能動作確認済み"

echo ""
echo "7. GitHubへプッシュ:"
git push -u origin $BRANCH_NAME

echo ""
echo "8. PR作成用のURL:"
echo "https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/compare/main...$BRANCH_NAME?expand=1"

echo ""
echo "=== プッシュ完了 ==="
echo ""
echo "次のステップ:"
echo "1. 上記URLをブラウザで開いてPRを作成"
echo "2. PRのタイトル: 'feat: Firebase復元版をメインfrontendに採用'"
echo "3. PRの説明に復元の経緯と動作確認結果を記載"