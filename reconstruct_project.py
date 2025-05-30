#!/usr/bin/env python3
import os
import json
import re

def create_project_structure():
    """解析結果に基づいてプロジェクト構造を再構築"""
    
    # プロジェクトディレクトリを作成
    project_dir = '/Users/mourigenta/projects/conea-integration/conea-app-reconstructed'
    os.makedirs(project_dir, exist_ok=True)
    
    # 基本的なディレクトリ構造を作成
    dirs = [
        'src',
        'src/components',
        'src/components/auth',
        'src/components/dashboard',
        'src/components/chat',
        'src/components/products',
        'src/components/orders',
        'src/components/settings',
        'src/pages',
        'src/services',
        'src/hooks',
        'src/utils',
        'src/styles',
        'src/types',
        'public',
    ]
    
    for dir_path in dirs:
        os.makedirs(os.path.join(project_dir, dir_path), exist_ok=True)
    
    # package.json を作成
    package_json = {
        "name": "conea-agent",
        "private": True,
        "version": "0.1.0",
        "type": "module",
        "scripts": {
            "dev": "vite",
            "build": "tsc && vite build",
            "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
            "preview": "vite preview"
        },
        "dependencies": {
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
            "react-router-dom": "^6.20.0",
            "firebase": "^10.7.0",
            "@mui/material": "^5.14.0",
            "@emotion/react": "^11.11.0",
            "@emotion/styled": "^11.11.0",
            "axios": "^1.6.0",
            "zustand": "^4.4.0",
            "@tanstack/react-query": "^5.12.0",
            "react-hook-form": "^7.48.0",
            "recharts": "^2.10.0",
            "date-fns": "^2.30.0"
        },
        "devDependencies": {
            "@types/react": "^18.2.43",
            "@types/react-dom": "^18.2.17",
            "@typescript-eslint/eslint-plugin": "^6.14.0",
            "@typescript-eslint/parser": "^6.14.0",
            "@vitejs/plugin-react": "^4.2.1",
            "eslint": "^8.55.0",
            "eslint-plugin-react-hooks": "^4.6.0",
            "eslint-plugin-react-refresh": "^0.4.5",
            "typescript": "^5.2.2",
            "vite": "^5.0.8"
        }
    }
    
    with open(os.path.join(project_dir, 'package.json'), 'w') as f:
        json.dump(package_json, f, indent=2)
    
    # vite.config.ts を作成
    vite_config = """import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
"""
    
    with open(os.path.join(project_dir, 'vite.config.ts'), 'w') as f:
        f.write(vite_config)
    
    # tsconfig.json を作成
    tsconfig = {
        "compilerOptions": {
            "target": "ES2020",
            "useDefineForClassFields": True,
            "lib": ["ES2020", "DOM", "DOM.Iterable"],
            "module": "ESNext",
            "skipLibCheck": True,
            "moduleResolution": "bundler",
            "allowImportingTsExtensions": True,
            "resolveJsonModule": True,
            "isolatedModules": True,
            "noEmit": True,
            "jsx": "react-jsx",
            "strict": True,
            "noUnusedLocals": True,
            "noUnusedParameters": True,
            "noFallthroughCasesInSwitch": True,
            "baseUrl": ".",
            "paths": {
                "@/*": ["./src/*"]
            }
        },
        "include": ["src"],
        "references": [{"path": "./tsconfig.node.json"}]
    }
    
    with open(os.path.join(project_dir, 'tsconfig.json'), 'w') as f:
        json.dump(tsconfig, f, indent=2)
    
    # index.html を作成
    index_html = """<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Conea Agent - EC運営支援AI</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
"""
    
    with open(os.path.join(project_dir, 'index.html'), 'w') as f:
        f.write(index_html)
    
    # src/main.tsx を作成
    main_tsx = """import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
"""
    
    with open(os.path.join(project_dir, 'src/main.tsx'), 'w') as f:
        f.write(main_tsx)
    
    # src/App.tsx を作成
    app_tsx = """import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'

// Components
import PrivateRoute from './components/auth/PrivateRoute'
import Layout from './components/Layout'

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: '"Inter", "Noto Sans JP", sans-serif',
  },
})

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
"""
    
    with open(os.path.join(project_dir, 'src/App.tsx'), 'w') as f:
        f.write(app_tsx)
    
    # Firebase 設定ファイルを作成
    firebase_config = """import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: "conea-service",
  storageBucket: "conea-storage",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

export default app
"""
    
    with open(os.path.join(project_dir, 'src/services/firebase.ts'), 'w') as f:
        f.write(firebase_config)
    
    # .env.example を作成
    env_example = """# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
VITE_FIREBASE_PROJECT_ID=conea-service
VITE_FIREBASE_STORAGE_BUCKET=conea-storage
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here

# API Endpoints
VITE_API_URL=https://api.conea.ai
"""
    
    with open(os.path.join(project_dir, '.env.example'), 'w') as f:
        f.write(env_example)
    
    # README.md を作成
    readme = """# Conea Agent - EC運営支援AI

復元されたConea Agentアプリケーションのソースコード。

## 機能

- **認証システム**: Firebaseを使用したユーザー認証
- **ダッシュボード**: ECサイトの統計情報表示
- **商品管理**: 在庫管理と商品情報の更新
- **注文管理**: 注文の追跡と処理
- **チャット機能**: カスタマーサポート用チャット
- **レポート**: 売上分析とレポート生成
- **設定**: ユーザー設定とプロファイル管理

## セットアップ

1. 依存関係のインストール:
```bash
npm install
```

2. 環境変数の設定:
```bash
cp .env.example .env
# .envファイルを編集してFirebaseの認証情報を設定
```

3. 開発サーバーの起動:
```bash
npm run dev
```

## ビルド

```bash
npm run build
```

## 技術スタック

- React 18
- TypeScript
- Vite
- Firebase (Auth, Firestore, Storage)
- Material-UI
- React Router
- React Query
- Zustand (状態管理)

## プロジェクト構造

```
src/
├── components/     # 再利用可能なコンポーネント
├── pages/         # ページコンポーネント
├── services/      # APIとFirebaseサービス
├── hooks/         # カスタムフック
├── utils/         # ユーティリティ関数
├── styles/        # グローバルスタイル
└── types/         # TypeScript型定義
```
"""
    
    with open(os.path.join(project_dir, 'README.md'), 'w') as f:
        f.write(readme)
    
    # 基本的なコンポーネントファイルを作成
    # Login.tsx
    login_page = """import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../services/firebase'
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/dashboard')
    } catch (error: any) {
      setError('ログインに失敗しました。メールアドレスとパスワードを確認してください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center">
            Conea Agent
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
            EC運営支援AI
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="メールアドレス"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="パスワード"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  )
}
"""
    
    with open(os.path.join(project_dir, 'src/pages/Login.tsx'), 'w') as f:
        f.write(login_page)
    
    print(f"プロジェクト構造を作成しました: {project_dir}")
    return project_dir

if __name__ == '__main__':
    project_dir = create_project_structure()
    print("\n次のステップ:")
    print("1. cd " + project_dir)
    print("2. npm install")
    print("3. cp .env.example .env")
    print("4. .envファイルにFirebaseの認証情報を設定")
    print("5. npm run dev")