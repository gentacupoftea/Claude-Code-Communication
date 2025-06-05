#!/bin/bash
# プロジェクトルールファイル同期確認スクリプト
# Version: v2.0 (プロジェクトルールファイル特化版)
# Author: Claude Code & プロジェクト管理者
# Description: mainブランチへのマージ・プッシュ前にプロジェクトルール関連ファイルの同期状況を確認

set -e  # エラー時に即座に終了

echo "=== プロジェクトルールファイル同期確認開始 ==="

# 1. 現在のブランチが main であることを確認
current_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
if [ "$current_branch" != "main" ]; then
    echo "❌ エラー: 現在のブランチが main ではありません (現在: $current_branch)"
    echo "   main ブランチに切り替えてから再実行してください"
    echo "   実行コマンド: git checkout main"
    exit 1
fi

echo "✅ 現在のブランチ: main"

# 2. 対象ファイル・ディレクトリの変更状況確認
target_files="my-cursor-rule.mdc docs/project_rules/ docs/prompts/"
echo "🔍 対象ファイル・ディレクトリの変更状況確認中..."
echo "   対象: $target_files"

# 未追跡ファイルと変更されたファイルの確認
untracked_files=$(git ls-files --others --exclude-standard $target_files 2>/dev/null || echo "")
modified_files=$(git diff --name-only $target_files 2>/dev/null || echo "")
staged_files=$(git diff --cached --name-only $target_files 2>/dev/null || echo "")

changes_detected=false

# 未追跡ファイルのチェック
if [ -n "$untracked_files" ]; then
    echo "⚠️  未追跡のプロジェクトルールファイルが検出されました:"
    echo "$untracked_files" | sed 's/^/   - /'
    changes_detected=true
fi

# 変更されたファイルのチェック
if [ -n "$modified_files" ]; then
    echo "⚠️  変更されたプロジェクトルールファイルが検出されました:"
    echo "$modified_files" | sed 's/^/   - /'
    changes_detected=true
fi

# ステージングされたファイルのチェック
if [ -n "$staged_files" ]; then
    echo "⚠️  ステージングされたプロジェクトルールファイルが検出されました:"
    echo "$staged_files" | sed 's/^/   - /'
    changes_detected=true
fi

# 3. 変更が検出された場合の処理
if [ "$changes_detected" = true ]; then
    echo ""
    echo "❌ プロジェクトルールファイルに未コミットの変更があります"
    echo ""
    echo "📋 対応手順:"
    echo "   1. 変更内容を確認してください:"
    echo "      git status"
    echo ""
    echo "   2. 必要に応じてファイルをステージング:"
    echo "      git add my-cursor-rule.mdc"
    echo "      git add docs/project_rules/"
    echo "      git add docs/prompts/"
    echo ""
    echo "   3. 変更をコミット:"
    echo "      git commit -m \"feat(project): プロジェクトルール更新\""
    echo ""
    echo "   4. このスクリプトを再実行してください:"
    echo "      ./scripts/ensure_project_rules_sync.sh"
    echo ""
    echo "💡 ヒント: 対象ファイルのみをまとめてステージングする場合:"
    echo "   git add my-cursor-rule.mdc docs/project_rules/ docs/prompts/"
    echo ""
    exit 1
fi

# 4. リモートとの同期状況確認
echo "🔄 リモートとの同期状況確認中..."

# リモートの存在確認
if ! git remote | grep -q "origin"; then
    echo "⚠️  リモートリポジトリ 'origin' が設定されていません"
    echo "   リモートを設定してから再実行してください"
    echo "   確認コマンド: git remote -v"
    exit 1
fi

# リモートの最新情報を取得
echo "   リモートから最新情報を取得中..."
if ! git fetch origin main --quiet 2>/dev/null; then
    echo "⚠️  リモートからの情報取得に失敗しました"
    echo "   ネットワーク接続とリモートリポジトリの設定を確認してください"
    echo "   手動確認コマンド: git fetch origin main"
    exit 1
fi

# ローカルとリモートの差分確認
echo "   ローカルとリモートの差分確認中..."
local_commits=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "0")
remote_commits=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "0")

# リモートに新しいコミットがある場合
if [ "$remote_commits" -gt 0 ]; then
    echo "⚠️  リモートの main ブランチに新しいコミットがあります ($remote_commits 件)"
    echo "   ローカルを最新化してから再実行してください:"
    echo "   git pull origin main"
    echo ""
    echo "📋 推奨手順:"
    echo "   1. リモートの変更をプル: git pull origin main"
    echo "   2. マージコンフリクトがあれば解決"
    echo "   3. このスクリプトを再実行"
    exit 1
fi

# ローカルに未プッシュのコミットがある場合
if [ "$local_commits" -gt 0 ]; then
    echo "ℹ️  ローカルにコミット済みの変更があります ($local_commits 件)"
    echo "   必要に応じて以下のコマンドでリモートに反映してください:"
    echo "   git push origin main"
    echo ""
fi

# 5. 成功時のメッセージ
echo ""
echo "✅ プロジェクトルールファイル同期確認完了"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   ✓ 対象ファイルに未コミットの変更はありません"
echo "   ✓ リモートとの同期状況を確認済みです"
if [ "$local_commits" -gt 0 ]; then
    echo "   ⚠ ローカルに未プッシュのコミットがあります ($local_commits 件)"
    echo "   ✓ main ブランチへの操作を実行できます（プッシュ推奨）"
else
    echo "   ✓ ローカルとリモートは完全に同期されています"
    echo "   ✓ main ブランチへの操作を安全に実行できます"
fi
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 6. 推奨される次のアクション
echo "🚀 次のアクション:"
if [ "$local_commits" -gt 0 ]; then
    echo "   1. [推奨] ローカルの変更をリモートにプッシュ: git push origin main"
    echo "   2. フィーチャーブランチのマージやその他のmain操作を実行"
else
    echo "   1. フィーチャーブランチのマージやその他のmain操作を安全に実行可能"
fi
echo ""

# 正常終了
exit 0