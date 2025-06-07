# GitHub Issue作成MCP

**キメラ・プロジェクト Phase 1** 🚀

ターミナルから直接GitHub Issueを作成するためのMaster Control Program（MCP）です。
ブラウザを開く手間を省き、開発フローを高速化します。

## 🎯 機能

- コマンドライン引数でIssue作成
- HTTPSとSSH形式のGitリモートURL自動検出
- ラベル設定対応
- 型安全なPython実装
- 詳細なエラーハンドリング

## 🔧 セットアップ

### 1. 依存関係のインストール

```bash
cd scripts/github_mcp
pip install -r requirements.txt
```

### 2. 環境設定ファイルの作成

```bash
cp .env.example .env
```

### 3. GitHub Personal Access Tokenの設定

1. [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens) にアクセス
2. "Generate new token (classic)" をクリック
3. 必要なスコープを選択:
   - `repo` (プライベートリポジトリにアクセスする場合)
   - `public_repo` (パブリックリポジトリのみの場合)
4. 生成されたトークンを `.env` ファイルの `GITHUB_PAT` に設定

```bash
# .env ファイルの例
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 🚀 使用方法

### 基本的な使用例

```bash
# 基本的なIssue作成
python scripts/github_mcp/create_issue.py --title "バグ修正: ログイン画面でエラーが発生"

# 本文付きでIssue作成
python scripts/github_mcp/create_issue.py \
  --title "新機能: ダークモードの実装" \
  --body "ユーザビリティ向上のためにダークモードを実装する。設定画面でのトグル切り替えも含む。"

# ラベル付きでIssue作成
python scripts/github_mcp/create_issue.py \
  --title "ドキュメント更新: READMEの改善" \
  --body "セットアップ手順を詳細化し、トラブルシューティングセクションを追加する。" \
  --labels "documentation,enhancement"

# 複数ラベルの例
python scripts/github_mcp/create_issue.py \
  --title "緊急: 本番環境でのメモリリーク" \
  --body "本番環境でメモリ使用量が時間と共に増加し続ける問題が発生。" \
  --labels "bug,critical,production"
```

### 実際の実行例と出力

```bash
$ python scripts/github_mcp/create_issue.py --title "テスト: MCP動作確認" --labels "test"
✅ Issue created successfully: https://github.com/gentacupoftea/conea-integration/issues/123
```

## 📋 コマンドライン引数

| 引数 | 必須 | 説明 | 例 |
|------|------|------|-----|
| `--title` | ✅ | Issueのタイトル | `"バグ修正: ログイン認証エラー"` |
| `--body` | ❌ | Issue本文（詳細説明） | `"ログイン時に認証が失敗する問題の修正"` |
| `--labels` | ❌ | ラベル（カンマ区切り） | `"bug,authentication,high-priority"` |

## 🔍 技術仕様

### サポートするGitリモートURL形式

- **HTTPS**: `https://github.com/owner/repo.git`
- **SSH**: `git@github.com:owner/repo.git`

### 使用ライブラリ

- `requests>=2.28.0`: GitHub API通信
- `python-dotenv>=1.0.0`: 環境変数管理

### エラーハンドリング

- 認証エラー (HTTP 401)
- リポジトリ不見当エラー (HTTP 404)
- API通信エラー
- Git設定エラー
- 環境変数未設定エラー

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### 1. 認証エラーが発生する

```
❌ エラーが発生しました: 認証に失敗しました。GITHUB_PATトークンを確認してください。
```

**解決策:**
- `.env` ファイルにGITHUB_PATが正しく設定されているか確認
- トークンのスコープに `repo` が含まれているか確認
- トークンの有効期限が切れていないか確認

#### 2. リポジトリが見つからない

```
❌ エラーが発生しました: リポジトリ owner/repo が見つかりません。
```

**解決策:**
- 正しいGitリポジトリディレクトリで実行しているか確認
- リモート `origin` が設定されているか確認: `git remote -v`
- プライベートリポジトリの場合、適切なアクセス権限があるか確認

#### 3. Gitリポジトリでない場所で実行

```
❌ エラーが発生しました: Gitリポジトリでないか、リモートの'origin'が設定されていません。
```

**解決策:**
- Gitリポジトリ内で実行する
- リモートoriginを設定: `git remote add origin <URL>`

## 🔗 キメラ・プロジェクトについて

このMCPは「キメラ・プロジェクト」の第一段階として開発されました。
キメラ・プロジェクトは開発フローの完全自動化を目指す壮大な計画です。

### Phase 1: GitHub Issue作成MCP ✅
- ターミナルからの直接Issue作成
- 開発開始フローの高速化

### Phase 2以降 (予定)
- Pull Request自動作成
- コードレビュー自動化
- デプロイメント自動化
- 品質保証自動化

## 📄 ライセンス

このプロジェクトのライセンスに準拠します。

## 🤝 貢献

バグ報告や機能要求は、このMCPを使用してIssueを作成してください！

```bash
python scripts/github_mcp/create_issue.py \
  --title "MCP改善提案: 新機能の追加" \
  --body "提案内容の詳細..." \
  --labels "enhancement,mcp"
```