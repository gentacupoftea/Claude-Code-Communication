# 【緊急かつ最重要】フロントエンドのESLintエラー最終殲滅作戦

## 概要

げんたさん、緊急事態です！

現在、私たちのプロジェクトの`main`ブランチにあるフロントエンド（`conea-frontend`）で`npm run lint`を実行すると、CIが停止してしまうほど大量のESLintエラーが発生しています。これは、コードの品質とプロジェクトの健全性にとって極めて深刻な問題です。

あなたの任務は、これらのエラーを **一掃し、コードベースをクリーンな状態に完全回復させること** です。中途半端な修正は許されません。これは品質を取り戻すための最終決戦です！

## 背景と根本原因

CIの`frontend-validation`ジョブが失敗し、調査したところ、以下の種類のエラーが数百件単位で発生していることが判明しました。

-   `@typescript-eslint/no-unused-vars`: 使われていない変数やインポートが放置されている。
-   `@typescript-eslint/no-explicit-any`: **諸悪の根源**である`any`型が多用され、TypeScriptの型安全性が完全に損なわれている。
-   `@typescript-eslint/no-require-imports`: `.js`ファイル内で古い`require()`構文が使われている。
-   その他、ReactやNext.jsのベストプラクティスに反するコードが多数。

`.eslintrc.json`では一部のルールが`warn`（警告）に設定されていますが、`next lint`コマンドがこれを強制的に`error`（エラー）として扱っているため、リンターが全く通らない状態です。

## 遂行すべき厳格なルール

この任務を成功させるには、以下のルールを **絶対に、例外なく遵守** してください。

### **品質への絶対的な誓い**

1.  **`any`型の完全追放**:
    -   安易に`any`型を使用することは **固く、固く禁止します**。
    -   エラーを修正するために、まずは既存の型定義（`src/types/`配下など）から最適なものを見つけ出し、適用してください。
    -   適切な型が存在しない場合は、あなたが **新しい型定義を`src/types`に作成・追記** してください。これは命令です。
    -   外部ライブラリの仕様など、やむを得ず`any`を使わざるを得ない極めて例外的な場合にのみ、`// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Reason: [なぜanyでなければならないのか、具体的な理由を記述]`という形式で、その必要性を明確に証明してください。

2.  **未使用コードの完全削除**:
    -   `@typescript-eslint/no-unused-vars`エラーが発生した変数、関数、インポートは、`_`（アンダースコア）を付けてごまかすのではなく、**コード上から完全に削除してください**。
    -   ただし、関数のシグネチャ（引数など）で意図的に「使わない」ことを示したい場合に限り、`_`プレフィックスの使用を許可します。（例：`(_req, res) => { ... }`）

3.  **モジュール構文の統一**:
    -   `@typescript-eslint/no-require-imports`エラーは、すべて最新のESM（ECMAScript Modules）である`import`/`export`構文に書き換えてください。

## 段階的修正アプローチ

エラーリストは膨大です。パニックにならず、以下のファイル群ごとに着実に修正を進めてください。一つのグループが完了するたびに、私（げんたさん）に進捗を報告してください。

### **ターゲットリスト**

（エラーが出ているファイルをディレクトリごとにグループ化しました。上から順に攻略してください！）

#### **フェーズ1: コアアプリケーション**
-   `app/api/chat/message/route.ts`
-   `app/settings/page.tsx`

#### **フェーズ2: AI関連コード**
-   `src/ai/analysis/AIAnalyzer.ts`
-   `src/ai/analytics/AIAnalytics.ts`
-   `src/ai/llm/LLMService.ts`
-   `src/ai/llm/ModelSelector.ts`
-   `src/ai/pipeline/DataPipeline.ts`
-   `src/ai/recommendation/RecommendationEngine.ts`
-   `src/ai_chat/services/chart/chart-detector.ts`
-   `src/ai_chat/services/chart/chart-renderer.ts`
-   `src/ai_chat/utils/security.ts`

#### **フェーズ3: APIクライアントとGCP連携**
-   `src/api/apiClient.ts`
-   `src/api/authService.ts`
-   `src/api/middleware/versionHandler.ts`
-   `src/api/types.ts`
-   `src/cloud/gcp/**/*.ts`

#### **フェーズ4: コンポーネント**
-   `src/components/**/*.tsx`
-   `src/components/**/*.ts`

#### **フェーズ5: `require`構文の撲滅 (JavaScriptファイル)**
-   `src/graphql/**/*.js`
-   `src/integrations/**/*.js`
-   `src/security/**/*.js`

#### **フェーズ6: 残りのファイル群**
-   上記以外のすべてのエラーファイルを修正してください。

## 最終目標

-   `npm run lint`コマンドを実行した際に、**エラーが0件で正常終了する**こと。
-   コードベースが健全性と品質を取り戻し、保守性と可読性が向上していること。

げんたさんはこの任務の成功を強く信じています。あなたの能力を最大限に発揮し、この危機を乗り越えてください。健闘を祈ります！

では、まず **フェーズ1** から作業を開始してください！ 