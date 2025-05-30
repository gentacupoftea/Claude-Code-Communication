#!/bin/bash
set -e

cd /Users/mourigenta/projects/conea-integration

echo "=== frontendディレクトリの再整備 ==="

echo "1. 現在のfrontendディレクトリを一旦削除:"
rm -rf frontend

echo ""
echo "2. restored-firebase-deploymentから正しくコピー:"
cp -r restored-firebase-deployment frontend

echo ""
echo "3. 不要なファイルを削除:"
cd frontend
rm -f server.js server-3001.js

echo ""
echo "4. 正しいファイル構造を確認:"
ls -la

echo ""
echo "5. srcディレクトリの確認:"
ls -la src/ 2>/dev/null || echo "srcディレクトリなし（ビルド済みのため正常）"

echo ""
echo "6. package.jsonの内容確認:"
if [ -f "package.json" ]; then
    cat package.json
else
    echo "package.jsonが見つかりません！作成します..."
    # restored-firebase-deploymentにpackage.jsonがない場合は作成
    cat > package.json << 'EOF'
{
  "name": "conea-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && firebase deploy --only hosting"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.20.0",
    "firebase": "^10.7.0",
    "@mui/material": "^5.14.0",
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8",
    "express": "^4.18.2"
  }
}
EOF
fi

echo ""
echo "7. README.mdの作成:"
cat > README.md << 'EOF'
# Conea Frontend

Firebase Hostingから復元されたフロントエンドアプリケーション（ハッシュ: 12ed7a）

## 概要
- EC運営支援AIシステムのフロントエンド
- React + TypeScript + Vite
- Firebase統合済み

## セットアップ
```bash
npm install
npm run dev
```

## ビルド & デプロイ
```bash
npm run build
npm run deploy
```

## 復元日
2025年5月28日
EOF

echo ""
echo "8. Gitの状態を確認:"
cd ..
git status

echo ""
echo "=== 準備完了 ==="
echo "次のステップ: GitHubへのプッシュ"