#!/bin/bash
# agent-send.sh - Script to send commands to Cerberus agents (v3.0 - Cerberus Edition)

SESSION_NAME="cerberus"
AGENT_MAP=(
  [0]="President"
  [1]="PM: Athena (Synthesizer)"
  [2]="PM: Apollo (Innovator)"
  [3]="PM: Hephaestus (Stabilizer)"
  [4]="Worker 1"
  [5]="Worker 2"
  [6]="Worker 3"
  [7]="Worker 4"
  [8]="Worker 5"
  [9]="Worker 6"
)
NUM_AGENTS=${#AGENT_MAP[@]}

# --- List Agents ---
if [ "$1" == "--list" ]; then
    echo "📋 Cerberus エージェント構成:"
    echo "=========================="
    for i in "${!AGENT_MAP[@]}"; do
        printf "  %s: %s\n" "$i" "${AGENT_MAP[$i]}"
    done
    echo "--------------------------"
    echo "  all_workers → 全ワーカー(4-9)に一括送信します"
    echo "  all_pms     → 全PM(1-3)に一括送信します"
    exit 0
fi

# --- Input Validation ---
if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <pane_id|all_workers|all_pms> \"<message>\""
    echo "       $0 <pane_id|all_workers|all_pms> -f <file_path>"
    echo "       pane_id: 0 for President, 1-3 for PMs, 4-9 for Workers"
    echo "       $0 --list でIDを確認"
    exit 1
fi

AGENT_TARGET=$1
MESSAGE_SOURCE=$2

# --- Message Loading ---
MESSAGE=""
if [ "$MESSAGE_SOURCE" == "-f" ] || [ "$MESSAGE_SOURCE" == "--file" ]; then
    if [ -z "$3" ] || [ ! -f "$3" ]; then
        echo "❌ エラー: ファイルが指定されていないか、見つかりません: $3" >&2
        exit 1
    fi
    MESSAGE=$(cat "$3")
else
    MESSAGE=$2
fi

# --- Pre-flight Check ---
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "❌ エラー: Cerberusセッション '$SESSION_NAME' が見つかりません。" >&2
    exit 1
fi

# --- Message Sending Function ---
send_message_to_pane() {
    local pane_id=$1
    local msg=$2
    local agent_name=${AGENT_MAP[$pane_id]}

    local target_pane="${SESSION_NAME}:0.${pane_id}"

    if ! tmux list-panes -t "$SESSION_NAME:0" -F "#{pane_index}" | grep -q "^${pane_id}$"; then
        echo "❌ エラー: Pane ID '$pane_id' (${agent_name}) は存在しません。" >&2
        return 1
    fi

    tmux load-buffer -b tmp_agent_send_buffer - <<< "$msg"
    tmux paste-buffer -b tmp_agent_send_buffer -t "$target_pane"
    sleep 0.2
    tmux send-keys -t "$target_pane" C-m
    tmux delete-buffer -b tmp_agent_send_buffer
    
    truncated_msg=$(echo "$msg" | cut -c 1-40)
    echo "📤 送信完了: ${agent_name} (pane ${pane_id}) ← '${truncated_msg}...'."
}

# --- Target Resolution and Message Delivery ---
case "$AGENT_TARGET" in
    all_workers)
        echo "📢 全ワーカーにタスクを送信します..."
        for i in {4..9}; do
            send_message_to_pane "$i" "$MESSAGE"
        done
        echo "✅ 全ワーカーへの送信が完了しました。"
        ;;
    all_pms)
        echo "📢 全PMにメッセージを送信します..."
        for i in {1..3}; do
            send_message_to_pane "$i" "$MESSAGE"
        done
        echo "✅ 全PMへの送信が完了しました。"
        ;;
    *)
        if [[ $AGENT_TARGET =~ ^[0-9]+$ ]] && [ -n "${AGENT_MAP[$AGENT_TARGET]}" ]; then
            send_message_to_pane "$AGENT_TARGET" "$MESSAGE"
        else
            echo "❌ エラー: 不明なターゲット '$AGENT_TARGET'。Pane ID (数字) を使用してください。" >&2
            echo "利用可能なIDは '$0 --list' で確認してください。" >&2
            exit 1
        fi
        ;;
esac 