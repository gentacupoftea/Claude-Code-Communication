# Claude Code Self-Review Prompt: Task 45.1 - LocalLLMWorker Implementation

## 概要 (Overview)

こんにちは、Claude Code！

あなたは今から、非常に厳格なコードレビュワーです。私たちのチームは、`main`ブランチの品質を何よりも重視しています。CI/CDパイプラインがまだ完全に安定していないため、Pull Request作成前のこのセルフレビューが品質を保証する最後の砦となります。

あなたの任務は、先ほど完了したタスク `45.1: LocalLLMWorkerの実装` のコードを、私たちの開発憲法に基づき、一切の妥協なくレビューすることです。

## レビュー対象ファイル (Files for Review)

以下の3つのファイルがレビュー対象です。

1.  `multiLLM_system/config/settings.py`
2.  `multiLLM_system/workers/local_llm_worker.py`
3.  `multiLLM_system/orchestrator/worker_factory.py`

## レビューの観点 (Review Checklist)

**最重要:** すべてのチェックは `docs/prompts/project_guidelines/comprehensive_development_guidelines.md` の内容に厳密に従ってください。

### 1. 開発憲法の遵守 (Constitutional Adherence)
- **[ ] 型安全 (Type Safety):** `any`型のような曖昧な型定義は使用されていないか？すべての関数、変数に適切な型ヒントが付与されているか？
- **[ ] アーキテクチャの一貫性:** `LocalLLMWorker`は`BaseWorker`を正しく継承しているか？プロジェクト全体の設計思想から逸脱していないか？
- **[ ] プロジェクト構造:** ファイルは適切なディレクトリに配置されているか？

### 2. コード品質とベストプラクティス (Code Quality & Best Practices)
- **[ ] 可読性 (Readability):** 変数名や関数名は、その役割がひと目でわかるように明確か？複雑なロジックには、その意図を説明するコメントが付与されているか？
- **[ ] Docstrings:** すべての公開クラス、メソッドに、その目的、引数、返り値を説明するdocstringが記述されているか？
- **[ ] エラーハンドリング (Error Handling):** `LocalLLMWorker`内の`requests.post`呼び出しは、タイムアウト、接続エラー、4xx/5xx系のHTTPエラーなど、起こりうる失敗ケースを適切に処理できているか？例外処理は十分堅牢か？
- **[ ] 設定管理 (Configuration):** `settings.py`の使い方は適切か？URLやモデル名などの設定値がハードコードされていないか？
- **[ ] 依存関係 (Dependencies):** 新しく追加された`requests`ライブラリは、`multiLLM_system/requirements.txt`に追記されているか？（**これは非常に重要なチェック項目です！**）

### 3. 機能要件の達成度 (Functional Requirements)
- **[ ] プロンプトの要件を満たしているか:** `LocalLLMWorker`は、`Task 45.1`の実行プロンプトで指示された機能をすべて満たしているか？
- **[ ] 拡張性 (Extensibility):** `WorkerFactory`は、将来的にさらに別のワーカーを追加しやすいように実装されているか？

## 出力形式 (Output Format)

レビューが完了したら、以下の形式で**Pull Requestレビュー概要**を出力してください。この概要は、そのまま実際のPull RequestのDescriptionに貼り付けられるように、明確かつ簡潔に記述してください。

---

### Pull Request レビュー概要

**1. 総合評価 (Overall Assessment):**
（レビュー結果の総括を記述。例：「全体的によく書けていますが、いくつかの重要な修正が必要です。」）

**2. 指摘事項と修正提案 (Issues and Suggestions):**
（問題点、懸念点、改善提案を箇条書きで具体的にリストアップ。修正が必要なコードスニペットも提示すること。）

- **[重大/Must Fix] `requirements.txt`の更新漏れ:**
  - `requests`ライブラリが追加されていません。`multiLLM_system/requirements.txt`に`requests`を追加してください。
- **[改善提案/Suggestion] エラーハンドリングの強化:**
  - （具体的なコードを提示して、どのように改善すべきかを示す）

**3. 最終判定 (Final Verdict):**
（「修正後、PR作成可能」「PR作成可能」「要再設計」のいずれかで判定）

---

一切の見逃しは許されません。最高の品質を目指して、徹底的なレビューをお願いします！ 