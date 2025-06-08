#!/bin/zsh

# このスクリプトは、Claude Code Actionの認証情報を手動で更新するためのヘルパーです。

echo "--- Claude認証情報 強制リフレッシュ開始 ---"
echo ""
echo "1. VSCodeでコマンドパレット (Cmd+Shift+P) を開いてください。"
echo "2. 'Claude Code Action: Sign Out' を実行してください。"
echo "3. 再度コマンドパレットを開き、'Claude Code Action: Sign In' を実行し、"
echo "   表示されるブラウザで認証を完了させてください。"
echo ""
echo "------------------------------------------------------------------"
echo -n "   ブラウザでの再認証が完了したら、この画面で Enter キーを押してください..."
read
echo "------------------------------------------------------------------"
echo ""
echo "ありがとうございます。キーチェーン情報を取得し、GitHub Secretsを更新します..."
echo ""

# 既存の更新スクリプトを実行
# スクリプト自身の場所を基準にして、update_claude_secrets.sh を見つける
SCRIPT_DIR=$(dirname "$0")
"${SCRIPT_DIR}/update_claude_secrets.sh"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 正常に完了しました！GitHub Actionsを実行してみてください。"
else
    echo ""
    echo "❌ エラーが発生しました。上記のログを確認してください。"
fi

echo ""
echo "--- 処理終了 ---" 