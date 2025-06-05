## Claude Code 指示: PR #62 (UI/UX改善) を main へマージ & 同期 🎨

こんにちは、Claude Code！

PR #62 (`https://github.com/gentacupoftea/conea-integration/pull/62`) 、タスクID 42「UI/UX最終ブラッシュアップとレスポンシブ対応強化」のセルフレビューが完了し、マージ可能な状態になったら、この指示に従って `main` ブランチへの統合をお願いします！

**前提:**
*   PR #62 はセルフレビューが完了し、マージ可能な状態であること。
*   関連するTask Master AIのタスクIDは **42** です。

**手順:**

1.  **ローカル `main` ブランチの最新化:**
    ```bash
    git checkout main
    git pull origin main
    ```

2.  **フィーチャーブランチのチェックアウトと `main` の取り込み:**
    *   PR #62 に対応するフィーチャーブランチ名を正確に確認し、チェックアウトしてください。（例: `feature/ui-ux-improvements`）
    ```bash
    git checkout YOUR_FEATURE_BRANCH_NAME_FOR_PR62
    git pull origin YOUR_FEATURE_BRANCH_NAME_FOR_PR62
    git merge main
    ```
    *   もしコンフリクトが発生した場合は、慎重に解決してください。解決後、変更をコミットし、再度フィーチャーブランチをプッシュしてください。
    ```bash
    # (コンフリクト解決後)
    git add .
    git commit -m "fix: Resolve conflicts with main before merging PR #62"
    git push origin YOUR_FEATURE_BRANCH_NAME_FOR_PR62
    ```

3.  **GitHub上でPull Requestをマージ:**
    *   GitHubのPR #62 (`https://github.com/gentacupoftea/conea-integration/pull/62`) のページにアクセスしてください。
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
    git branch -d YOUR_FEATURE_BRANCH_NAME_FOR_PR62
    git push origin --delete YOUR_FEATURE_BRANCH_NAME_FOR_PR62
    ```
    *   (ブランチ名が正確であることを再度確認してください。)

6.  **Task Master AI のステータス更新:**
    *   Task Master AIにアクセスし、タスクID **42** のステータスを「**done**」に更新してください。
    *   タスクのコメントや詳細に、マージされたPR #62のリンクを追記しておくと良いでしょう。

7.  **完了報告:**
    *   上記すべての手順が完了したら、「PR #62 (Task ID 42) の `main` ブランチへのマージと同期が完了しました。」と報告してください。

慎重な操作をお願いします。特にコンフリクト解決時は、UI/UXの意図を正確に理解し、他の機能に影響が出ないよう注意してください。

よろしくお願いします！💪 