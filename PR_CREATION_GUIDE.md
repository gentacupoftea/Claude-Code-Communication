# プルリクエスト作成ガイド

以下の手順でGitHub上にプルリクエストを作成します。

## プルリクエスト作成手順

1. GitHubのリポジトリページ（https://github.com/gentacupoftea/shopify-mcp-server）にアクセス

2. 「Pull requests」タブをクリック

3. 「New pull request」ボタンをクリック

4. 「base」ドロップダウンで `develop` を選択

5. 「compare」ドロップダウンで `feature/rename-to-conea` を選択

6. 「Create pull request」ボタンをクリック

7. プルリクエストのタイトルに以下を入力:
   ```
   feat: プロジェクト名を shopify-mcp-server から conea へ変更（フェーズ1）
   ```

8. 説明欄には `PR_RENAME_TO_CONEA.md` の内容をコピー&ペースト

9. 「Reviewers」セクションで適切なレビュアーを割り当て

10. 「Labels」セクションで以下のラベルを追加:
    - `enhancement`
    - `documentation`
    - `v0.3.0`

11. 「Projects」セクションでv0.3.0リリースプロジェクトを選択

12. 「Create pull request」ボタンをクリックして送信

## レビュー後のマージ手順

1. すべてのレビューコメントに対応

2. CI/CDチェックがすべて通過していることを確認

3. マージの前に最新のdevelopブランチを取り込む:
   ```bash
   git checkout feature/rename-to-conea
   git pull origin develop
   git push origin feature/rename-to-conea
   ```

4. 「Squash and merge」オプションを選択してマージ

5. コミットメッセージを以下のように編集:
   ```
   feat: プロジェクト名を shopify-mcp-server から conea へ変更（フェーズ1）

   - ドキュメントとスクリプト内の参照を「shopify-mcp-server」から「conea」に変更
   - マイグレーション計画ドキュメントを作成
   - インテリジェント中間処理機能のプロトタイプを実装
   - デプロイ関連ドキュメントとスクリプトを更新
   ```

6. 「Confirm squash and merge」をクリック

7. マージ完了後、統合テストを開始

## 統合テスト実施

マージ完了後、以下の手順で統合テストを実施します:

1. developブランチの最新コードを取得:
   ```bash
   git checkout develop
   git pull origin develop
   ```

2. 統合テストを実行:
   ```bash
   pytest tests/ --verbose
   ```

3. テスト結果を記録し、問題があれば修正PRを作成

## 次のステップ

統合テスト完了後、以下のステップに進みます:

1. 5月29日にコードフリーズを実施
2. `release/v0.3.0` ブランチを作成
3. ステージング環境でのテストを実施
4. 5月31日に本番リリースを実施

詳細は `RELEASE_BRANCH_CREATION.md` および `INTEGRATION_TEST_PLAN.md` を参照してください。