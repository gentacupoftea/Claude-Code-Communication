#!/bin/bash
set -e

cd /Users/mourigenta/projects/conea-integration

echo "=== 正しいファイル（EC運営支援AI版）をfrontendに反映 ==="

echo "1. 現在のfrontendディレクトリをバックアップ:"
if [ -d "frontend" ]; then
    mv frontend frontend-backup-$(date +%Y%m%d_%H%M%S)
    echo "バックアップ完了"
fi

echo ""
echo "2. firebase-12ed7a-correctの内容を確認:"
echo "index.htmlのタイトル:"
grep "<title>" firebase-12ed7a-correct/index.html
echo ""
echo "アセットファイル:"
ls -la firebase-12ed7a-correct/assets/

echo ""
echo "3. 新しいfrontendディレクトリを作成:"
mkdir -p frontend
mkdir -p frontend/dist
mkdir -p frontend/public

echo ""
echo "4. firebase-12ed7a-correctの内容をコピー:"
cp -r firebase-12ed7a-correct/* frontend/dist/
echo "distディレクトリにコピー完了"

echo ""
echo "5. 必要なファイルを追加:"
# package.jsonを作成
cat > frontend/package.json << 'EOF'
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

# firebase.jsonを作成
cat > frontend/firebase.json << 'EOF'
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
EOF

# .firebasercを作成
cat > frontend/.firebaserc << 'EOF'
{
  "projects": {
    "default": "conea-service",
    "staging": "conea-service"
  },
  "targets": {
    "conea-service": {
      "hosting": {
        "production": ["conea-service"],
        "staging": ["stagingapp-conea-ai"]
      }
    }
  }
}
EOF

# README.mdを作成
cat > frontend/README.md << 'EOF'
# Conea Frontend - EC運営支援AI

Firebase Hosting（stagingapp.conea.ai）から復元された正式版フロントエンド

## バージョン情報
- タイトル: Conea Agent - EC運営支援AI
- JSファイル: index-CNvOEPAQ.js
- CSSファイル: index-BvdlortN.css
- 復元日: 2025年5月28日

## セットアップ
```bash
npm install
npm run dev
```

## デプロイ
```bash
# ステージング環境
firebase deploy --only hosting:staging

# 本番環境
firebase deploy --only hosting:production
```

## 開発サーバー（SPA対応）
```bash
node server.js
```
EOF

# server.jsも追加（SPA対応）
cat > frontend/server.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Login page: http://localhost:3000/login');
  console.log('Dashboard: http://localhost:3000/dashboard');
});
EOF

# publicディレクトリにvite.svgをコピー（もしあれば）
if [ -f "firebase-12ed7a-correct/vite.svg" ]; then
    cp firebase-12ed7a-correct/vite.svg frontend/public/
fi

echo ""
echo "6. 最終確認:"
echo "----------------------------------------"
echo "frontend/dist/index.html:"
head -15 frontend/dist/index.html
echo ""
echo "frontend/dist/assets:"
ls -la frontend/dist/assets/

echo ""
echo "=== 反映完了 ==="
echo "正しいバージョン（EC運営支援AI）がfrontendディレクトリに設定されました"