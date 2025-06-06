# タスク: 【CI最終防衛ライン】CI上で発覚した全ESLintエラーの完全撲滅

## 1. 作戦目標

CI/CDパイプラインの `frontend-validation` ジョブで検出された、すべてのESLintエラーを完全に修正し、CIをグリーンにすること。これが、このプロジェクトにおける静的コード解析に関する最後の修正タスクである。

## 2. インプット情報: CIからの最終通告

CIの `npm run build` ステップで、以下のエラーが大量に報告されている。

-   **`@typescript-eslint/no-unused-vars`**: 未使用変数
-   **`@typescript-eslint/no-explicit-any`**: `any`型の使用
-   **`@typescript-eslint/no-empty-object-type`**: `{}` 型の使用
-   **`react/display-name`**: Reactコンポーネントの表示名欠落
-   その他、関連する型エラー

## 3. 絶対遵守の戦闘原則

1.  **`no-unused-vars` 対策:**
    -   本当に不要な変数は、その定義ごと削除する。
    -   関数の引数など、意図的に使用しないものは、変数名の先頭にアンダースコアを追加する (`_variable`)。

2.  **`no-explicit-any` 対策:**
    -   **`any`の使用は絶対禁止。**
    -   可能な限り、具体的な `interface` や `type` を定義する。
    -   どうしても具体的な型が不明な場合は、`unknown` を使用し、利用箇所で型ガードを行う。

3.  **`no-empty-object-type` 対策:**
    -   `{}` は使用しない。
    -   「何らかのオブジェクト」を示したい場合は `object` を使用する。
    -   「キーが文字列で、値が未知のオブジェクト」を示したい場合は `Record<string, unknown>` を使用する。

4.  **`react/display-name` 対策:**
    -   `React.forwardRef` などで作成された無名コンポーネントには、`Component.displayName = 'ComponentName'` のように、適切な表示名を設定する。

## 4. 実行計画

### Step 1: 修正対象ブランチでの作業

必ず、現在CIが失敗しているプルリクエストのブランチで作業を行うこと。
```bash
git checkout chore/final-ci-validation
```

### Step 2: 全エラーの体系的修正

上記「インプット情報」でリストアップされたエラーログを基に、報告されているすべてのファイルを一つずつ、戦闘原則に従って修正する。

### Step 3: ローカルでの最終検証

すべての修正が完了した後、ローカル環境でCIが成功することを証明する。

1.  **Lintチェック:**
    ```bash
    npm run lint
    ```
    → **エラーゼロ、警告ゼロ**で完了すること。

2.  **ビルドチェック:**
    ```bash
    npm run build
    ```
    → 正常に完了すること。

### Step 4: 最終コミットとプッシュ

修正が完璧であることを確認した後、変更をコミットし、リモートブランチにプッシュして、CIに最終審判を委ねる。

```bash
git add .
git commit -m "fix: Resolve all outstanding ESLint and type errors found in CI"
git push
```

## 5. 完了報告

`git push` が完了したら、「CI最終防衛ラインの全修正を完了し、リモートブランチにプッシュしました。CIの結果を監視してください。」と報告せよ。 