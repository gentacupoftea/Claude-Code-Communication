# AIレビューワーからの最終フィードバックを反映し、ワークフローを完成させる

## 概要

現在開かれているPR #75 (`feature/ultimate-auto-workflow`) に対し、AIレビューワーが提示した2回目の、より高度な改善提案をすべて適用します。
必須CIジョブの明示、判定ロジックの言語非依存化、そして堅牢な待機処理の実装により、ワークフローを完成形へと導きます。

## 実行計画

### Step 1: 最新の修正ブランチをチェックアウト

まず、作業対象のブランチ `feature/ultimate-auto-workflow` の最新の状態を取得してください。

```bash
git checkout feature/ultimate-auto-workflow
git pull origin feature/ultimate-auto-workflow
```

### Step 2: AIの最終指摘に基づき `claude-pr-review.yml` を完成させる

`.github/workflows/claude-pr-review.yml` ファイルを、以下の**完成版**の内容に完全に置き換えてください。

**ファイルパス:** `.github/workflows/claude-pr-review.yml`

**完成版ファイル内容:**
```yaml
name: 'PR Automation: Smart Review & Final Merge'

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  # === Job 1: AIレビューと内容判定（ゲートキーパー） ===
  ai_review_gatekeeper:
    runs-on: ubuntu-latest
    steps:
      - name: 'Checkout code'
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.ref }}
          fetch-depth: 0 

      - name: 'Setup Node.js'
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: 'Run Claude Review Action'
        continue-on-error: true
        uses: zbeekman/claude-pr-review-action@v1
        env:
          CLAUDE_API_KEY: ${{ secrets.CLAUDE_ACCESS_TOKEN }}
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PROMPT_FILE_PATH: 'docs/prompts/project_guidelines/comprehensive_development_guidelines.md'

      - name: 'Wait for review comment with retry'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          BOT_NAME: ${{ vars.AI_BOT_NAME || 'claude-bot' }}
        run: |
          set -euo pipefail
          echo "Waiting for review comment from bot: $BOT_NAME"
          for i in {1..6}; do
            # 最新のコメント投稿者を取得
            LATEST_COMMENT_AUTHOR=$(gh pr view $PR_NUMBER --json comments --jq '.comments[-1].author.login // ""')
            if [ "$LATEST_COMMENT_AUTHOR" == "$BOT_NAME" ]; then
              echo "✅ Review comment found."
              exit 0
            fi
            echo "Waiting for review comment... Attempt ($i/6)"
            sleep 10
          done
          echo "❌ Timed out waiting for review comment."
          exit 1

      - name: 'Check AI Review Result (Gatekeeper)'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          BOT_NAME: ${{ vars.AI_BOT_NAME || 'claude-bot' }}
          # 拒否キーワードをリポジトリ変数から取得
          REJECT_KEYWORDS: ${{ vars.AI_REJECT_KEYWORDS || '推奨しません|修正が必要です|改善提案|not recommended|needs fix|improvement needed' }}
        run: |
          set -euo pipefail
          COMMENT_BODY=$(gh pr view $PR_NUMBER --json comments --jq --arg BOT_NAME "$BOT_NAME" '.comments[] | select(.author.login == $BOT_NAME) | .body' | tail -n 1)
          
          if [ -z "$COMMENT_BODY" ]; then
            echo "❌ Could not find a review comment from the AI bot ($BOT_NAME)."
            exit 1
          fi

          # grep -E で拡張正規表現を使用
          if echo "$COMMENT_BODY" | grep -q -E "$REJECT_KEYWORDS"; then
            echo "❌ AI review requested changes. This PR will not be merged automatically."
            exit 1
          else
            echo "✅ AI review approved. This check is successful."
            exit 0
          fi
          
  # === Job 2: 自動マージ実行（最終的な門番） ===
  automerge:
    runs-on: ubuntu-latest
    # 【最重要】AIレビューと、"必須"のCIジョブがすべて完了するのを待つ
    needs: 
      - ai_review_gatekeeper
      # 実際のCIジョブ名を指定（他のワークフローファイルで定義されている必要があります）
      - 'E2E Validation / e2e-tests'
      - 'PR Validation / frontend-validation'

    # 先行するすべてのジョブが成功した場合のみ、このジョブを実行
    if: success()

    steps:
      - name: 'Enable auto-merge for PR'
        uses: peter-evans/enable-auto-merge-action@v3
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          pull-request-number: ${{ github.event.pull_request.number }}
          merge-method: merge
```

**【重要】変更点の解説:**
1.  **堅牢な待機処理:** 固定時間の `sleep` を廃止し、AIのコメントが見つかるまで最大60秒（10秒x6回）待機する、賢いリトライロジックを実装しました。
2.  **言語非依存の判定ロジック:** 拒否キーワードをリポジトリ変数 `vars.AI_REJECT_KEYWORDS` で管理できるようにし、日本語と英語の両方に対応するデフォルト値を設定しました。
3.  **必須CIジョブの明示:** `needs` セクションのCIジョブ名をコメントアウトから実際の定義に変更し、このワークフローが正しく他のCIを待つようにしました。

### Step 3: 最終改善をコミットしてプッシュ

変更をコミットし、既存のPR #75 にプッシュして更新してください。

```bash
git add .github/workflows/claude-pr-review.yml
git commit -m "feat: Implement final round of AI feedback for robust workflow"
git push origin feature/ultimate-auto-workflow
```

## 完了基準

*   `feature/ultimate-auto-workflow` ブランチの `claude-pr-review.yml` が、2回目のAIレビューの指摘をすべて反映した完成形になっている。
*   変更がリモートの `feature/ultimate-auto-workflow` ブランチにプッシュされ、PR #75 に反映されている。 