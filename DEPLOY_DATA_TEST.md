# デプロイデータテスト

このファイルはCI/CDパイプラインのデータテスト用に作成されました。

## テストデータ

```json
{
  "version": "v0.3.1-dev",
  "timestamp": "2025-05-22T01:55:00+09:00",
  "features": [
    "offline-support",
    "diagnostics-tools",
    "help-system"
  ],
  "deployment": {
    "staging": {
      "url": "https://staging.conea.example.com",
      "docker_images": [
        "conea/frontend:staging",
        "conea/backend:staging"
      ]
    },
    "production": {
      "url": "https://conea.example.com",
      "docker_images": [
        "conea/frontend:latest",
        "conea/backend:latest"
      ],
      "strategy": "blue-green"
    }
  }
}
```

## ワークフロートリガーテスト

このファイルのコミットにより、GitHub Actionsワークフローがトリガーされることを確認します。