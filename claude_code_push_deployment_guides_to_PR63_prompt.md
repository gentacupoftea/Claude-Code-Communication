## Claude Code 指示: デプロイメントガイドをPR #63のブランチへプッシュ 確実化プロンプト 📄🚀

こんにちは、Claude Code！

現在、MVPリリースに向けたデプロイメントプロセス改善 (Task ID 44) の一環として、以下の2つの重要なデプロイメントガイドファイルが存在しています。

1.  `docs/infrastructure/deployment_guide.md` (メインのインフラ・デプロイガイド)
2.  `docs/deployment_guide.md` (一般的なデプロイガイド)

これらのファイルが、PR #63 (`https://github.com/gentacupoftea/conea-integration/pull/63`) の対象となっているフィーチャーブランチ (例: `feature/deployment-process-improvements` や、PR #63 が現在指しているブランチ名を確認してください) に、**最新の状態で確実に含まれている必要**があります。

以下の手順に従って、これらのファイルが正しくコミット＆プッシュされていることを確認し、もし未反映であれば対応してください。

**手順:**

1.  **対象ブランチの確認と切り替え:**
    *   PR #63 がどのフィーチャーブランチを指しているか正確に確認してください。
    *   ローカルでそのフィーチャーブランチに切り替えてください。(例: `git checkout feature/deployment-process-improvements`)
    *   念のため `git pull origin YOUR_FEATURE_BRANCH_NAME` を実行して、リモートブランチの最新状態にしてください。

2.  **ファイルの状態確認とコミット:**
    *   ローカルの作業ディレクトリで、上記の2つの `deployment_guide.md` ファイルが最新の内容になっていることを確認してください。（もしあなたがこれらのファイルを編集・更新した最終版が手元にあれば、それが対象です）
    *   `git status` を実行して、これらのファイルに変更があるか（modified）、またはまだ追跡されていないか（untracked）を確認してください。
    *   もし変更がある、または追跡されていない場合は、以下のコマンドでステージングし、コミットしてください。
        ```bash
        git add docs/infrastructure/deployment_guide.md docs/deployment_guide.md
        git commit -m "docs: Ensure latest deployment guides for PR #63 (Task 44)"
        ```
        (コミットメッセージは適宜調整してください。もし既存のコミットに含めるべき場合は `git commit --amend` などを使用しても構いませんが、安全のため新しいコミットを推奨します。)
    *   もし `git status` でこれらのファイルに変更がない場合、既に最新版がコミットされている可能性が高いですが、念のためファイルの内容を確認してください。

3.  **リモートブランチへのプッシュ:**
    *   ステップ2で新しいコミットを作成した場合、またはローカルブランチがリモートブランチより進んでいる場合は、変更をリモートのフィーチャーブランチにプッシュしてください。
        ```bash
        git push origin YOUR_FEATURE_BRANCH_NAME
        ```

4.  **GitHub上での確認 (推奨):**
    *   可能であれば、GitHub上でPR #63の「Files changed」タブを確認し、2つのデプロイメントガイドが期待通りの内容で表示されているか確認してください。

5.  **完了報告:**
    *   上記の手順が完了したら、「デプロイメントガイドのPR #63へのプッシュ確認・対応が完了しました。」と報告してください。

**次のステップ:**
この作業が完了次第、PR #63 全体に対するセルフレビューを `claude_code_self_review_prompt_Task44_デプロイ準備.md` の指示に従って開始してください。

正確かつ慎重な作業をお願いします！👷‍♂️ 