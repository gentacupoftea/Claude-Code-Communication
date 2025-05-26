# GitHub Actions 課金問題解決ガイド

## 🚨 現在の状況

GitHub Actions の無料枠（2,000分/月）を超過し、追加の実行ができない状態です。このガイドでは、最小限のコストでプロジェクトを継続する方法を説明します。

## 📊 GitHub Actions 無料枠の詳細

### 無料プラン（個人アカウント）
- **プライベートリポジトリ**: 2,000分/月
- **パブリックリポジトリ**: 無制限
- **ストレージ**: 500MB
- **同時実行ジョブ**: 20個

### 分単位の消費レート
| OS | 消費レート |
|---|---|
| Linux | 1x |
| Windows | 2x |
| macOS | 10x |

## 💰 コスト最適化戦略

### 1. 即効性のある対策

#### a) 不要なワークフローの無効化
```bash
# .github/workflows/ 内の不要なワークフローを無効化
mv .github/workflows/expensive-workflow.yml .github/workflows/expensive-workflow.yml.disabled
```

#### b) ワークフローの実行条件を厳格化
```yaml
on:
  push:
    branches: [main]  # developブランチを除外
    paths-ignore:
      - '**.md'
      - 'docs/**'
      - '.gitignore'
```

#### c) ジョブの並列実行を削減
```yaml
jobs:
  test:
    strategy:
      max-parallel: 1  # 並列実行を1に制限
      matrix:
        node: [18]  # 複数バージョンのテストを削減
```

### 2. キャッシュの活用

```yaml
- uses: actions/cache@v3
  with:
    path: |
      ~/.npm
      ~/.cache
      node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

### 3. 条件付き実行

```yaml
- name: Run expensive tests
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  run: npm run test:e2e
```

## 🆓 無料の代替手段

### 1. ローカル実行
```bash
# ローカルでテストとビルドを実行
./scripts/local-test-runner.sh

# 手動でマージ
./scripts/manual-merge-helper.sh
```

### 2. セルフホステッドランナー
```bash
# Docker Composeで起動
docker-compose -f docker-compose.runner.yml up -d

# または直接インストール
# https://github.com/actions/runner/releases
```

### 3. 無料CI/CDサービス

| サービス | 無料枠 | 特徴 |
|---------|--------|------|
| CircleCI | 6,000分/月 | 高速、Docker対応 |
| GitLab CI | 400分/月 | セルフホスト可能 |
| Travis CI | OSS無制限 | macOS/Windows対応 |
| Azure Pipelines | 1,800分/月 | Microsoft統合 |
| Buildkite | 無料プラン有 | 高度なパイプライン |

## 💳 有料プランの検討

### GitHub Team ($4/ユーザー/月)
- 3,000分/月（+1,000分）
- 高度なセキュリティ機能
- プライベートリポジトリ無制限

### 追加分の購入
- Linux: $0.008/分
- Windows: $0.016/分
- macOS: $0.08/分

#### 月間コスト計算例
```
必要な分数: 5,000分/月
無料枠: 2,000分
追加購入: 3,000分 × $0.008 = $24/月
```

## 🛠️ 推奨アクション

### 短期的対策（今すぐ実行）

1. **ローカルテストの活用**
   ```bash
   # PRごとにローカルで実行
   ./scripts/local-test-runner.sh
   ```

2. **手動マージプロセス**
   ```bash
   # 安全にマージ
   ./scripts/manual-merge-helper.sh
   ```

3. **緊急デプロイ**
   ```bash
   # GitHub Actions を使わずデプロイ
   ./scripts/emergency-deploy.sh production
   ```

### 中期的対策（1週間以内）

1. **セルフホステッドランナーの設定**
   - 余っているPCやサーバーを活用
   - Docker Composeで簡単に起動

2. **CircleCI への移行**
   - 6,000分/月の無料枠
   - 簡単な移行プロセス

3. **ワークフローの最適化**
   - 不要なステップの削除
   - キャッシュの最大活用

### 長期的対策（1ヶ月以内）

1. **GitHub Team プランへの移行**
   - 月$4で+1,000分
   - ROIが高い

2. **ハイブリッドCI/CD**
   - 重要なワークフローのみGitHub Actions
   - その他は代替サービス

3. **インフラの最適化**
   - ビルド時間の短縮
   - テストの並列化

## 📈 使用量のモニタリング

### GitHub Actions 使用量の確認
1. https://github.com/settings/billing
2. "Actions"セクションを確認
3. 月間使用量と残量を把握

### アラートの設定
```yaml
# .github/workflows/usage-alert.yml
name: Usage Alert
on:
  schedule:
    - cron: '0 0 * * 1'  # 毎週月曜日
jobs:
  check-usage:
    runs-on: ubuntu-latest
    steps:
      - name: Check usage
        run: |
          # GitHub API で使用量を確認
          curl -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \
            https://api.github.com/users/${{ github.repository_owner }}/settings/billing/actions
```

## 🔧 トラブルシューティング

### Q: すぐにデプロイが必要な場合は？
A: 緊急デプロイスクリプトを使用
```bash
./scripts/emergency-deploy.sh production --skip-tests
```

### Q: PRのテストはどうすれば？
A: ローカルテストランナーを使用
```bash
./scripts/local-test-runner.sh --github-comment
```

### Q: 複数のPRをマージしたい
A: 手動マージヘルパーの一括モードを使用
```bash
./scripts/manual-merge-helper.sh
# メニューから「5. 一括マージ」を選択
```

## 📚 参考リンク

- [GitHub Actions の課金について](https://docs.github.com/ja/billing/managing-billing-for-github-actions/about-billing-for-github-actions)
- [セルフホステッドランナーの追加](https://docs.github.com/ja/actions/hosting-your-own-runners/adding-self-hosted-runners)
- [CircleCI 移行ガイド](https://circleci.com/docs/2.0/migrating-from-github/)
- [GitLab CI/CD](https://docs.gitlab.com/ee/ci/)

## 💡 ベストプラクティス

1. **プルリクエストの最小化**
   - 小さな変更を頻繁にマージ
   - ビルド時間を短縮

2. **ブランチ戦略の見直し**
   - feature/* ブランチでのCI実行を制限
   - mainブランチのみフルテスト

3. **Docker イメージの最適化**
   - マルチステージビルド
   - レイヤーキャッシュの活用

4. **依存関係の管理**
   - lockファイルの適切な管理
   - 不要な依存関係の削除

---

**重要**: このガイドは定期的に更新してください。GitHub Actions の価格や無料枠は変更される可能性があります。