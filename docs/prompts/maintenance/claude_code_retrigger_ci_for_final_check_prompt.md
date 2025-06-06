# タスク: 【CI最終検証】修正済みCI/CD環境の最終確認プルリクエスト

## 1. 作戦目標

CI/CD環境とコードベースの修正がすべて完了したことを最終確認するため、新しいプルリクエストを作成し、`pr-validation`と`e2e-tests`の両方のCIジョブが完全に成功すること（緑のチェックマークが付くこと）を実証する。

## 2. 背景

以前のテストPR(#67)は、コードベースのESLintエラーや、CI設定の不備（PlaywrightとCypressの混同など）が原因で失敗した。それらの問題はすべて修正されたはずである。このタスクは、その修正が完璧であったことを証明するための、最後のテストPR作成である。

## 3. 実行計画

### Step 1: 環境のクリーンアップ

1.  **`main`ブランチの最新化:**
    ローカルの`main`ブランチを最新の状態に更新する。
    ```bash
    git checkout main
    git pull origin main
    ```

2.  **古いテストPRのクローズ:**
    不要になった古いテストPR(#67)をクローズする。
    ```bash
    gh pr close 67
    ```

3.  **古いテストブランチの削除:**
    ローカルとリモートの古いテストブランチを完全に削除し、混乱の元を断つ。
    ```bash
    git branch -D chore/trigger-new-ci-workflows
    git push origin --delete chore/trigger-new-ci-workflows
    ```

### Step 2: 新しいテストPRの準備

1.  **新しい作業ブランチの作成:**
    今回の最終確認のためだけの、新しいブランチを作成する。
    ```bash
    git checkout -b chore/final-ci-validation
    ```

2.  **無害な変更の作成:**
    CIをトリガーするため、`README.md`に追記する（以前の追記は上書きされるので問題ない）。
    ```bash
    echo "\n# Final CI Validation Trigger" >> README.md
    ```

3.  **変更のコミット:**
    ```bash
    git add README.md
    git commit -m "chore: Final validation of CI/CD pipeline"
    ```

### Step 3: 最終審判のプルリクエスト作成

1.  **リモートへのプッシュ:**
    ```bash
    git push -u origin chore/final-ci-validation
    ```

2.  **プルリクエストの作成:**
    `git push` の後に表示されるURLから、`main`ブランチに対するプルリクエストを作成する。

    -   **タイトル:** `chore: Final CI/CD Validation`
    -   **本文:** `This PR serves as the final validation that all codebase and CI/CD issues have been resolved. Both 'pr-validation' and 'e2e-tests' checks are expected to pass.`

## 4. 完了報告

新しいプルリクエストの作成が完了したら、そのURLを共有して報告してください。その後、私たちは固唾をのんでCIの結果を見守ります。 