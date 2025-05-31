#!/bin/bash
set -e

echo "=== プロジェクト構造の再構築 ==="

cd /Users/mourigenta/projects/conea-integration/restored-firebase-deployment

# プロジェクトのルートディレクトリ構造を作成
mkdir -p src
mkdir -p public
mkdir -p dist

# distディレクトリに現在のファイルを移動
mv assets dist/
mv index.html dist/
mv vite.svg public/
mv robots.txt public/ 2>/dev/null || true

# package.jsonの作成
cat > package.json << 'EOF'
{
  "name": "conea-agent",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy:staging": "npm run build && firebase deploy --only hosting:staging",
    "deploy:production": "npm run build && firebase deploy --only hosting:production"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.30.1",
    "@mui/material": "^5.15.0",
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "typescript": "^5.3.0"
  }
}
EOF

# vite.config.jsの作成
cat > vite.config.js << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist'
  }
})
EOF

# tsconfig.jsonの作成
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

# tsconfig.node.jsonの作成
cat > tsconfig.node.json << 'EOF'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.js"]
}
EOF

# .gitignoreの作成
cat > .gitignore << 'EOF'
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Firebase
.firebase/
firebase-debug.log
EOF

# firebase.jsonの作成
cat > firebase.json << 'EOF'
{
  "hosting": [
    {
      "site": "stagingapp-conea-ai",
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
    },
    {
      "site": "app-conea-ai",
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
  ]
}
EOF

# .firebasercの作成
cat > .firebaserc << 'EOF'
{
  "projects": {
    "default": "conea-48fcf",
    "staging": "conea-48fcf",
    "production": "conea-48fcf"
  },
  "targets": {
    "conea-48fcf": {
      "hosting": {
        "staging": [
          "stagingapp-conea-ai"
        ],
        "production": [
          "app-conea-ai"
        ]
      }
    }
  },
  "etags": {}
}
EOF

# 基本的なREADME.mdの作成
cat > README.md << 'EOF'
# Conea Agent - EC運営支援AI

このプロジェクトは、stagingapp.conea.aiから復元されたFirebaseデプロイメントです。

## セットアップ

1. 依存関係のインストール:
```bash
npm install
```

2. 開発サーバーの起動:
```bash
npm run dev
```

3. ビルド:
```bash
npm run build
```

4. デプロイ:
```bash
# ステージング環境へのデプロイ
npm run deploy:staging

# 本番環境へのデプロイ
npm run deploy:production
```

## 復元情報

- 復元日: $(date)
- 復元元: https://stagingapp.conea.ai
- 復元されたファイル:
  - /assets/index-CNvOEPAQ.js
  - /assets/index-BvdlortN.css
  - /index.html
  - /vite.svg

## 注意事項

これは復元されたプロジェクトです。元のソースコードは含まれていません。
ビルド済みのファイルのみが復元されています。
EOF

echo ""
echo "=== プロジェクト構造の再構築が完了しました ==="
echo ""
echo "復元されたプロジェクト構造:"
find . -type f -name "*" | grep -v "node_modules" | sort