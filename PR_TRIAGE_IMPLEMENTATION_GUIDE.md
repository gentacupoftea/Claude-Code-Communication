# Conea プロジェクト：PR レビュー＆トリアージ実施ガイド

## 1. 準備フェーズ（5月22日午前）

### 環境設定

1. **リポジトリ準備**
   ```bash
   # リポジトリを最新状態に更新
   git fetch --all
   git checkout develop
   git pull origin develop
   
   # 必要なPython依存関係をインストール
   pip install PyGithub matplotlib networkx
   ```

2. **GitHubトークン設定**
   ```bash
   # GitHubのパーソナルアクセストークンを環境変数に設定
   export GITHUB_TOKEN=your_github_token_here
   ```

3. **ディレクトリ作成**
   ```bash
   # トリアージ関連ファイル用のディレクトリを作成
   mkdir -p triage/pr_reviews
   mkdir -p triage/decisions
   ```

### PR情報収集

1. **PR一覧の作成**
   ```bash
   # PR情報を収集し、JSONファイルに保存
   python scripts/pr_inventory.py --repo mourigenta/conea --output triage/pr_inventory.json
   ```

2. **依存関係グラフの作成**
   ```bash
   # PRの依存関係グラフを生成
   python scripts/pr_dependency_graph.py --input triage/pr_inventory.json --output triage/pr_dependencies.png
   ```

3. **プルリクエストのローカルチェックアウト**
   ```bash
   # トリアージ用の一時ブランチを作成
   git checkout -b triage-temp-branch
   
   # 各PRをローカルでチェックアウトするスクリプトを実行（PR番号は適宜調整）
   for pr in 7 9 13 17 20 22 23 24 25 26; do
     git fetch origin pull/$pr/head:pr-$pr
   done
   ```

## 2. レビューフェーズ（5月22日午後〜5月23日）

### レビュワー割り当て

1. **レビュワーの割り当て表を作成**

   | PR # | 第一レビュワー | 第二レビュワー | レビュー期限 |
   |------|--------------|--------------|------------|
   | #7   | [名前]        | [名前]        | 5/23 12:00 |
   | #9   | [名前]        | [名前]        | 5/23 12:00 |
   | ...  | ...          | ...          | ...        |

2. **レビューテンプレートのコピー**
   ```bash
   # 各PRに対してレビューテンプレートをコピー
   for pr in 7 9 13 17 20 22 23 24 25 26; do
     cp scripts/templates/pr_review_template.md triage/pr_reviews/pr-${pr}-review.md
     # テンプレート内のプレースホルダを置換
     sed -i '' "s/\[PR_NUMBER\]/$pr/g" triage/pr_reviews/pr-${pr}-review.md
   done
   ```

### レビュー実施手順

1. **個別レビュー手順**
   - 各PRに対して以下の手順を実施します：
     1. PRをチェックアウト: `git checkout pr-[PR番号]`
     2. コード変更を確認: `git diff develop...HEAD`
     3. テストを実行: `pytest`
     4. レビューテンプレートに記入
     5. 名称変更に対する影響を特に評価

2. **レビュー結果の集約**
   ```bash
   # 全レビュー結果を一つのマークダウンファイルにまとめる
   cat triage/pr_reviews/*.md > triage/combined_reviews.md
   ```

3. **各PRの評価基準適用**
   - 各PRに対して0-10点で以下を評価：
     - 技術的価値：コア機能への貢献度
     - 緊急度：リリースブロッカーか否か
     - 複雑度：変更の規模と影響範囲
     - 依存関係：他PRへの依存または被依存度
     - 名称変更への影響：フェーズ2との整合性

## 3. 依存関係分析（5月23日）

### 依存関係の整理

1. **依存関係マトリックスの作成**
   ```bash
   # 依存関係マトリックスを作成するスクリプト
   python scripts/analyze_pr_dependencies.py --input triage/pr_inventory.json --output triage/dependency_matrix.csv
   ```

2. **クリティカルパスの特定**
   - 依存関係グラフ（`triage/pr_dependencies.png`）からクリティカルパスを特定
   - クリティカルパス上のPRをリストアップ

3. **コンフリクト分析**
   ```bash
   # 各PRのコンフリクト状況を確認
   for pr in 7 9 13 17 20 22 23 24 25 26; do
     git checkout pr-$pr
     git merge develop --no-commit --no-ff
     git merge --abort
   done
   ```

### マージ戦略の立案

1. **マージ順序の決定**
   - 依存関係を考慮した最適なマージ順序を決定
   - 依存の少ないPRから順にマージする計画を立案

