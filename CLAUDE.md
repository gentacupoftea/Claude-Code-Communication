# ケルベロスv2: AIエージェント通信プロトコル

## エージェント構成 (haconiwa-kerberos-v2.yml準拠)

-   **`president`**: 最高意思決定機関。高レベルの指令を分解し、タスクをPMに委任する。
    -   **役割定義**: `instructions/president/CLAUDE.md`
-   **`pm_athena`**: 統合PM。バックエンドと品質保証を担当。討論を主宰し、最終的な計画を策定する。
    -   **役割定義**: `instructions/pm_athena/CLAUDE.md`
-   **`pm_apollo`**: 革新PM。Multi-LLMとデプロイメントを担当。野心的な計画を提案する。
    -   **役割定義**: `instructions/pm_apollo/CLAUDE.md`
-   **`pm_hephaestus`**: 安定化PM。フロントエンドと開発環境を担当。堅牢な計画を提案する。
    -   **役割定義**: `instructions/pm_hephaestus/CLAUDE.md`
-   **`worker`**: 実装担当。PMからの指示に基づき、開発憲法を遵守してコーディングとテストを行う。
    -   **役割定義**: `instructions/worker/CLAUDE.md`

## 通信プロトコル

エージェント間の通信は、`haconiwa`環境内の`tmux`セッションを通じて行われます。
各エージェントは、自身の`CLAUDE.md`に定義された通信プロトコル（接頭辞、報告形式など）を厳格に遵守する必要があります。

## 基本的なワークフロー

1.  **指令**: 開発主任 → `president`
2.  **分解・委任**: `president` → `pm_athena`
3.  **討論・計画**: `pm_athena` ⇔ `pm_apollo` & `pm_hephaestus`
4.  **タスク割り当て**: `pm_athena` → `worker` (担当PM経由)
5.  **実装・レビュー**: `worker` ↔ 担当PM (`pm_apollo` or `pm_hephaestus`)
6.  **最終承認**: 担当PM → `pm_athena`
7.  **完了報告**: `pm_athena` → `president`