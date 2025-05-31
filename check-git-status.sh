#!/bin/bash
cd /Users/mourigenta/projects/conea-integration

echo "=== Git状態確認 ==="
echo "現在のブランチ:"
git branch --show-current

echo -e "\n現在のコミット:"
git log -1 --oneline

echo -e "\n作業ツリーの状態:"
git status --short

echo -e "\nfrontend-v2ディレクトリの確認:"
if [ -d "frontend-v2" ]; then
    echo "frontend-v2が存在します"
    ls -la frontend-v2/ | head -10
else
    echo "frontend-v2が存在しません"
fi

echo -e "\nfrontend-v2に関する最新のコミット:"
git log --oneline --all --grep="frontend-v2" | head -5

echo -e "\n利用可能なブランチ:"
git branch -a | grep -E "(frontend|v2|conea)" | head -10
