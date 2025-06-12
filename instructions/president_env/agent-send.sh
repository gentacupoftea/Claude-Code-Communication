#!/bin/bash
# agent-send.sh - Script to send commands to Chimera agents (v2.0 - ID-Only Communication)

SESSION_NAME="chimera"
NUM_WORKERS=6 # Total number of workers

# --- List Agents ---
if [ "$1" == "--list" ]; then
    echo "📋 Chimeraエージェント構成:"
    echo "=========================="
    echo "  0: President"
    for i in $(seq 1 $NUM_WORKERS); do
        echo "  $i: Worker $i"
    done
    echo "--------------------------"
    echo "  all_workers → 全ワーカー(1-$NUM_WORKERS)に一括送信します"
    exit 0
fi

# --- Input Validation ---
if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <pane_id|all_workers> \"<message>\""
    echo "       pane_id: 0 for President, 1-$NUM_WORKERS for Workers"
    echo "       $0 --list"
    exit 1
fi

AGENT_TARGET=$1
MESSAGE=$2

# --- Pre-flight Check ---
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "❌ エラー: Chimeraセッション '$SESSION_NAME' が見つかりません。" >&2
    exit 1
fi

# --- Message Sending Function ---
send_message_to_pane() {
    local pane_id=$1
    local msg=$2
    local agent_name=$3

    local target_pane="${SESSION_NAME}:0.${pane_id}"

    # Check if pane exists before sending
    if ! tmux list-panes -t "$SESSION_NAME:0" -F "#{pane_index}" | grep -q "^${pane_id}$"; then
        echo "❌ エラー: Pane ID '$pane_id' (${agent_name}) は存在しません。" >&2
        return 1
    fi

    # This is the most reliable method found after many trials.
    tmux load-buffer -b tmp_agent_send_buffer - <<< "$msg"
    tmux paste-buffer -b tmp_agent_send_buffer -t "$target_pane"
    sleep 0.1 # Reduced sleep time for faster execution
    tmux send-keys -t "$target_pane" C-m
    tmux delete-buffer -b tmp_agent_send_buffer
    
    truncated_msg=$(echo "$msg" | cut -c 1-40)
    echo "📤 送信完了: ${agent_name} (pane ${pane_id}) ← '${truncated_msg}...'."
}

# --- Target Resolution and Message Delivery ---
if [ "$AGENT_TARGET" == "all_workers" ]; then
    echo "📢 全ワーカーにタスクを送信します..."
    for i in $(seq 1 $NUM_WORKERS); do
        send_message_to_pane "$i" "$MESSAGE" "Worker $i"
    done
    echo "✅ 全ワーカーへの送信が完了しました。"
elif [[ $AGENT_TARGET =~ ^[0-9]+$ ]]; then
    PANE_ID=$AGENT_TARGET
    AGENT_NAME="Unknown"
    if [ "$PANE_ID" -eq 0 ]; then
        AGENT_NAME="President"
    elif [ "$PANE_ID" -ge 1 ] && [ "$PANE_ID" -le $NUM_WORKERS ]; then
        AGENT_NAME="Worker $PANE_ID"
    else
        echo "❌ エラー: Pane ID '$PANE_ID' は範囲外です (0-$NUM_WORKERS)。" >&2
        exit 1
    fi
    send_message_to_pane "$PANE_ID" "$MESSAGE" "$AGENT_NAME"
else
    echo "❌ エラー: 不明なターゲット '$AGENT_TARGET'。Pane ID (数字) を使用してください。" >&2
    echo "利用可能なIDは '$0 --list' で確認してください。" >&2
    exit 1
fi 