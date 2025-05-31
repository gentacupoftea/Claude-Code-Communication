# Phase 3 マージコマンド準備

## 前提条件
- すべてのPRがレビュー済みであること
- CI/CDがすべてグリーンであること
- mainブランチが最新状態であること

## マージ順序と手順

### Step 1: mainブランチの最新化
```bash
git checkout main
git pull origin main
```

### Step 2: Shopify API関連のマージ

#### 2-1. Shopifyレート制限実装
```bash
# ブランチの確認と更新
git checkout feature/shopify-rate-limiting
git pull origin feature/shopify-rate-limiting
git rebase main

# コンフリクトがある場合は解決
# git add <解決したファイル>
# git rebase --continue

# mainにマージ
git checkout main
git merge --no-ff feature/shopify-rate-limiting -m "Merge feature/shopify-rate-limiting: Shopify APIレート制限実装"
git push origin main
```

#### 2-2. Shopify同期テスト
```bash
git checkout feature/shopify-sync-tests
git pull origin feature/shopify-sync-tests
git rebase main

git checkout main
git merge --no-ff feature/shopify-sync-tests -m "Merge feature/shopify-sync-tests: Shopify同期テスト実装"
git push origin main
```

### Step 3: 楽天API関連のマージ

#### 3-1. 楽天API完全統合
```bash
git checkout feature/rakuten-api-complete-integration
git pull origin feature/rakuten-api-complete-integration
git rebase main

git checkout main
git merge --no-ff feature/rakuten-api-complete-integration -m "Merge feature/rakuten-api-complete-integration: 楽天API完全統合"
git push origin main
```

#### 3-2. 楽天レート制限実装
```bash
git checkout feature/rakuten-rate-limiting
git pull origin feature/rakuten-rate-limiting
git rebase main

git checkout main
git merge --no-ff feature/rakuten-rate-limiting -m "Merge feature/rakuten-rate-limiting: 楽天APIレート制限実装"
git push origin main
```

### Step 4: Amazon API関連のマージ

#### 4-1. Amazon API基本統合
```bash
git checkout feature/amazon-api-integration
git pull origin feature/amazon-api-integration
git rebase main

git checkout main
git merge --no-ff feature/amazon-api-integration -m "Merge feature/amazon-api-integration: Amazon API基本統合"
git push origin main
```

#### 4-2. Amazon SP-API統合
```bash
git checkout feature/amazon-sp-api-integration
git pull origin feature/amazon-sp-api-integration
git rebase main

git checkout main
git merge --no-ff feature/amazon-sp-api-integration -m "Merge feature/amazon-sp-api-integration: Amazon SP-API統合"
git push origin main
```

#### 4-3. NextEngine連携統合
```bash
git checkout feature/amazon-nextengine-integration
git pull origin feature/amazon-nextengine-integration
git rebase main

git checkout main
git merge --no-ff feature/amazon-nextengine-integration -m "Merge feature/amazon-nextengine-integration: NextEngine連携統合"
git push origin main
```

## コンフリクト解決手順

### 一般的なコンフリクトパターン

1. **依存関係の競合**
   ```bash
   # package.jsonやrequirements.txtでの競合
   # 両方の変更を保持し、バージョンを確認
   ```

2. **API設定ファイルの競合**
   ```bash
   # config/api_settings.pyなどでの競合
   # すべてのAPI設定を統合
   ```

3. **テストファイルの競合**
   ```bash
   # 新しいテストケースを両方とも保持
   ```

### コンフリクト解決の基本手順
```bash
# 1. コンフリクトファイルを確認
git status

# 2. ファイルを編集してコンフリクトを解決
# <<<<<<<, =======, >>>>>>> マーカーを削除し、適切な内容に修正

# 3. 解決したファイルをステージング
git add <解決したファイル>

# 4. リベースを継続
git rebase --continue

# 5. 問題が複雑な場合はリベースを中止
git rebase --abort
```

## マージ後の確認事項

### 1. 統合テストの実行
```bash
# すべてのAPIテストを実行
pytest tests/api/ -v

# 統合テストを実行
pytest tests/integration/ -v
```

### 2. ドキュメントの確認
```bash
# APIドキュメントが正しく生成されるか確認
python generate_docs.py
```

### 3. デプロイ準備
```bash
# タグを作成
git tag -a v3.0.0 -m "Phase 3: API統合完了"
git push origin v3.0.0
```

## トラブルシューティング

### マージコンフリクトが解決できない場合
1. 一旦マージを中止: `git merge --abort`
2. 個別にPRを確認し、手動でマージ
3. 必要に応じて開発者と相談

### テストが失敗する場合
1. 依存関係を再インストール: `pip install -r requirements.txt`
2. 環境変数を確認
3. データベースマイグレーションを実行

### CI/CDが失敗する場合
1. GitHub Actionsのログを確認
2. 環境変数やシークレットの設定を確認
3. ワークフローファイルの構文を確認