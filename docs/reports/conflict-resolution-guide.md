# コンフリクト解決ガイド

生成日時: 2025-05-26

## 概要

131個のファイルで複数PRが競合しています。このガイドは効率的かつ安全なコンフリクト解決のための手順を提供します。

## 1. コンフリクトファイル分類

### 1.1 高頻度コンフリクト（5PR以上）

| ファイル | PR数 | 解決優先度 | 推奨アプローチ |
|---------|------|------------|---------------|
| README.md | 12 | 高 | セクション単位でマージ |
| package.json | 8 | 最高 | 依存関係の統合確認 |
| .github/workflows/ci.yml | 7 | 高 | ワークフロー統合 |
| requirements.txt | 6 | 高 | バージョン互換性確認 |
| .github/workflows/adaptive-tests.yml | 5 | 中 | 最新版を採用 |
| .github/workflows/ci-improved.yml | 5 | 中 | ci.ymlと統合検討 |

### 1.2 中頻度コンフリクト（3-4PR）

| ファイル | PR数 | 主な変更内容 |
|---------|------|-------------|
| requirements-dev.txt | 4 | 開発依存関係 |
| .env.example | 3 | 環境変数追加 |
| frontend/package.json | 3 | フロントエンド依存 |
| test_imports.py | 3 | インポートテスト |

### 1.3 設定ファイルコンフリクト

| ファイル | 影響 | 解決方法 |
|---------|------|----------|
| docker-compose.yml | Docker構成 | サービス定義の統合 |
| pytest.ini | テスト設定 | オプションの結合 |
| setup.py | パッケージ設定 | バージョン確認 |

## 2. ファイル別解決手順

### 2.1 README.md（12 PRで競合）

**影響PR**: #54, #37, #39, #38, #40, #42, #44, #45, #46, #17, #31, #32

**解決手順**:
```bash
# 1. 各PRのREADME変更を個別に確認
git show PR_NUMBER:README.md > readme_pr_NUMBER.md

# 2. セクション別に統合
- Installation: 最も詳細な手順を採用
- Features: すべての機能を列挙
- Usage: 各使用例を統合
- Testing: すべてのテストコマンドを含める

# 3. 統合版を作成
cat readme_base.md readme_additions.md > README.md
```

**チェックリスト**:
- [ ] インストール手順の重複除去
- [ ] 機能リストの統合
- [ ] バッジ・リンクの更新
- [ ] 例示コードの動作確認

### 2.2 package.json（8 PRで競合）

**影響PR**: #54, #86, #2, #17, #23, #31, #78, #56

**解決手順**:
```bash
# 1. 依存関係の抽出
jq '.dependencies' pr-*/package.json > dependencies_all.json
jq '.devDependencies' pr-*/package.json > devDependencies_all.json

# 2. バージョン競合の確認
npm install --dry-run

# 3. 統合版の作成
- 最新の安定版を採用
- セキュリティアップデートを優先
- breaking changeを回避
```

**注意事項**:
- メジャーバージョンの変更は慎重に
- peer dependenciesの確認
- lockファイルの再生成

### 2.3 GitHub Workflows（複数ファイル）

**主要ファイル**:
- .github/workflows/ci.yml（7 PR）
- .github/workflows/adaptive-tests.yml（5 PR）
- .github/workflows/ci-improved.yml（5 PR）

**統合戦略**:
```yaml
# 1. ワークフローの目的別分類
- ci.yml: 基本的なCI
- test-*.yml: テスト専用
- deploy-*.yml: デプロイ専用

# 2. 重複ジョブの統合
- 同じテストの重複実行を避ける
- マトリックスビルドの活用
- 条件付き実行の設定

# 3. 最適化
- キャッシュの共有
- 並列実行の最大化
- 失敗時の早期終了
```

## 3. 自動解決可能なパターン

### 3.1 追加のみの変更

以下のパターンは自動マージ可能：
- 新規ファイルの追加
- 異なるディレクトリへの追加
- コメント・ドキュメントの追加

**自動解決コマンド**:
```bash
# リベースによる自動解決
git rebase main --strategy-option=theirs

# マージによる自動解決
git merge --strategy-option=ours
```

