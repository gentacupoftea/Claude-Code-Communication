#!/bin/zsh

# Claude Code ActionのGitHub Secretsを自動更新するスクリプト

# --- 設定項目 ---
# このスクリプトは以下のツールに依存しています。
# brew install gh jq

# GitHubのリポジトリ情報 (ご自身の環境に合わせて変更してください)
GITHUB_OWNER="gentacupoftea"
GITHUB_REPO="conea-integration"

# キーチェーンに保存されている項目名
KEYCHAIN_ITEM="Claude Code-credentials"

# 各コマンドのフルパスを直接指定 (launchdのPATH問題対策)
GH_CMD="/opt/homebrew/bin/gh"
JQ_CMD="/opt/homebrew/bin/jq"
SECURITY_CMD="/usr/bin/security"

# --- スクリプト本体 ---

echo "=================================================="
echo "Claude認証情報 自動更新スクリプトを開始します"
echo "実行日時: $(date)"
echo "リポジトリ: ${GITHUB_OWNER}/${GITHUB_REPO}"
echo "--------------------------------------------------"

# 各コマンドの存在チェック
for cmd in "$GH_CMD" "$JQ_CMD" "$SECURITY_CMD"; do
    if ! [ -x "$cmd" ]; then
        echo "エラー: コマンドが見つからないか、実行権限がありません: $cmd"
        echo "パスが正しいか確認してください。"
        echo "=================================================="
        exit 1
    fi
done

echo "1. キーチェーンから '${KEYCHAIN_ITEM}' の情報を取得します..."

# securityコマンドで認証情報を取得
# 実行時にパスワードプロンプトが表示される場合は、キーチェーンアクセス.appで
# /usr/bin/security と /bin/zsh に常時アクセスを許可してください。
CREDENTIALS_JSON=$(${SECURITY_CMD} find-generic-password -w -s "${KEYCHAIN_ITEM}")

if [[ $? -ne 0 || -z "$CREDENTIALS_JSON" ]]; then
    echo "エラー: キーチェーンから情報を取得できませんでした。"
    echo "項目名 '${KEYCHAIN_ITEM}' が正しいか、またはアクセス権が許可されているか確認してください。"
    echo "=================================================="
    exit 1
fi

echo "   => 取得成功！"
echo "2. 認証情報をパースしています..."

# jqで各トークンを抽出 (ネストされた構造に対応)
ACCESS_TOKEN=$(echo $CREDENTIALS_JSON | $JQ_CMD -r '.claudeAiOauth.accessToken')
REFRESH_TOKEN=$(echo $CREDENTIALS_JSON | $JQ_CMD -r '.claudeAiOauth.refreshToken')

# GitHubへ送る用の、コロン付きのexpiresAt文字列を作成
# ユーザーの最終指摘に基づき、キー名を含めずコロンのみをプレフィックスする形式に修正
EXPIRES_AT_FOR_GITHUB=$(echo $CREDENTIALS_JSON | $JQ_CMD -r '":" + (.claudeAiOauth.expiresAt | tostring)')
# デバッグおよび内部チェック用の、純粋な数値のexpiresAtを取得
EXPIRES_AT_RAW=$(echo $CREDENTIALS_JSON | $JQ_CMD -r '.claudeAiOauth.expiresAt')

if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
    echo "エラー: JSONのパースに失敗しました。取得したデータを確認してください。"
    echo "取得データ: ${CREDENTIALS_JSON}"
    echo "=================================================="
    exit 1
fi

echo "   => パース成功！"
echo "4. ★デバッグ: 認証情報の有効期限をチェックします..."

# 現在のUnixタイムスタンプを取得
CURRENT_TIMESTAMP=$(date +%s)

# EXPIRES_ATを人間が読める形式に変換してログに出力
EXPIRES_AT_FORMATTED=$(date -r "${EXPIRES_AT_RAW}" +"%Y-%m-%d %H:%M:%S")

echo "   - キーチェーン内のトークン有効期限: ${EXPIRES_AT_FORMATTED} (${EXPIRES_AT_RAW})"
echo "   - スクリプト実行時の現在時刻:   $(date +"%Y-%m-%d %H:%M:%S") (${CURRENT_TIMESTAMP})"

# 有効期限をチェック
if [[ "${CURRENT_TIMESTAMP}" -gt "${EXPIRES_AT_RAW}" ]]; then
    echo "   - 警告: キーチェーンから取得したトークンは、すでに有効期限が切れています！"
    echo "   - VSCodeのClaude Code Action拡張機能側で、認証情報の更新が正しく行われているか確認してください。"
else
    # 有効期限までのおおよその残り時間を計算
    REMAINING_SECONDS=$((EXPIRES_AT_RAW - CURRENT_TIMESTAMP))
    REMAINING_MINUTES=$((REMAINING_SECONDS / 60))
    echo "   - 状態: トークンは有効です。(残り約${REMAINING_MINUTES}分)"
fi

echo "★最終デバッグ: 抽出した値を .env_result ファイルに出力します..."
cat > ./.env_result << EOF
CLAUDE_ACCESS_TOKEN=${ACCESS_TOKEN}
CLAUDE_REFRESH_TOKEN=${REFRESH_TOKEN}
CLAUDE_EXPIRES_AT=${EXPIRES_AT_FOR_GITHUB}
EOF
echo "   => 出力完了。プロジェクトルートの .env_result を確認してください。"

echo "5. GitHubリポジトリのSecretsを更新します..."

# gh CLIを使ってSecretsを更新
# 事前に `gh auth login` でGitHubにログインし、`repo`スコープの権限を許可しておく必要があります。
echo "   - CLAUDE_ACCESS_TOKEN を更新中..."
echo "${ACCESS_TOKEN}" | $GH_CMD secret set CLAUDE_ACCESS_TOKEN --repo "${GITHUB_OWNER}/${GITHUB_REPO}"
echo "   - CLAUDE_REFRESH_TOKEN を更新中..."
echo "${REFRESH_TOKEN}" | $GH_CMD secret set CLAUDE_REFRESH_TOKEN --repo "${GITHUB_OWNER}/${GITHUB_REPO}"
echo "   - CLAUDE_EXPIRES_AT を更新中..."
echo "${EXPIRES_AT_FOR_GITHUB}" | $GH_CMD secret set CLAUDE_EXPIRES_AT --repo "${GITHUB_OWNER}/${GITHUB_REPO}"

echo "   => Secretsの更新が完了しました！"
echo "=================================================="
echo "" 