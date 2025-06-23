# Google OAuth2統合ガイド（Worker A-2成果物）

## 🔐 OAuth2認証フロー実装

### 1. 基本セットアップ

```typescript
import { OAuth2Client } from 'google-auth-library';
import { Request, Response } from 'express';

// OAuth2クライアント初期化
const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI
});

// 認証URL生成
export const generateAuthUrl = (): string => {
  return googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/analytics.readonly' // Conea固有
    ],
    include_granted_scopes: true
  });
};
```

### 2. トークン検証パターン

```typescript
// ID Token検証
export async function verifyIdToken(token: string): Promise<TokenPayload | null> {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid token payload');
    }
    
    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// Access Token検証
export async function verifyAccessToken(accessToken: string): Promise<boolean> {
  try {
    const response = await googleClient.getTokenInfo(accessToken);
    return response.aud === process.env.GOOGLE_CLIENT_ID;
  } catch (error) {
    console.error('Access token verification failed:', error);
    return false;
  }
}
```

### 3. セッション管理統合

```typescript
import { AuthSession } from '../types/auth';

// Google認証とセッション管理の統合
export async function createGoogleAuthSession(
  authCode: string
): Promise<AuthSession | null> {
  try {
    // 認証コードからトークンを取得
    const { tokens } = await googleClient.getToken(authCode);
    
    if (!tokens.id_token) {
      throw new Error('ID token not received');
    }
    
    // ID Token検証
    const userInfo = await verifyIdToken(tokens.id_token);
    if (!userInfo) {
      throw new Error('Invalid user information');
    }
    
    // セッション作成
    const sessionId = `google-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const authSession: AuthSession = {
      sessionId,
      userId: userInfo.userId,
      role: 'user', // デフォルト役割
      permissions: ['read', 'analytics'], // Conea固有権限
      claudeAuthenticated: false,
      terminalSessions: [],
      createdAt: new Date(),
      lastActivity: new Date(),
      securityLevel: 'basic',
      googleTokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiryDate: tokens.expiry_date
      },
      userInfo
    };
    
    return authSession;
  } catch (error) {
    console.error('Google auth session creation failed:', error);
    return null;
  }
}
```

### 4. エンドポイント実装

```typescript
// Google認証開始エンドポイント
router.get('/auth/google/start', (req: Request, res: Response): void => {
  const authUrl = generateAuthUrl();
  res.redirect(authUrl);
});

// Google認証コールバック
router.get('/auth/google/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, error } = req.query;
    
    if (error) {
      res.status(400).json({ error: 'Google認証が拒否されました' });
      return;
    }
    
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: '認証コードが無効です' });
      return;
    }
    
    // セッション作成
    const authSession = await createGoogleAuthSession(code);
    if (!authSession) {
      res.status(500).json({ error: 'セッション作成に失敗しました' });
      return;
    }
    
    // JWT生成
    const token = jwt.sign(
      {
        sessionId: authSession.sessionId,
        userId: authSession.userId,
        role: authSession.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // セッション保存
    activeSessions.set(authSession.sessionId, authSession);
    
    res.json({
      success: true,
      token,
      user: authSession.userInfo,
      message: 'Google認証完了'
    });
    
  } catch (error) {
    console.error('Google callback error:', error);
    res.status(500).json({ error: 'Google認証処理エラー' });
  }
});
```

### 5. トークンリフレッシュ

```typescript
// アクセストークンの自動更新
export async function refreshGoogleTokens(
  refreshToken: string
): Promise<{ accessToken: string; expiryDate: number } | null> {
  try {
    googleClient.setCredentials({
      refresh_token: refreshToken
    });
    
    const { credentials } = await googleClient.refreshAccessToken();
    
    return {
      accessToken: credentials.access_token!,
      expiryDate: credentials.expiry_date!
    };
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

// セッション内トークン更新
export async function updateSessionTokens(sessionId: string): Promise<boolean> {
  const session = activeSessions.get(sessionId);
  if (!session?.googleTokens?.refreshToken) {
    return false;
  }
  
  const newTokens = await refreshGoogleTokens(session.googleTokens.refreshToken);
  if (!newTokens) {
    return false;
  }
  
  // セッション更新
  session.googleTokens.accessToken = newTokens.accessToken;
  session.googleTokens.expiryDate = newTokens.expiryDate;
  session.lastActivity = new Date();
  
  activeSessions.set(sessionId, session);
  return true;
}
```

### 6. Google Analytics API統合

```typescript
import { google } from 'googleapis';

// Analytics API クライアント作成
export function createAnalyticsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  
  return google.analytics({
    version: 'v3',
    auth
  });
}

// Conea固有のAnalytics データ取得
export async function getConealAnalyticsData(
  sessionId: string
): Promise<any> {
  const session = activeSessions.get(sessionId);
  if (!session?.googleTokens?.accessToken) {
    throw new Error('Google認証が必要です');
  }
  
  // トークン有効性チェック
  if (Date.now() > (session.googleTokens.expiryDate || 0)) {
    const refreshed = await updateSessionTokens(sessionId);
    if (!refreshed) {
      throw new Error('トークンの更新に失敗しました');
    }
  }
  
  const analytics = createAnalyticsClient(session.googleTokens.accessToken!);
  
  // 分析データ取得（Conea固有ロジック）
  const response = await analytics.data.ga.get({
    ids: `ga:${process.env.GA_VIEW_ID}`,
    'start-date': '30daysAgo',
    'end-date': 'today',
    metrics: 'ga:sessions,ga:users,ga:pageviews',
    dimensions: 'ga:date'
  });
  
  return response.data;
}
```

## 🔒 セキュリティベストプラクティス

1. **PKCE使用**: コードチャレンジによる追加セキュリティ
2. **State検証**: CSRF攻撃防止
3. **トークン暗号化**: 保存時の暗号化
4. **スコープ最小化**: 必要最小限の権限のみ要求

## 📊 エラーハンドリング

- 認証失敗時の適切なフォールバック
- トークン期限切れの自動処理
- ネットワークエラーの再試行ロジック

このガイドにより、Coneaプロジェクト固有のGoogle OAuth2統合を実現できます。