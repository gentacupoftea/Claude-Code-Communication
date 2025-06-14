#!/usr/bin/env bash

# 🚀 Chimera Agent間メッセージ送信スクリプト (v2 - Title-Based Targeting)

SESSION_NAME="chimera"

# エージェント名から動的にPane IDを取得する
get_pane_id_by_agent_name() {
    local agent_name="$1"
    local target_title=""

    # agent_name (e.g., "worker1") を Pane Title (e.g., "Worker 1") に変換
    if [[ "$agent_name" == "president" ]]; then
        target_title="President"
    elif [[ "$agent_name" =~ ^worker([1-6])$ ]]; then
        local worker_num="${BASH_REMATCH[1]}"
        target_title="Worker $worker_num"
    else
        # 不明なエージェント名
        echo ""
        return 1
    fi

    # tmuxからPane Titleに一致するPane IDを検索
    local pane_id
    pane_id=$(tmux list-panes -s -t "$SESSION_NAME" -F '#{pane_id} #{pane_title}' 2>/dev/null | grep -wF "$target_title" | awk '{print $1}')

    if [[ -z "$pane_id" ]]; then
        # Paneが見つからない
        echo ""
        return 1
    fi
    
    echo "$pane_id"
    return 0
}


show_usage() {
    cat << EOF
🤖 Chimera Agent間メッセージ送信

使用方法:
  $0 [エージェント名] [メッセージ]
  $0 --list

利用可能エージェント:
  president
  worker1, worker2, worker3, worker4, worker5, worker6

使用例:
  $0 president "全ワーカーに進捗報告を要求せよ"
  $0 worker1 "タスク完了。API接続に成功しました"
EOF
}

# エージェント一覧表示
show_agents() {
    echo "📋 Chimeraチーム 利用可能エージェント:"
    echo "======================================"
    echo "  • president"
    for i in {1..6}; do
        echo "  • worker$i"
    done
    echo "--------------------------------------"
    echo "Note: 送信先はPaneのタイトルを元に動的に決定されるため、クラッシュ後の手動再起動にも対応しています。"
}

# ログ記録
log_send() {
    local agent="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # スクリプト自身のディレクトリを基準にlogsディレクトリを作成
    local script_dir
    script_dir=$(dirname "$(realpath "$0")")
    mkdir -p "$script_dir/logs"
    echo "[$timestamp] $agent: SENT - \"$message\"" >> "$script_dir/logs/send_log.txt"
}

# メッセージ送信
send_message() {
    local pane_id="$1"
    local message="$2"
    
    echo "📤 送信中: Pane($pane_id) ← '$message'"
    
    # Claude Codeのプロンプトを一度クリア (Ctrl+C)
    tmux send-keys -t "$pane_id" C-c
    sleep 0.2
    
    # メッセージをペースト (-l オプションでリテラル送信)
    tmux send-keys -l -t "$pane_id" "$message"
    sleep 0.1
    
    # エンター押下で実行
    tmux send-keys -t "$pane_id" C-m
}

# ターゲットセッション存在確認
check_session() {
    if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        echo "❌ エラー: Chimeraセッション '$SESSION_NAME' が見つかりません。"
        echo "start-chimera.sh を実行してチームを起動してください。"
        return 1
    fi
    return 0
}

# メイン処理
main() {
    if [[ "$1" == "--list" || "$1" == "-l" ]]; then
        show_agents
        exit 0
    fi
    
    if [[ $# -lt 2 ]]; then
        show_usage
        exit 1
    fi
    
    if ! check_session; then
        exit 1
    fi
    
    local agent_name="$1"
    shift # 最初の引数（エージェント名）を消費
    local message="$*" # 残りの引数全てをメッセージとして結合
    
    # エージェントターゲット取得
    local pane_id
    pane_id=$(get_pane_id_by_agent_name "$agent_name")
    
    if [[ -z "$pane_id" ]]; then
        echo "❌ エラー: エージェント '$agent_name' が見つかりません。アクティブな Chimera セッション内に正しいタイトルを持つPaneが存在するか確認してください。"
        echo "利用可能なエージェント名については '$0 --list' を実行してください。"
        exit 1
    fi
    
    # メッセージ送信
    send_message "$pane_id" "$message"
    
    # ログ記録
    log_send "$agent_name" "$message"
    
    echo "✅ 送信完了: $agent_name (Pane: $pane_id) へメッセージを送信しました。"
}

main "$@" 