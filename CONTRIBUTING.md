# 🤝 Contributing to Conea MultiLLM Integration Platform

**Sprint 2 AI-5号機の成果物 - 包括的開発貢献ガイド**

Conea MultiLLM Integration Platformへのコントリビューションを歓迎します！このガイドでは、プロジェクトへの効果的な貢献方法、Git Flow ベースの開発フロー、コーディング規約について詳しく説明します。

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Contributors](https://img.shields.io/github/contributors/your-org/conea-integration.svg)](https://github.com/your-org/conea-integration/graphs/contributors)
[![Good First Issues](https://img.shields.io/github/issues/your-org/conea-integration/good%20first%20issue.svg)](https://github.com/your-org/conea-integration/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)

## 🤝 貢献の方法

### 1. イシューの報告

バグ報告や機能要望は、以下の手順で行ってください：

1. **既存のイシューを確認** - 同様の問題が既に報告されていないかチェック
2. **適切なテンプレートを使用** - Bug Report または Feature Request テンプレートを選択
3. **詳細な情報を提供** - 再現手順、期待する動作、実際の動作を明記
4. **環境情報を含める** - OS、ブラウザ、Node.js/Pythonバージョン等

### 2. プルリクエストの作成

コードの貢献は以下の手順で行ってください：

1. **イシューの確認** - 関連するイシューが存在することを確認
2. **ブランチの作成** - 適切な命名規則に従って機能ブランチを作成
3. **実装** - コーディング規約に従って実装
4. **テスト** - 必要なテストを追加・実行
5. **プルリクエスト** - 詳細な説明とともにPRを作成

## 🌲 ブランチ戦略

### メインブランチ

- **`main`**: 本番環境向け安定版
  - 直接コミット禁止
  - リリース可能な状態を常に維持
  - セマンティックバージョニングでタグ付け

- **`develop`**: 開発統合ブランチ
  - 新機能の統合とテスト
  - CI/CDパイプラインで品質を確保
  - 定期的にmainブランチにマージ

### 機能ブランチ

機能ブランチは以下の命名規則に従ってください：

```
feature/[category]/[description]
hotfix/[description]
```

**例:**
```bash
feature/frontend/chat-interface       # フロントエンド機能
feature/backend/analytics-api        # バックエンド機能
feature/llm/claude-integration       # LLM統合
feature/infrastructure/monitoring    # インフラ改善
hotfix/security-vulnerability        # セキュリティ修正
hotfix/memory-leak                    # 緊急バグ修正
```

### ブランチライフサイクル

```bash
# 1. 最新のdevelopブランチを取得
git checkout develop
git pull origin develop

# 2. 新しい機能ブランチを作成
git checkout -b feature/frontend/new-feature

# 3. 実装・コミット
git add .
git commit -m "feat(frontend): add new feature"

# 4. リモートにプッシュ
git push origin feature/frontend/new-feature

# 5. プルリクエスト作成
gh pr create --base develop --title "feat(frontend): add new feature"

# 6. マージ後のクリーンアップ
git checkout develop
git pull origin develop
git branch -d feature/frontend/new-feature
git push origin --delete feature/frontend/new-feature
```

## 📝 コミットメッセージ規約

[Conventional Commits](https://www.conventionalcommits.org/) 仕様に準拠してください。

### 基本形式

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Type（必須）

| Type | 説明 | 例 |
|------|------|-----|
| `feat` | 新機能 | `feat(chat): add streaming support` |
| `fix` | バグ修正 | `fix(api): resolve memory leak` |
| `docs` | ドキュメント | `docs(readme): update installation guide` |
| `style` | フォーマット | `style(frontend): fix eslint warnings` |
| `refactor` | リファクタリング | `refactor(auth): simplify token validation` |
| `test` | テスト | `test(backend): add integration tests` |
| `chore` | その他 | `chore(deps): update dependencies` |
| `perf` | パフォーマンス | `perf(llm): optimize response caching` |
| `ci` | CI/CD | `ci(github): add automated testing` |

### Scope（推奨）

| Scope | 説明 |
|-------|------|
| `frontend` | Next.js フロントエンド |
| `backend` | Node.js バックエンド |
| `llm` | MultiLLMシステム |
| `api` | REST API |
| `auth` | 認証・認可 |
| `db` | データベース |
| `infra` | インフラ・DevOps |
| `docs` | ドキュメント |

### 例

```bash
feat(frontend): add real-time chat interface
fix(llm): resolve Claude API timeout issue
docs(api): add comprehensive endpoint documentation
refactor(backend): extract reusable utility functions
test(integration): add E2E test for auth flow
chore(deps): update FastAPI to v0.104.1
```

## 🧪 テスト戦略

### テスト要件

すべての新機能とバグ修正には適切なテストが必要です：

1. **単体テスト**: 新しい関数・クラスには単体テストを追加
2. **統合テスト**: API エンドポイントには統合テストを追加
3. **E2Eテスト**: UI機能には E2E テストを追加（必要に応じて）

### テスト実行

```bash
# フロントエンド
cd frontend-v2
npm test                    # Jest 単体テスト
npm run test:coverage       # カバレッジレポート
npm run test:e2e           # Cypress E2Eテスト

# バックエンド
cd backend
npm test                   # Jest 単体・統合テスト

# MultiLLMシステム
cd multiLLM_system
python -m pytest          # Python 単体テスト
python -m pytest tests/integration/  # 統合テスト

# 全システム
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### カバレッジ要件

- **最小カバレッジ**: 80%
- **新規コード**: 90% 以上
- **重要な機能**: 95% 以上

## 💻 開発環境のセットアップ

### 前提条件

- Node.js 18+ 
- Python 3.9+
- Docker & Docker Compose
- Git

### セットアップ手順

```bash
# 1. リポジトリをクローン
git clone https://github.com/your-org/conea-integration.git
cd conea-integration

# 2. 環境変数を設定
cp .env.example .env
# .envファイルを編集してAPIキーを設定

# 3. 依存関係をインストール
npm install                          # ルートレベル
cd frontend-v2 && npm install        # フロントエンド
cd ../backend && npm install         # バックエンド
cd ../multiLLM_system && pip install -r requirements.txt  # Python

# 4. 開発サーバーを起動
docker-compose up -d                 # インフラサービス（DB、Redis等）
npm run dev:all                      # 全サービス並行起動
```

### IDE設定

推奨される IDE 設定：

#### VS Code

```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "python.defaultInterpreterPath": "./multiLLM_system/.venv/bin/python"
}
```

#### 推奨拡張機能

- ESLint
- Prettier
- Python
- TypeScript
- Docker
- GitLens

## 📋 コードレビュープロセス

### プルリクエスト要件

すべてのPRは以下の要件を満たす必要があります：

1. **✅ CI通過**: 全てのテストとリントがパス
2. **📝 説明**: 変更内容の明確な説明
3. **🧪 テスト**: 適切なテストの追加
4. **📚 ドキュメント**: 必要に応じてドキュメント更新
5. **👥 レビュー**: 最低1名の承認が必要

### PRテンプレート

```markdown
## 概要
この PR の概要を簡潔に説明してください。

## 変更内容
- [ ] 新機能の追加
- [ ] バグ修正
- [ ] リファクタリング
- [ ] ドキュメント更新
- [ ] テスト追加

## 関連イシュー
Closes #[issue_number]

## テスト
- [ ] 単体テストを追加/更新
- [ ] 統合テストを追加/更新
- [ ] 手動テストを実行
- [ ] 全テストがパス

## チェックリスト
- [ ] コードが規約に準拠している
- [ ] 適切なコミットメッセージ
- [ ] ドキュメントを更新（必要に応じて）
- [ ] CHANGELOG.md を更新（必要に応じて）
```

### レビュー観点

レビュアーは以下の観点でチェックしてください：

1. **機能性**: 期待通りに動作するか
2. **コード品質**: 可読性、保守性、パフォーマンス
3. **セキュリティ**: 脆弱性や機密情報の漏洩がないか
4. **テスト**: 適切なテストカバレッジ
5. **ドキュメント**: 必要な更新が含まれているか

## 🎨 コーディング規約

### TypeScript/JavaScript

```javascript
// ✅ 良い例
interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
}

const getUserPreferences = async (userId: string): Promise<UserPreferences> => {
  const response = await apiClient.get(`/users/${userId}/preferences`);
  return response.data;
};

// ❌ 悪い例
const getPrefs = (id) => {
  return fetch('/api/users/' + id + '/prefs').then(r => r.json());
};
```

### Python

```python
# ✅ 良い例
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class LLMResponse:
    """LLMからのレスポンスデータ"""
    content: str
    model: str
    tokens_used: int
    response_time: float
    metadata: Optional[Dict[str, Any]] = None

async def process_llm_request(
    message: str, 
    worker_type: str = "claude"
) -> LLMResponse:
    """LLMリクエストを処理し、レスポンスを返す"""
    # 実装...
    pass

# ❌ 悪い例
def process_request(msg, type="claude"):
    # 実装...
    pass
```

### ファイル構成

```
src/
├── components/          # 再利用可能コンポーネント
│   ├── common/         # 共通コンポーネント
│   ├── chat/           # チャット機能
│   └── index.ts        # エクスポート
├── hooks/              # カスタムフック
├── lib/                # ユーティリティ
├── types/              # 型定義
└── utils/              # ヘルパー関数
```

## 🔒 セキュリティガイドライン

### 機密情報の取り扱い

1. **環境変数の使用**: APIキーやパスワードは環境変数で管理
2. **コミット前チェック**: 機密情報がコミットされていないか確認
3. **.gitignore の活用**: 設定ファイルや認証情報を除外

### セキュアコーディング

```typescript
// ✅ 安全な実装
const sanitizedInput = DOMPurify.sanitize(userInput);
const query = 'SELECT * FROM users WHERE id = ?';
const result = await db.query(query, [userId]);

// ❌ 危険な実装
const query = `SELECT * FROM users WHERE id = ${userId}`;  // SQLインジェクション
innerHTML = userInput;  // XSS脆弱性
```

## 📊 パフォーマンスガイドライン

### フロントエンド

1. **レンダリング最適化**: React.memo、useMemo、useCallback の適切な使用
2. **バンドルサイズ**: 不要なライブラリの削除、Tree Shaking の活用
3. **画像最適化**: WebP形式、遅延読み込み
4. **キャッシング**: Service Worker、HTTP キャッシュの活用

### バックエンド

1. **データベース最適化**: インデックス、クエリ最適化
2. **キャッシング**: Redis を活用した戦略的キャッシング
3. **非同期処理**: I/O集約的処理の非同期化
4. **メモリ管理**: メモリリークの防止

## 🚀 リリースプロセス

### バージョニング

[Semantic Versioning](https://semver.org/) に準拠：

- **MAJOR**: 破壊的変更
- **MINOR**: 後方互換性のある機能追加
- **PATCH**: 後方互換性のあるバグ修正

### リリース手順

```bash
# 1. developブランチを最新化
git checkout develop
git pull origin develop

# 2. リリースブランチ作成
git checkout -b release/v1.2.0

# 3. バージョン更新
npm version minor  # package.json更新

# 4. CHANGELOG更新
# CHANGELOG.md に新機能・修正内容を記載

# 5. リリースPR作成
gh pr create --base main --title "release: v1.2.0"

# 6. マージ後、タグ作成
git checkout main
git pull origin main
git tag v1.2.0
git push origin v1.2.0

# 7. developブランチへのマージバック
git checkout develop
git merge main
git push origin develop
```

## 📞 サポート・連絡先

### 質問・相談

- **GitHub Discussions**: 一般的な質問や提案
- **Slack**: リアルタイムでの相談（招待が必要）
- **Email**: support@conea.ai

### 緊急事項

- **セキュリティ問題**: security@conea.ai
- **重大なバグ**: GitHub Issues（Priority: Critical ラベル）

## 🙏 貢献者への謝辞

すべての貢献者の努力に感謝します！貢献は以下の形で認められます：

- **README.md** の Contributors セクション
- **CHANGELOG.md** のクレジット
- **リリースノート** での言及
- **貢献者バッジ** の付与

---

## ライセンス

このプロジェクトへの貢献により、あなたのコントリビューションが [MIT License](LICENSE) の下でライセンスされることに同意したものとします。

---

*貢献ガイドラインについて質問がある場合は、お気軽にお問い合わせください。皆様のコントリビューションをお待ちしています！*