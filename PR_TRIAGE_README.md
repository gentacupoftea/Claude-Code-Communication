# Conea PR トリアージツール

Coneaプロジェクトの未処理PRを効率的にトリアージするためのツールセットです。本ツールは、v0.3.1リリースに向けた効果的なPR管理と、名称変更フェーズ2との整合性確保を支援します。

## 概要

このツールセットは、以下の主要機能を提供します：

1. **PR情報収集と分析**: GitHub APIを使用してPR情報を収集し、多角的に分析します。
2. **レビュー支援**: PRレビュープロセスの標準化と効率化を支援します。
3. **名称変更影響評価**: 各PRが名称変更フェーズ2に与える影響を評価します。
4. **コンフリクト分析**: PR間のコンフリクト可能性を特定し、マージ戦略を策定します。
5. **トリアージ決定管理**: PRの分類と優先順位付けを体系的に記録します。

## セットアップ

### 前提条件

- Python 3.8以上
- GitHub個人アクセストークン（APIアクセス用）
- pip（Pythonパッケージマネージャ）

### インストール

```bash
# 1. 必要なPythonパッケージをインストール
pip install -r scripts/requirements-triage.txt

# 2. GitHubトークンの設定
export GITHUB_TOKEN=your_github_token_here

# 3. 作業ディレクトリの作成
mkdir -p pr-triage/results
mkdir -p pr-triage/reviews
mkdir -p pr-triage/decisions
```

## 使用方法

### 1. PR情報収集

```bash
# PRインベントリの作成
python scripts/pr_inventory.py \
    --repo mourigenta/conea \
    --output pr-triage/pr_inventory.json
```

### 2. PR分析

```bash
# PR統計情報の生成
python scripts/pr_stats.py \
    --input pr-triage/pr_inventory.json \
    --output pr-triage/pr_statistics.md

# 依存関係分析
python scripts/pr_dependency_graph.py \
    --input pr-triage/pr_inventory.json \
    --output pr-triage/dependency_graph.png

# 名称変更影響分析
python scripts/analyze_rename_impact.py \
    --input pr-triage/pr_inventory.json \
    --output pr-triage/rename_impact.json \
    --report pr-triage/rename_impact_report.md

# コンフリクト分析
python scripts/analyze_conflicts.py \
    --repo mourigenta/conea \
    --pr-list pr-triage/pr_inventory.json \
    --output pr-triage/conflict_analysis.json \
    --report pr-triage/conflict_report.md
```

### 3. レビュー支援

```bash
# レビュワーの割り当て
python scripts/assign_reviewers.py \
    --input pr-triage/pr_inventory.json \
    --team-list team_members.json \
    --output pr-triage/reviewer_assignments.json

# レビューテンプレートの生成
python scripts/generate_review_template.py \
    --pr-number <PR_NUMBER> \
    --inventory pr-triage/pr_inventory.json \
    --output pr-triage/reviews/pr_<PR_NUMBER>_review.md

# レビュー結果の集約
python scripts/aggregate_reviews.py \
    --reviews-dir pr-triage/reviews \
    --output pr-triage/aggregated_reviews.json \
    --summary pr-triage/review_summary.md
```

### 4. トリアージセッション準備

```bash
# トリアージミーティング資料の準備
python scripts/prepare_triage_session.py \
    --reviews pr-triage/aggregated_reviews.json \
    --conflicts pr-triage/conflict_analysis.json \
    --rename-impact pr-triage/rename_impact.json \
    --output pr-triage/triage_session_materials.md
```

### 5. トリアージ決定記録

```bash
# トリアージ決定の記録
python scripts/generate_decision.py \
    --pr-number <PR_NUMBER> \
    --category <A/B/C/D> \
    --reasoning "決定理由をここに記載" \
    --action <approve/request-changes/merge/postpone/close> \
    --assignee "担当者名" \
    --deadline "YYYY-MM-DD" \
    --inventory pr-triage/pr_inventory.json \
    --output pr-triage/decisions/pr_<PR_NUMBER>_decision.md

# 最終トリアージレポートの生成
python scripts/generate_triage_report.py \
    --decisions-dir pr-triage/decisions \
    --inventory pr-triage/pr_inventory.json \
    --output PR_TRIAGE_REPORT.md
```

## ツール詳細

| スクリプト | 説明 | 主要引数 |
|----------|------|---------|
| `pr_inventory.py` | PRの基本情報を収集 | `--repo`, `--output`, `--token` |
| `pr_stats.py` | PR統計情報を生成 | `--input`, `--output` |
| `pr_dependency_graph.py` | PR間の依存関係を可視化 | `--input`, `--output`, `--format` |
| `analyze_rename_impact.py` | 名称変更への影響を分析 | `--input`, `--output`, `--report` |
| `analyze_conflicts.py` | PR間のコンフリクトを分析 | `--repo`, `--pr-list`, `--output`, `--report` |
| `assign_reviewers.py` | 専門性に基づきレビュワーを割り当て | `--input`, `--team-list`, `--output` |
| `generate_review_template.py` | PRレビューテンプレートを生成 | `--pr-number`, `--output`, `--inventory` |
| `aggregate_reviews.py` | 複数レビューを集約 | `--reviews-dir`, `--output`, `--summary` |
| `prepare_triage_session.py` | トリアージセッション資料を準備 | `--reviews`, `--conflicts`, `--rename-impact`, `--output` |
| `generate_decision.py` | PR決定を記録 | `--pr-number`, `--category`, `--reasoning`, `--action`, `--assignee`, `--deadline`, `--output` |
| `generate_triage_report.py` | 最終トリアージレポートを生成 | `--decisions-dir`, `--inventory`, `--output` |

## カテゴリ分類基準

PRは以下の基準に基づいて分類されます：

### 評価基準

1. **技術的価値** (30%): コア機能への貢献度
2. **緊急度** (20%): リリースブロッカーか否か
3. **複雑度** (15%): 変更の規模と影響範囲
4. **依存関係** (15%): 他PRとの依存・被依存関係
5. **名称変更への影響** (20%): フェーズ2との整合性

### カテゴリ定義

- **カテゴリA (即時処理)**: 
  - v0.3.1リリースに必須
  - スコア: 8.0-10.0

- **カテゴリB (高優先度)**: 
  - v0.3.1リリースに望ましい
  - スコア: 6.0-7.9

- **カテゴリC (中優先度)**: 
  - v0.3.2候補
  - スコア: 4.0-5.9

- **カテゴリD (低優先度)**: 
  - 将来検討またはクローズ
  - スコア: 0.0-3.9

## トリアージプロセス詳細

詳細なトリアージプロセスと実行計画については、以下のドキュメントを参照してください：

- [PR トリアージ実行計画](PR_TRIAGE_WORKFLOW.md): 3日間のトリアージ実施計画
- [PR トリアージ実施ガイド](CONEA_PR_TRIAGE_GUIDE.md): 包括的なトリアージ実施ガイド

## 貢献者

Coneaチーム

## ライセンス

MIT

## 注意事項

- このツールセットはConeaプロジェクト専用に設計されています
- GitHubトークンは適切に保護してください
- トリアージ結果は必ず技術リードの承認を得てください