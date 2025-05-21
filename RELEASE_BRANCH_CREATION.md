# v0.3.0 リリースブランチ作成手順

## 目的
本ドキュメントは、5月29日に予定されているコードフリーズと `release/v0.3.0` ブランチの作成手順を説明します。

## 前提条件
- すべてのv0.3.0向け機能PRがdevelopブランチにマージ済みであること
- 統合テストが完了し、主要な問題が解決されていること
- リリースチェックリストの「コード準備」セクションが完了していること

## コードフリーズ実施手順

### 1. 開発チームへの通知

```
件名: 【重要】v0.3.0コードフリーズのお知らせ（5月29日12:00 JST）

Coneaチームの皆様、

本日12:00 JSTよりv0.3.0リリースに向けたコードフリーズを実施します。
以下の点にご協力をお願いします：

1. 12:00以降はdevelopブランチへの新機能マージを停止します
2. バグ修正のみPRを受け付けます（リリースマネージャーの承認が必要）
3. 進行中の作業はv0.3.1向けのブランチとして継続してください

ご協力ありがとうございます。
リリースマネージャー
```

### 2. プルリクエストの確認

```bash
# 未マージのPRを確認
gh pr list --state open

# マージ済みPRのリストを取得
gh pr list --state merged --limit 20
```

### 3. developブランチの最終更新

```bash
# developブランチの更新
git checkout develop
git pull origin develop

# 最終コミットの確認
git log -n 10 --oneline
```

## リリースブランチ作成手順

### 1. リリースブランチの作成

```bash
# リリースブランチの作成
git checkout -b release/v0.3.0 develop

# バージョン確認
grep -r "0.3.0" --include="*.py" --include="setup.py" .
```

### 2. リリースブランチへの最終調整

```bash
# コードフリーズ日時の記録
echo "コードフリーズ実施日時: 2025-05-29 12:00 JST" >> RELEASE-NOTES-v0.3.0.md

# コミット
git add RELEASE-NOTES-v0.3.0.md
git commit -m "Update release notes with code freeze timestamp"

# リリースブランチのプッシュ
git push origin release/v0.3.0
```

### 3. リリースタグの準備

```bash
# 本番リリース前の準備としてタグ付け（リリース日に実行）
git tag -a v0.3.0 -m "Conea v0.3.0 release"

# タグのプッシュ（本番リリース時に実行）
git push origin v0.3.0
```

## GCPステージング環境でのテスト

### 1. ステージング環境へのデプロイ

```bash
# リリースブランチからステージング環境にデプロイ
git checkout release/v0.3.0
./scripts/deploy_production.sh --environment=staging
```

### 2. 検証テストの実行

```bash
# ステージング環境での検証
./scripts/verify_deployment.sh --environment=staging

# エンドツーエンドテスト
./scripts/run_e2e_tests.sh --environment=staging
```

### 3. 結果の記録

テスト結果を `STAGING_TEST_RESULTS.md` に記録：

```markdown
# ステージング環境テスト結果

**テスト実施日**: 2025年5月30日
**ブランチ**: release/v0.3.0
**環境**: GCP Cloud Run Staging

## テスト結果サマリー
- 機能テスト: XX/XX 成功
- パフォーマンステスト: 基準値内
- セキュリティテスト: 問題なし

## 詳細結果
...

## 結論
✅ 本番リリース可能
```

## リリース前確認会議（5月30日）

### アジェンダ

1. ステージング環境テスト結果の確認
2. 未解決の問題とリスクの評価
3. リリース・ロールバック手順の最終確認
4. Go/No-Goの判断

### Go判断基準

- 全必須テストが成功していること
- 未解決の致命的バグがないこと
- リリースチェックリストがすべて完了していること
- ステークホルダーからの最終承認があること

## 本番リリース手順（5月31日）

```bash
# リリースブランチからメインブランチへのマージ
git checkout main
git pull origin main
git merge release/v0.3.0 --no-ff -m "Merge release/v0.3.0"
git push origin main

# リリースタグのプッシュ
git push origin v0.3.0

# 本番環境へのデプロイ
./scripts/deploy_production.sh

# デプロイ検証
./scripts/verify_deployment.sh
```

## 緊急時ロールバック手順

問題が発生した場合は、以下の手順でロールバックを実施します：

```bash
# 本番環境のロールバック
./scripts/rollback_v0.3.0.sh --environment=production

# ロールバック検証
./scripts/verify_deployment.sh
```

## リリース後タスク

1. リリース完了メールの送信
2. ドキュメントサイトの更新
3. リリース後のモニタリング開始
4. v0.3.1の計画開始

---

このドキュメントは2025年5月24日に作成されました。  
リリースマネージャー: Team Lead