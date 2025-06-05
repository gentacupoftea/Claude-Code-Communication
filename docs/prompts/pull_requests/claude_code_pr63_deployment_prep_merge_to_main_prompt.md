## Claude Code 指示: PR #63 (デプロイ準備) を main へマージ & 同期 🛡️

こんにちは、Claude Code！

PR #63 (`https://github.com/gentacupoftea/conea-integration/pull/63`) 、タスクID 44「デプロイメントプロセス最終確認とドキュメント整備」のセルフレビュー、お疲れ様でした！「EXCELLENT」評価とのことで、MVPリリースに向けて万全の準備が整いましたね！🎉

この重要な成果を `main` ブランチに統合しましょう。以下の手順に従って、正確かつ慎重にマージ作業を進めてください。

**前提:**
*   PR #63 はセルフレビューが完了し、マージ可能な状態であること。
*   関連するTask Master AIのタスクIDは **44** です。

**手順:**

1.  **ローカル `main` ブランチの最新化:**
    ```bash
    git checkout main
    git pull origin main
    ```

2.  **フィーチャーブランチのチェックアウトと `main` の取り込み:**
    *   PR #63 に対応するフィーチャーブランチ名を正確に確認し、チェックアウトしてください。（例: `feature/deployment-process-improvements`）
    ```bash
    git checkout YOUR_FEATURE_BRANCH_NAME_FOR_PR63
    git pull origin YOUR_FEATURE_BRANCH_NAME_FOR_PR63
    git merge main
    ```
    *   もしコンフリクトが発生した場合は、慎重に解決してください。解決後、変更をコミットし、再度フィーチャーブランチをプッシュしてください。
    ```bash
    # (コンフリクト解決後)
    git add .
    git commit -m "fix: Resolve conflicts with main before merging PR #63"
    git push origin YOUR_FEATURE_BRANCH_NAME_FOR_PR63
    ```

3.  **GitHub上でPull Requestをマージ:**
    *   GitHubのPR #63 (`https://github.com/gentacupoftea/conea-integration/pull/63`) のページにアクセスしてください。
    *   すべてのチェックがパスし、コンフリクトがないことを最終確認してください。
    *   「Merge pull request」ボタンをクリックしてマージを実行してください。
    *   マージ方法は「Create a merge commit」を推奨しますが、プロジェクトのルールに従ってください。

4.  **マージ後のローカル環境同期:**
    *   ローカルの `main` ブランチを再度チェックアウトし、リモートの変更を取り込みます。
    ```bash
    git checkout main
    git pull origin main
    ```

5.  **作業ブランチの削除 (ローカル & リモート):**
    *   マージが完了したフィーチャーブランチは不要になるため、ローカルとリモートから削除します。
    ```bash
    git branch -d YOUR_FEATURE_BRANCH_NAME_FOR_PR63
    git push origin --delete YOUR_FEATURE_BRANCH_NAME_FOR_PR63
    ```
    *   (ブランチ名が正確であることを再度確認してください。)

6.  **Task Master AI のステータス更新:**
    *   Task Master AIにアクセスし、タスクID **44** のステータスを「**done**」に更新してください。
    *   タスクのコメントや詳細に、マージされたPR #63のリンクを追記しておくと良いでしょう。

7.  **完了報告:**
    *   上記すべての手順が完了したら、「PR #63 (Task ID 44) の `main` ブランチへのマージと同期が完了しました。」と報告してください。

慎重な操作をお願いします。特にコンフリクト解決時は、デプロイ手順やスクリプトの整合性を保つよう細心の注意を払ってください。

よろしくお願いします！💪 