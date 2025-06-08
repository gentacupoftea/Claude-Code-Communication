#!/bin/zsh

# 手動認証お手伝いスクリプト (最終完成版)
# ユーザーの邪魔をせず、後処理だけを忠実に実行する

# 色付け用
C_BLUE="\033[1;34m"
C_GREEN="\033[1;32m"
C_YELLOW="\033[1;33m"
C_RESET="\033[0m"

# --- STEP 1: 操作案内の表示 ---
echo -e "${C_BLUE}--- 手動Claude認証ヘルパー (最終完成版) ---${C_RESET}"
echo ""
echo -e "新しいターミナルウィンドウで 'claude' を起動します。"
echo -e "お手数ですが、${C_YELLOW}新しいウィンドウ${C_RESET}で、以下の操作をお願いします。"
echo ""
echo -e "  1. ${C_YELLOW}/logout${C_RESET} と入力してEnter (自動でログインが始まります)"
echo -e "  2. ブラウザで認証を完了"
echo -e "  3. 'Successfully logged in' と表示されたら、そのウィンドウを閉じる"
echo ""

# --- STEP 2: 新しいターミナルでclaudeを起動 ---
# osascriptを使って、新しいターミナルウィンドウでコマンドを実行
osascript -e "tell application \"Terminal\" to do script \"/Users/mourigenta/.nvm/versions/node/v22.15.0/bin/claude\"" > /dev/null

echo -e "新しいターミナルを起動しました。認証作業、いってらっしゃいませ！"
echo -e "--------------------------------------------------"
echo ""


# --- STEP 3: ユーザーの帰還を待ち、後処理を実行 ---
echo -e "${C_YELLOW}認証とウィンドウを閉じる作業が完了したら、${C_RESET}"
echo -e "${C_YELLOW}このウィンドウに戻ってきて、Enterキーを押してください...${C_RESET}"
read

echo ""
echo -e "${C_GREEN}お帰りなさい、司令官！面倒な後処理は、僕にお任せください。${C_RESET}"
echo -e "新しい認証情報を、GitHub Secretsに自動で登録します..."
echo ""

./.scripts/update_claude_secrets.sh

echo ""
echo -e "${C_GREEN}✅ 全てのプロセスが完了しました！いつでも出撃できます！${C_RESET}" 