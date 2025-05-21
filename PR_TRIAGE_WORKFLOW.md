# Conea PRトリアージ実行計画

本ドキュメントは、Coneaプロジェクトのv0.3.1リリースに向けた未処理PRのトリアージプロセスの詳細な実行計画を提供します。3日間にわたる体系的なプロセスを通じて、各PRを評価し、優先順位を付け、実行計画を策定します。

## 実行スケジュール

### 1日目 (5月22日) - 準備および分析フェーズ

| 時間 | アクティビティ | 担当者 | 成果物 |
|------|--------------|---------|--------|
| 09:00-09:30 | キックオフミーティング | 全員 | ー |
| 09:30-10:30 | 環境設定とツール準備 | 技術チーム | 準備完了報告 |
| 10:30-12:00 | PR情報収集と分析実行 | 技術チーム | PR分析データ |
| 13:00-14:30 | レビュー担当者割り当て | プロジェクトリード | レビュー割り当て表 |
| 14:30-17:00 | 初期分析結果の確認 | プロジェクトリード | 初期分析レポート |

### 2日目 (5月23日) - 詳細レビューフェーズ

| 時間 | アクティビティ | 担当者 | 成果物 |
|------|--------------|---------|--------|
| 09:00-09:30 | レビュー計画確認 | 全員 | ー |
| 09:30-12:00 | PR個別レビュー実施 | 割り当てレビュアー | PR個別レビュー |
| 13:00-15:00 | PR個別レビュー実施（続き） | 割り当てレビュアー | PR個別レビュー |
| 15:00-16:00 | レビュー結果の集約 | 技術チーム | 集約レビューレポート |
| 16:00-17:00 | トリアージセッション準備 | プロジェクトリード | トリアージ資料 |

### 3日目 (5月24日) - トリアージ決定フェーズ

| 時間 | アクティビティ | 担当者 | 成果物 |
|------|--------------|---------|--------|
| 09:00-09:45 | トリアージ前準備 | 全員 | ー |
| 10:00-12:00 | トリアージセッション | 全員 | PR分類決定 |
| 13:00-14:30 | 決定事項のドキュメント化 | 技術チーム | 決定記録ファイル |
| 14:30-16:00 | 実行計画の策定 | プロジェクトリード | 実行計画書 |
| 16:00-17:00 | 結果共有と次のステップ | プロジェクトリード | 最終レポート |

## 詳細実行手順

### 1. 環境設定とツール準備

```bash
# 1. 作業ディレクトリの作成
mkdir -p pr-triage/results
mkdir -p pr-triage/reviews
mkdir -p pr-triage/decisions

# 2. 必要なパッケージのインストール
pip install -r scripts/requirements-triage.txt

# 3. 実行権限の付与
chmod +x scripts/pr_inventory.py
chmod +x scripts/pr_dependency_graph.py
chmod +x scripts/pr_stats.py
chmod +x scripts/analyze_rename_impact.py
chmod +x scripts/assign_reviewers.py
chmod +x scripts/analyze_conflicts.py
chmod +x scripts/generate_review_template.py
chmod +x scripts/aggregate_reviews.py
chmod +x scripts/prepare_triage_session.py
chmod +x scripts/generate_decision.py
chmod +x scripts/generate_triage_report.py
```

### 2. PR情報収集と分析

```bash
# 1. GitHubトークンの設定
export GITHUB_TOKEN=your_github_token_here

# 2. PR情報の収集
python scripts/pr_inventory.py \
    --repo mourigenta/conea \
    --output pr-triage/pr_inventory.json

# 3. PR統計情報の作成
python scripts/pr_stats.py \
    --input pr-triage/pr_inventory.json \
    --output pr-triage/pr_statistics.md

# 4. 依存関係グラフの生成
python scripts/pr_dependency_graph.py \
    --input pr-triage/pr_inventory.json \
    --output pr-triage/dependency_graph.png \
    --interactive pr-triage/interactive_graph.html

# 5. 名称変更影響分析
python scripts/analyze_rename_impact.py \
    --input pr-triage/pr_inventory.json \
    --output pr-triage/rename_impact.json \
    --report pr-triage/rename_impact_report.md

# 6. コンフリクト分析
python scripts/analyze_conflicts.py \
    --repo mourigenta/conea \
    --pr-list pr-triage/pr_inventory.json \
    --output pr-triage/conflict_analysis.json \
    --report pr-triage/conflict_report.md
```

### 3. レビュー担当者割り当てと個別レビュー

```bash
# 1. レビュアーの割り当て
python scripts/assign_reviewers.py \
    --input pr-triage/pr_inventory.json \
    --team-list team_members.json \
    --output pr-triage/reviewer_assignments.json

# 2. 各PRに対してレビューテンプレートを生成
for PR_NUMBER in $(jq -r '.assignments[].pr_number' pr-triage/reviewer_assignments.json); do
    python scripts/generate_review_template.py \
        --pr-number $PR_NUMBER \
        --inventory pr-triage/pr_inventory.json \
        --output pr-triage/reviews/pr_${PR_NUMBER}_review.md
done

# 3. レビュー完了後に結果を集約
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

### 5. トリアージ決定の記録

トリアージセッション中の決定に基づいて、各PRの決定を記録します：

```bash
# 決定を記録する例（各PRごとに実行）
python scripts/generate_decision.py \
    --pr-number <PR_NUMBER> \
    --category <A/B/C/D> \
    --reasoning "決定理由をここに記載" \
    --action <approve/request-changes/merge/postpone/close> \
    --assignee "担当者名" \
    --deadline "YYYY-MM-DD" \
    --inventory pr-triage/pr_inventory.json \
    --scores pr-triage/pr_scores.json \
    --rename-impact pr-triage/rename_impact.json \
    --output pr-triage/decisions/pr_<PR_NUMBER>_decision.md
