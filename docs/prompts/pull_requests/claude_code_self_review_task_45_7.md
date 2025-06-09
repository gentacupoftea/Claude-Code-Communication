# Claude Code Self-Review Prompt: Task 45.7 - Env Setup & Health Check

## 概要 (Overview)

こんにちは、Claude Code！

あなたの任務は、`Task 45.7`で実装された「環境設定ファイル」と「ヘルスチェックAPI」の品質を、開発憲法に基づき厳格にレビューすることです。これらは開発体験とシステムの安定性に直結するため、非常に重要なレビューとなります。

## レビュー対象ファイル (Files for Review)

1.  `multiLLM_system/.env.example`
2.  `multiLLM_system/api/server.py` (ヘルスチェックエンドポイントが追加された部分)

## レビューの観点 (Review Checklist)

**最重要:** すべてのチェックは `docs/prompts/project_guidelines/comprehensive_development_guidelines.md` の内容に厳密に従ってください。

### 1. `.env.example` のレビュー
- **[ ] 明確さ (Clarity):** 各環境変数の目的が、コメントによって明確に説明されているか？
- **[ ] 完全性 (Completeness):** ローカルLLM機能を使う上で、開発者が必要とするであろう環境変数がすべて網羅されているか？（例: `OLLAMA_API_URL`, `LOCAL_LLM_MODEL`）
- **[ ] セキュリティ (Security):** 実際のAPIキーやパスワードなどの機密情報が誤って含まれていないか？値はすべてプレースホルダーになっているか？
- **[ ] 形式 (Formatting):** `.ini`形式として正しく、読みやすいか？

### 2. ヘルスチェックエンドポイント (`/health/ollama`) のレビュー
- **[ ] 正確性 (Correctness):** エンドポイントは意図通りに動作するか？
    -   Ollamaサーバーが正常な場合、ステータスコード`200`と`{"status": "ok"}`を含む正しいJSONレスポンスを返すか？
    -   Ollamaサーバーがダウンしている場合、ステータスコード`503`と問題の詳細を含むエラーレスポンスを返すか？
- **[ ] 堅牢性 (Robustness):**
    -   `requests.get`呼び出しに、適切なタイムアウト（例: 5秒程度）が設定されているか？
    -   接続エラー、タイムアウト、不正なレスポンスなど、`requests`ライブラリが送出しうる様々な例外を`try...except`ブロックで適切に捕捉できているか？
- **[ ] コード品質 (Code Quality):**
    -   関数に、その目的、動作、返り値を説明するdocstringが記述されているか？
    -   FastAPIの`tags`機能などを使い、APIドキュメント上での見通しが良くなるように工夫されているか？
- **[ ] 依存関係 (Dependencies):** このエンドポイントは`requests`を使用しているが、`multiLLM_system/requirements.txt`に`requests`が含まれているか？（再確認）

## 出力形式 (Output Format)

レビューが完了したら、`Task 45.1`のレビュープロンプトと同様に、以下の形式で**Pull Requestレビュー概要**を出力してください。

---

### Pull Request レビュー概要

**1. 総合評価 (Overall Assessment):**
（レビュー結果の総括を記述）

**2. 指摘事項と修正提案 (Issues and Suggestions):**
（問題点や改善提案を具体的にリストアップ。コードスニペットも提示すること。）

- **[改善提案/Suggestion] タイムアウト値の定数化:**
  - ヘルスチェック内のタイムアウト`5`がマジックナンバーになっています。`settings.py`に`HEALTHCHECK_TIMEOUT`のような定数を定義し、それを参照することを推奨します。
  - **修正案 (`settings.py`):** `HEALTHCHECK_TIMEOUT: int = 5`
  - **修正案 (`server.py`):** `response = requests.get(..., timeout=settings.HEALTHCHECK_TIMEOUT)`

**3. 最終判定 (Final Verdict):**
（「修正後、PR作成可能」「PR作成可能」「要再設計」のいずれかで判定）

---

細部まで徹底的なレビューを期待しています。よろしくお願いします！ 