### 3.2 フォーマット差異

- 行末の空白
- インデント（タブ vs スペース）
- 改行コード（LF vs CRLF）

**解決方法**:
```bash
# フォーマッターの実行
npm run format
prettier --write .
black . # Pythonファイル
```

## 4. 手動解決が必要なパターン

### 4.1 ロジックの競合

**例**: 同じ関数の異なる実装
```javascript
// PR #A
function calculate(x, y) {
  return x + y;
}

// PR #B  
function calculate(x, y) {
  return (x + y) * TAX_RATE;
}
```

**解決指針**:
1. 両方の実装意図を理解
2. 機能テストで挙動確認
3. 必要に応じて両方の機能を統合

### 4.2 設定値の競合

**例**: 環境変数の異なるデフォルト値
```env
# PR #A
API_TIMEOUT=30

# PR #B
API_TIMEOUT=60
```

**解決指針**:
1. 本番環境の要件確認
2. パフォーマンステストで検証
3. 設定の外部化を検討

## 5. コンフリクト解決ツール

### 5.1 提供スクリプト

```bash
# コンフリクト検出と解決支援
./scripts/pr-conflict-resolver.sh

# 特定PRのコンフリクト確認
./scripts/pr-conflict-resolver.sh --check PR_NUMBER

# 自動解決の試行
./scripts/pr-conflict-resolver.sh --auto-resolve PR_NUMBER
```

### 5.2 Git コマンド

```bash
# コンフリクトファイルの一覧
git diff --name-only --diff-filter=U

# 3-wayマージエディタ
git mergetool

# 特定ファイルの履歴確認
git log -p --merge -- path/to/file
```

### 5.3 外部ツール

- **VSCode**: Merge Conflict拡張
- **IntelliJ**: Built-in merge tool
- **Beyond Compare**: 高度な差分比較
- **P4Merge**: 無料の3-wayマージツール

## 6. ベストプラクティス

### 6.1 事前準備

1. **バックアップ作成**
   ```bash
   git branch backup-$(date +%Y%m%d)
   ```

2. **クリーンな作業環境**
   ```bash
   git stash
   git clean -fd
   ```

3. **最新状態の確認**
   ```bash
   git fetch --all
   git pull origin main
   ```

### 6.2 解決プロセス

1. **小さな単位で解決**
   - 1ファイルずつ確実に
   - 各解決後にテスト実行

2. **コミットメッセージ**
   ```
   Merge PR #XX: [簡潔な説明]
   
   Conflicts resolved:
   - path/to/file1: [解決方法]
   - path/to/file2: [解決方法]
   ```

3. **レビュー依頼**
   - 複雑な解決は必ずレビュー
   - 元のPR作者に確認依頼

### 6.3 テスト戦略

```bash
# 1. ユニットテスト
npm test

# 2. 統合テスト  
npm run test:integration

# 3. E2Eテスト
npm run test:e2e

# 4. ビルド確認
npm run build
```

## 7. トラブルシューティング

### 7.1 よくある問題

| 問題 | 原因 | 解決方法 |
|------|------|----------|
| Rebase地獄 | 複雑な履歴 | マージ使用を検討 |
| テスト失敗 | 不完全な解決 | 影響範囲の再確認 |
| ビルドエラー | 依存関係不整合 | clean install実行 |

### 7.2 緊急時の対応

```bash
# 解決を中断
git merge --abort
git rebase --abort

# 元の状態に戻す
git reset --hard origin/main

# 特定のPRを除外
git revert PR_COMMIT_HASH
```

## 8. 予防策

### 将来のコンフリクトを減らすために

1. **コード所有者の設定**
   ```
   # CODEOWNERS
   /src/api/ @api-team
   /frontend/ @frontend-team
   ```

2. **自動フォーマット**
   - pre-commitフック設定
   - CIでのフォーマットチェック

3. **早期マージ戦略**
   - 小さなPRを推奨
   - 定期的なマージサイクル

4. **ブランチ戦略の改善**
   - feature/* ブランチの短命化
   - 定期的なrebase/merge from main