```

### 6. 最終レポート生成

```bash
# トリアージ結果の最終レポートを生成
python scripts/generate_triage_report.py \
    --decisions-dir pr-triage/decisions \
    --inventory pr-triage/pr_inventory.json \
    --output PR_TRIAGE_RESULTS.md
```

### 7. GitHubへのトリアージ結果反映

トリアージの決定に基づいて、GitHubのPR状態を更新します：

```bash
# PR結果の適用（ラベル付け、コメント追加、担当者割り当て）
python scripts/apply_triage_results.py \
    --repo mourigenta/conea \
    --triage-results pr-triage/final_triage_report.json \
    --token $GITHUB_TOKEN \
    --apply-labels \
    --add-comments \
    --assign-reviewers
```

## トリアージセッション運営ガイド

### 参加者の役割

- **セッションファシリテーター**: 進行役、タイムキーピング
- **技術リード**: 技術的観点からの評価、最終決定
- **プロダクトマネージャー**: ビジネス価値の観点からの評価
- **レビュアー**: 各PRの詳細説明と評価結果の提示
- **記録係**: 決定事項の記録

### セッション進行手順

#### イントロダクション (10分)

1. 目的と目標の確認
2. トリアージプロセスの説明
3. 評価基準の確認
4. 成果物の確認

#### PR個別討議 (各PR 5-7分)

1. PRの概要説明（レビュアーから）
2. 技術的評価の共有
3. 名称変更への影響評価
4. 質疑応答
5. カテゴリ提案
6. 決定（技術リードとPM）

#### カテゴリ別まとめと検証 (30分)

1. カテゴリA PRsの確認と調整
2. カテゴリB PRsの確認と調整
3. カテゴリC/D PRsの確認
4. 全体バランスの検証

#### まとめと次のステップ (10分)

1. 決定事項の確認
2. 次のアクションアイテムの確認
3. タイムラインの確認
4. 責任者の確認

## トリアージ評価基準

### カテゴリ分類基準

総合スコアは以下の要素から算出されます：

```
総合スコア = (技術的価値×0.3) + (緊急度×0.2) + (実装複雑度の逆数×0.15) + (依存関係の少なさ×0.15) + (名称変更整合性×0.2)
```

**カテゴリ分類**：
- **カテゴリA（即時処理）**: 総合スコア 8.0-10.0
- **カテゴリB（高優先度）**: 総合スコア 6.0-7.9
- **カテゴリC（中優先度）**: 総合スコア 4.0-5.9
- **カテゴリD（低優先度）**: 総合スコア 0.0-3.9

**特別考慮事項**：
- ブロッカーとなっているPRはカテゴリを1段階引き上げ
- AI機能関連のPRはカテゴリを1段階引き上げ
- 深刻なセキュリティ問題修正は自動的にカテゴリA

## 成果物一覧

### 分析レポート
- PR統計情報 (`pr-triage/pr_statistics.md`)
- 依存関係グラフ (`pr-triage/dependency_graph.png`)
- 名称変更影響分析 (`pr-triage/rename_impact_report.md`)
- コンフリクト分析 (`pr-triage/conflict_report.md`)
- レビュー結果サマリー (`pr-triage/review_summary.md`)

### トリアージ成果物
- トリアージセッション資料 (`pr-triage/triage_session_materials.md`)
- PR決定記録 (`pr-triage/decisions/pr_*.md`)
- 最終トリアージレポート (`PR_TRIAGE_RESULTS.md`)

### 実行計画
- 名称変更統合計画 (`RENAME_INTEGRATION_PLAN.md`)
- PR実行計画 (`PR_EXECUTION_PLAN.md`)

## トリアージ後のフォローアップ

1. **日次進捗確認**
   - デイリースタンドアップでのPRステータス報告
   - ブロッカーの早期発見と解消
   
2. **週次レビュー**
   - カテゴリAとBのPRの進捗確認
   - 必要に応じた優先順位の調整
   
3. **エスカレーションプロセス**
   - PRがブロックされている場合の即時対応
   - 予期せぬ問題への対応

## 成功指標

トリアージプロセスの成功は以下の指標で評価します：

1. **PRバックログ削減率**: 50%以上
2. **カテゴリA/B PR完了率**: 90%以上
3. **レビュー期間短縮**: 平均2日以内
4. **コード品質指標**: テストカバレッジ90%以上

---

このワークフローに従うことで、Coneaプロジェクトの未処理PRを体系的に整理し、v0.3.1リリースに向けた効率的な開発計画を策定します。