2. **コンフリクト解決戦略**
   - 特定されたコンフリクトごとに解決方針を文書化

## 4. トリアージセッション準備（5月23日夕方）

### セッション資料準備

1. **プレゼンテーション資料作成**
   - 各PRの概要スライド（1PR = 1スライド）
   - 依存関係グラフの解説
   - 名称変更影響度マップ

2. **意思決定マトリックスの作成**
   - 縦軸：技術的価値（低→高）
   - 横軸：緊急度（低→高）
   - マトリックス内に各PRをプロット

3. **トリアージ決定記録テンプレートの用意**
   ```bash
   # 各PRに対して決定記録テンプレートをコピー
   for pr in 7 9 13 17 20 22 23 24 25 26; do
     cp scripts/templates/pr_triage_decision.md triage/decisions/pr-${pr}-decision.md
     sed -i '' "s/\[PR_NUMBER\]/$pr/g" triage/decisions/pr-${pr}-decision.md
   done
   ```

## 5. トリアージセッション実施（5月24日 10:00-12:00）

### セッション進行

1. **開始前準備（9:45-10:00）**
   - 参加者全員が以下を確認：
     - `triage/pr_inventory.json` を読んでおく
     - `triage/pr_dependencies.png` を確認しておく
     - 担当したPRのレビューを完了させておく

2. **進行計画（合計2時間）**
   - 10:00-10:10: イントロダクションとセッション目標の確認
   - 10:10-11:20: PR別のレビューと議論（各PR 5-7分）
   - 11:20-11:50: カテゴリ分類と最終決定
   - 11:50-12:00: まとめと次のステップの確認

### トリアージ実施手順

1. **各PRの評価と分類**
   - レビュー結果の発表（レビュワーから）
   - 質疑応答（参加者全員）
   - 分類の提案と投票
   - 最終決定の記録

2. **カテゴリ分類基準**
   - **A（即時処理）**: v0.3.1に必須、または他の重要PRのブロッカー
   - **B（高優先度）**: v0.3.1に望ましい、価値が高く依存度が低い
   - **C（中優先度）**: v0.3.2の候補、重要だが緊急性に欠ける
   - **D（低優先度）**: 将来検討、またはクローズ候補

3. **決定事項の記録**
   - 各PRに対する決定を `triage/decisions/pr-${pr}-decision.md` に記録
   - 担当者と期限を明確に設定

## 6. フォローアップ（5月24日午後）

### 結果のドキュメント化

1. **最終レポート作成**
   ```bash
   # トリアージ結果を最終レポートとしてまとめる
   python scripts/generate_triage_report.py --decisions triage/decisions/ --output PR_TRIAGE_RESULTS.md
   ```

2. **GitHub更新**
   - 各PRにラベルを追加（A/B/C/D分類に対応）
   - PRコメントに決定事項を投稿
   - 担当者をアサイン

3. **PR処理計画の作成**
   - マージ順序の最終化
   - 担当者と期限のスケジュール作成
   - GitHub Projectsボードに反映

### チーム通知

1. **トリアージ結果の共有**
   - Slackでのトリアージ結果アナウンス
   - チームミーティングでの説明

2. **フェーズ2計画との統合**
   - 「conea-phase2-implementation-plan.md」に反映
   - リソース配分と優先順位の更新

## 7. レビュー・トリアージのベストプラクティス

### 効果的なレビュー

1. **焦点を絞ったレビュー**
   - コードの正確性、パフォーマンス、セキュリティに集中
   - 名称変更への影響を特に注意して評価
   - スタイルの問題は自動化ツールで解決できるなら後回し

2. **建設的なフィードバック**
   - 問題だけでなく、解決策も提案
   - ポジティブな点も指摘（良いコード、効率的な実装など）

### 効率的なトリアージ

1. **データ駆動の意思決定**
   - 感情ではなく事実に基づいて判断
   - 定量的な指標を活用（複雑度、テストカバレッジなど）

2. **戦略的視点の維持**
   - 個々のPRだけでなく、プロジェクト全体への影響を考慮
   - 短期的な利益と長期的な技術的負債のバランスを取る

## 8. 成功指標

1. **定量的指標**
   - PRバックログ削減率: 50%以上
   - A・Bカテゴリの処理完了率: 90%以上
   - レビュー期間短縮: 平均2日以内

2. **定性的指標**
   - チーム全体のプロセスへの満足度
   - コードベースの品質向上
   - フェーズ2実装の円滑な進行

この実装ガイドに従うことで、効率的かつ効果的なPRレビューとトリアージを実現し、Coneaプロジェクトのフェーズ2へのスムーズな移行を支援します。