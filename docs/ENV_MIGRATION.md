# 環境変数移行計画

## 概要

プロジェクト名の「shopify-mcp-server」から「conea」への変更に伴い、環境変数やGCP設定の移行も段階的に進めています。本ドキュメントは、環境変数の変更計画と後方互換性の確保について説明します。

## 現在の環境変数と新しい環境変数

### v0.3.0での変更（現在）

現在のリリース（v0.3.0）では、すべての既存環境変数は引き続き動作しますが、以下の新しい変数名も導入されています。
いずれの変数も両方の名前を使用でき、新変数名が優先されます。

| 現在の変数名 | 新しい変数名 | 説明 |
|------------|-------------|------|
| `SHOPIFY_MCP_PROJECT_ID` | `PROJECT_ID` | GCPプロジェクトID |
| `SHOPIFY_MCP_SERVICE_NAME` | `SERVICE_NAME` | Cloud Runサービス名 |
| `SHOPIFY_MCP_SERVICE_ACCOUNT` | `SERVICE_ACCOUNT` | サービスアカウント |
| `SHOPIFY_REPO` | `CONEA_REPO` | Artifact Registryリポジトリ名 |

### v0.3.1での変更（予定）

次のリリース（v0.3.1）では、アプリケーション固有の環境変数が変更される予定です：

| 現在の変数名 | 新しい変数名 | 説明 |
|------------|-------------|------|
| `SHOPIFY_ACCESS_TOKEN` | `SHOPIFY_ACCESS_TOKEN` (変更なし) | Shopify APIアクセストークン |
| `SHOPIFY_SHOP_NAME` | `SHOPIFY_SHOP_NAME` (変更なし) | Shopifyショップ名 |
| `SHOPIFY_API_VERSION` | `SHOPIFY_API_VERSION` (変更なし) | Shopify APIバージョン |
| `SHOPIFY_RATE_LIMIT_RPS` | `SHOPIFY_RATE_LIMIT_RPS` (変更なし) | レート制限（秒間リクエスト数） |
| `MCP_SERVER_NAME` | `CONEA_SERVER_NAME` | サーバー名 |
| `MCP_SERVER_VERSION` | `CONEA_VERSION` | サーバーバージョン |
| `MCP_SERVER_DESCRIPTION` | `CONEA_DESCRIPTION` | サーバー説明 |

### v0.3.2での変更（予定）

最終フェーズ（v0.3.2）では、以下の変更が予定されています：

1. 新しいGCPプロジェクトへの移行
2. 新しいArtifact Registryリポジトリの作成
3. 新しいCloud Runサービス名への移行

## 実装方法

### 後方互換性の確保

各デプロイスクリプト（`deploy_production.sh`、`rollback_v0.3.0.sh`など）において、以下のパターンで両方の変数をサポートしています：

```bash
# 後方互換性のために旧変数名もサポート
SHOPIFY_MCP_PROJECT_ID="${SHOPIFY_MCP_PROJECT_ID:-${PROJECT_ID}}"
PROJECT_ID="${PROJECT_ID:-conea-prod}"
PROJECT_ID="${SHOPIFY_MCP_PROJECT_ID:-$PROJECT_ID}"  # 旧変数名をサポート
```

これにより：
1. 新しい変数名（`PROJECT_ID`）が設定されていればそれを使用
2. 設定されていなければデフォルト値（例：`conea-prod`）を使用
3. 旧変数名（`SHOPIFY_MCP_PROJECT_ID`）が設定されていれば、それを優先

### コードでの環境変数読み込み

アプリケーションコードでも同様のアプローチで両方の変数をサポートします：

```python
def get_env_var(new_name, old_name, default=None):
    """新旧両方の環境変数名をサポート"""
    return os.environ.get(new_name) or os.environ.get(old_name) or default

# 使用例
project_id = get_env_var("PROJECT_ID", "SHOPIFY_MCP_PROJECT_ID", "conea-prod")
```

## ユーザーへの影響

### v0.3.0（現在）

- 既存の環境変数設定はそのまま使用可能
- 新しい変数名を使用したい場合は、`.env`ファイルの更新が必要
- 古い変数名と新しい変数名の両方を指定した場合、新しい変数名が優先

### v0.3.1（次期リリース）

- アプリケーション固有の環境変数の移行が始まる
- 古い変数名は引き続きサポートされる
- 新しいインストールでは新しい変数名の使用を推奨

### v0.3.2（最終フェーズ）

- 完全に新しい変数名体系への移行が完了
- 古い変数名のサポートは最終フェーズでも継続（1年間を予定）
- 警告メッセージが表示されるようになる

## 移行手順

### ユーザー向け手順

1. 新しい`.env.example`ファイルをテンプレートとして使用
2. 既存の設定を確認し、必要に応じて新しい変数名に更新
3. 設定を確認するために`conea check-config`コマンドを実行（v0.3.1以降）

### 開発者向け手順

1. 環境変数を使用する箇所では`get_env_var`ヘルパー関数を使用
2. テストでは両方の変数名をテスト
3. ドキュメントでは新しい変数名を優先して記載

## 検証方法

変更の検証には以下の方法を使用しています：

1. 環境変数テストスクリプト(`test_env_vars.py`)の実行
2. デプロイスクリプトの`--dry-run`モードでの検証
3. ステージング環境での実際のデプロイテスト

## まとめ

本計画は、プロジェクト名変更に伴う環境変数の移行を段階的に進め、常に後方互換性を保ちながらスムーズな移行を実現することを目的としています。ユーザーへの影響を最小限に抑えつつ、新しい名称体系への移行を進めています。