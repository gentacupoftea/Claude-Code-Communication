#!/bin/bash
set -e

cd /Users/mourigenta/projects/conea-integration

echo "=== 重要：復元ファイルの不一致を検出 ==="

echo "1. 期待されていたファイル（12ed7aバージョン）:"
echo "----------------------------------------"
echo "- タイトル: Conea Agent - EC運営支援AI"
echo "- JSファイル: index-CNvOEPAQ.js"
echo "- CSSファイル: index-BvdlortN.css"

echo ""
echo "2. 実際にfrontendに存在するファイル:"
echo "----------------------------------------"
echo "- タイトル: Conea Agent"
echo "- JSファイル: index-Bx7lUbTN.js"
echo "- CSSファイル: index-CF_BRP1w.css"

echo ""
echo "3. 各ディレクトリの状態を確認:"
echo "----------------------------------------"

echo "restored-firebase-deployment:"
if [ -d "restored-firebase-deployment" ]; then
    ls -la restored-firebase-deployment/dist/assets/ 2>/dev/null || echo "distなし"
    grep "<title>" restored-firebase-deployment/dist/index.html 2>/dev/null || echo "index.htmlなし"
fi

echo ""
echo "conea-app-reconstructed:"
if [ -d "conea-app-reconstructed" ]; then
    ls -la conea-app-reconstructed/dist/assets/ 2>/dev/null || echo "distなし"
    grep "<title>" conea-app-reconstructed/dist/index.html 2>/dev/null || echo "index.htmlなし"
fi

echo ""
echo "frontend-v2-broken-backup:"
if [ -d "frontend-v2-broken-backup" ]; then
    ls -la frontend-v2-broken-backup/dist/assets/ 2>/dev/null || echo "distなし"
    grep "<title>" frontend-v2-broken-backup/dist/index.html 2>/dev/null || echo "index.htmlなし"
fi

echo ""
echo "4. 正しい12ed7aバージョンを探す:"
echo "----------------------------------------"
find . -name "index-CNvOEPAQ.js" -type f 2>/dev/null | head -10

echo ""
echo "5. 現在のfrontendがどこから来たか追跡:"
echo "----------------------------------------"
# ファイルのタイムスタンプを確認
echo "frontend/dist/index.htmlの詳細:"
ls -la frontend/dist/index.html
stat frontend/dist/index.html 2>/dev/null || echo ""

echo ""
echo "6. 正しいバージョンの復元:"
echo "----------------------------------------"
# restored-from-firebase-12ed7aをチェック
if [ -d "restored-from-firebase-12ed7a" ]; then
    echo "restored-from-firebase-12ed7aの内容:"
    ls -la restored-from-firebase-12ed7a/
    if [ -f "restored-from-firebase-12ed7a/index.html" ]; then
        echo "index.htmlのタイトル:"
        grep "<title>" restored-from-firebase-12ed7a/index.html
    fi
fi

echo ""
echo "=== 診断結果 ==="
echo "現在のfrontendディレクトリには期待したFirebase復元版（12ed7a）ではない"
echo "別のバージョンが入っている可能性があります。"