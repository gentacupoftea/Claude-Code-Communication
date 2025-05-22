import * as express from 'express';
import { Auth } from 'google-auth-library';
import * as admin from 'firebase-admin';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { Redis } from 'ioredis';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';
import { DataLayerClient } from '../core/DataLayerClient';
import { EventBroker } from '../core/EventBroker';

interface AuthConfig {
  projectId: string;
  jwtSecret: string;
  tokenExpiry: number;
  refreshTokenExpiry: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  mfaEnabled: boolean;
  allowedDomains?: string[];
}

interface User {
  id: string;
  email: string;
  passwordHash?: string;
  roles: string[];
  permissions: string[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    lastLogin?: Date;
    loginAttempts: number;
    lockedUntil?: Date;
    mfaEnabled: boolean;
    mfaSecret?: string;
  };
  profile: {
    name?: string;
    company?: string;
    shopifyStoreUrl?: string;
    language?: string;
    timezone?: string;
  };
}

interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
  metadata: {
    ip: string;
    userAgent: string;
    location?: string;
  };
}

interface ApiKey {
  id: string;
  key: string;
  userId: string;
  name: string;
  roles: string[];
  permissions: string[];
  expiresAt?: Date;
  metadata: {
    createdAt: Date;
    lastUsed?: Date;
    usageCount: number;
  };
}

export class AuthService {
  private app: express.Application;
  private auth: Auth;
  private admin: admin.app.App;
  private secretManager: SecretManagerServiceClient;
  private dataLayer: DataLayerClient;
  private eventBroker: EventBroker;
  private redis: Redis;
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    this.app = express();
    this.auth = new Auth();
    this.secretManager = new SecretManagerServiceClient();
    
    // Initialize Firebase Admin
    this.admin = admin.initializeApp({
      projectId: config.projectId
    });

    // Initialize data layer
    this.dataLayer = new DataLayerClient({
      projectId: config.projectId,
      region: 'asia-northeast1',
      firestore: { databaseId: 'shopify-mcp-db' },
      bigquery: { datasetId: 'analytics' },
      redis: {
        host: 'localhost', // Should come from config
        port: 6379
      },
      storage: { bucketName: `${config.projectId}-auth` }
    });

    // Initialize event broker
    this.eventBroker = new EventBroker({
      projectId: config.projectId,
      region: 'asia-northeast1'
    });

    // Initialize Redis for session management
    this.redis = new Redis({
      host: 'localhost', // Should come from config
      port: 6379,
      db: 1
    });

    this.setupRoutes();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      logger.info('Auth request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: 'auth' });
    });

    // OAuth2 flow
    this.app.get('/oauth/authorize', this.handleOAuthAuthorize.bind(this));
    this.app.post('/oauth/token', this.handleOAuthToken.bind(this));
    this.app.post('/oauth/revoke', this.handleOAuthRevoke.bind(this));

    // User authentication
    this.app.post('/auth/login', this.handleLogin.bind(this));
    this.app.post('/auth/logout', this.handleLogout.bind(this));
    this.app.post('/auth/register', this.handleRegister.bind(this));
    this.app.post('/auth/refresh', this.handleRefreshToken.bind(this));
    this.app.post('/auth/forgot-password', this.handleForgotPassword.bind(this));
    this.app.post('/auth/reset-password', this.handleResetPassword.bind(this));

    // User management
    this.app.get('/users/me', this.requireAuth.bind(this), this.handleGetCurrentUser.bind(this));
    this.app.put('/users/me', this.requireAuth.bind(this), this.handleUpdateProfile.bind(this));
    this.app.post('/users/me/change-password', this.requireAuth.bind(this), this.handleChangePassword.bind(this));
    this.app.post('/users/me/enable-mfa', this.requireAuth.bind(this), this.handleEnableMFA.bind(this));
    this.app.post('/users/me/verify-mfa', this.requireAuth.bind(this), this.handleVerifyMFA.bind(this));

    // API key management
    this.app.get('/api-keys', this.requireAuth.bind(this), this.handleListApiKeys.bind(this));
    this.app.post('/api-keys', this.requireAuth.bind(this), this.handleCreateApiKey.bind(this));
    this.app.delete('/api-keys/:id', this.requireAuth.bind(this), this.handleDeleteApiKey.bind(this));

    // Admin routes
    this.app.get('/admin/users', this.requireAuth.bind(this), this.requireRole('admin'), this.handleListUsers.bind(this));
    this.app.get('/admin/users/:id', this.requireAuth.bind(this), this.requireRole('admin'), this.handleGetUser.bind(this));
    this.app.put('/admin/users/:id', this.requireAuth.bind(this), this.requireRole('admin'), this.handleUpdateUser.bind(this));
    this.app.delete('/admin/users/:id', this.requireAuth.bind(this), this.requireRole('admin'), this.handleDeleteUser.bind(this));
    this.app.post('/admin/users/:id/roles', this.requireAuth.bind(this), this.requireRole('admin'), this.handleAssignRoles.bind(this));
  }

  // OAuth2 handlers
  private async handleOAuthAuthorize(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { client_id, redirect_uri, response_type, scope, state } = req.query;

      // Validate client_id
      const client = await this.validateClient(client_id as string);
      if (!client) {
        res.status(400).json({ error: 'invalid_client' });
        return;
      }

      // Generate authorization code
      const code = uuidv4();
      await this.redis.setex(`auth_code:${code}`, 600, JSON.stringify({
        clientId: client_id,
        redirectUri: redirect_uri,
        scope,
        userId: (req as any).user?.id
      }));

      // Redirect with code
      const redirectUrl = new URL(redirect_uri as string);
      redirectUrl.searchParams.append('code', code);
      if (state) {
        redirectUrl.searchParams.append('state', state as string);
      }

      res.redirect(redirectUrl.toString());
    } catch (error) {
      logger.error('OAuth authorize error', { error });
      res.status(500).json({ error: 'server_error' });
    }
  }

  private async handleOAuthToken(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { grant_type, code, refresh_token, client_id, client_secret } = req.body;

      // Validate client credentials
      const client = await this.validateClient(client_id, client_secret);
      if (!client) {
        res.status(401).json({ error: 'invalid_client' });
        return;
      }

      if (grant_type === 'authorization_code') {
        // Exchange code for tokens
        const authData = await this.redis.get(`auth_code:${code}`);
        if (!authData) {
          res.status(400).json({ error: 'invalid_grant' });
          return;
        }

        const { userId, scope } = JSON.parse(authData);
        await this.redis.del(`auth_code:${code}`);

        // Generate tokens
        const tokens = await this.generateTokens(userId, scope);
        res.json(tokens);
      } else if (grant_type === 'refresh_token') {
        // Refresh access token
        const tokenData = await this.validateRefreshToken(refresh_token);
        if (!tokenData) {
          res.status(400).json({ error: 'invalid_grant' });
          return;
        }

        const tokens = await this.generateTokens(tokenData.userId, tokenData.scope);
        res.json(tokens);
      } else {
        res.status(400).json({ error: 'unsupported_grant_type' });
      }
    } catch (error) {
      logger.error('OAuth token error', { error });
      res.status(500).json({ error: 'server_error' });
    }
  }

  private async handleOAuthRevoke(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { token, token_type_hint } = req.body;

      // Revoke the token
      await this.revokeToken(token);

      res.status(200).end();
    } catch (error) {
      logger.error('OAuth revoke error', { error });
      res.status(500).json({ error: 'server_error' });
    }
  }

  // Authentication handlers
  private async handleLogin(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { email, password, mfaCode } = req.body;

      // Validate input
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Get user
      const user = await this.getUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Check lockout
      if (user.metadata.lockedUntil && user.metadata.lockedUntil > new Date()) {
        res.status(423).json({ error: 'Account locked', lockedUntil: user.metadata.lockedUntil });
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash!);
      if (!isValidPassword) {
        await this.handleFailedLogin(user);
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Verify MFA if enabled
      if (user.metadata.mfaEnabled) {
        if (!mfaCode) {
          res.status(200).json({ requiresMfa: true });
          return;
        }

        const isValidMfa = await this.verifyMfaCode(user, mfaCode);
        if (!isValidMfa) {
          res.status(401).json({ error: 'Invalid MFA code' });
          return;
        }
      }

      // Create session
      const session = await this.createSession(user, req);
      
      // Update last login
      await this.updateLastLogin(user);

      // Emit login event
      await this.eventBroker.publish('auth-events', 'user.login', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        user: this.sanitizeUser(user),
        token: session.token,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt
      });
    } catch (error) {
      logger.error('Login error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleLogout(req: express.Request, res: express.Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        await this.revokeToken(token);
      }

      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      logger.error('Logout error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleRegister(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { email, password, name, company } = req.body;

      // Validate input
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Check if user exists
      const existingUser = await this.getUserByEmail(email);
      if (existingUser) {
        res.status(409).json({ error: 'User already exists' });
        return;
      }

      // Validate email domain if configured
      if (this.config.allowedDomains) {
        const domain = email.split('@')[1];
        if (!this.config.allowedDomains.includes(domain)) {
          res.status(403).json({ error: 'Email domain not allowed' });
          return;
        }
      }

      // Create user
      const user = await this.createUser({
        email,
        password,
        profile: {
          name,
          company
        }
      });

      // Create session
      const session = await this.createSession(user, req);

      // Send welcome email
      await this.eventBroker.publish('auth-events', 'user.registered', {
        userId: user.id,
        email: user.email
      });

      res.status(201).json({
        user: this.sanitizeUser(user),
        token: session.token,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt
      });
    } catch (error) {
      logger.error('Registration error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleRefreshToken(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token is required' });
        return;
      }

      // Validate refresh token
      const tokenData = await this.validateRefreshToken(refreshToken);
      if (!tokenData) {
        res.status(401).json({ error: 'Invalid refresh token' });
        return;
      }

      // Get user
      const user = await this.getUserById(tokenData.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id, tokenData.scope);

      res.json(tokens);
    } catch (error) {
      logger.error('Refresh token error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // User management handlers
  private async handleGetCurrentUser(req: express.Request, res: express.Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const user = await this.getUserById(userId);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(this.sanitizeUser(user));
    } catch (error) {
      logger.error('Get current user error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleUpdateProfile(req: express.Request, res: express.Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const updates = req.body;

      // Update user profile
      const user = await this.updateUserProfile(userId, updates);

      res.json(this.sanitizeUser(user));
    } catch (error) {
      logger.error('Update profile error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Middleware
  private async requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      // Verify token
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;
      
      // Check if token is revoked
      const isRevoked = await this.redis.get(`revoked:${token}`);
      if (isRevoked) {
        res.status(401).json({ error: 'Token revoked' });
        return;
      }

      // Get user
      const user = await this.getUserById(decoded.userId);
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      // Attach user to request
      (req as any).user = user;
      next();
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token expired' });
      } else if (error.name === 'JsonWebTokenError') {
        res.status(401).json({ error: 'Invalid token' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  private requireRole(role: string) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const user = (req as any).user;
      
      if (!user || !user.roles.includes(role)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      
      next();
    };
  }

  // Helper methods
  private async getUserByEmail(email: string): Promise<User | null> {
    const results = await this.dataLayer.firestoreQuery('users', {
      where: [{ field: 'email', operator: '==', value: email }],
      limit: 1
    });

    return results[0] as User || null;
  }

  private async getUserById(id: string): Promise<User | null> {
    const user = await this.dataLayer.firestoreGet('users', id);
    return user as User || null;
  }

  private async createUser(data: any): Promise<User> {
    const passwordHash = await bcrypt.hash(data.password, 10);
    
    const user: User = {
      id: uuidv4(),
      email: data.email,
      passwordHash,
      roles: ['user'],
      permissions: [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        loginAttempts: 0,
        mfaEnabled: false
      },
      profile: data.profile || {}
    };

    await this.dataLayer.firestoreSet('users', user.id, user);
    
    return user;
  }

  private async createSession(user: User, req: express.Request): Promise<Session> {
    const sessionId = uuidv4();
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        roles: user.roles,
        sessionId 
      },
      this.config.jwtSecret,
      { expiresIn: this.config.tokenExpiry }
    );

    const refreshToken = jwt.sign(
      { 
        userId: user.id,
        sessionId,
        type: 'refresh' 
      },
      this.config.jwtSecret,
      { expiresIn: this.config.refreshTokenExpiry }
    );

    const session: Session = {
      id: sessionId,
      userId: user.id,
      token,
      refreshToken,
      expiresAt: new Date(Date.now() + this.config.tokenExpiry * 1000),
      refreshExpiresAt: new Date(Date.now() + this.config.refreshTokenExpiry * 1000),
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent'] || '',
        location: req.headers['x-forwarded-for']?.toString()
      }
    };

    // Store session in Redis
    await this.redis.setex(
      `session:${sessionId}`, 
      this.config.tokenExpiry,
      JSON.stringify(session)
    );

    return session;
  }

  private async generateTokens(userId: string, scope?: string): Promise<any> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        roles: user.roles,
        scope 
      },
      this.config.jwtSecret,
      { expiresIn: this.config.tokenExpiry }
    );

    const refreshToken = jwt.sign(
      { 
        userId: user.id,
        type: 'refresh',
        scope
      },
      this.config.jwtSecret,
      { expiresIn: this.config.refreshTokenExpiry }
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.tokenExpiry,
      refresh_token: refreshToken,
      scope
    };
  }

  private async validateRefreshToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;
      
      if (decoded.type !== 'refresh') {
        return null;
      }

      // Check if token is revoked
      const isRevoked = await this.redis.get(`revoked:${token}`);
      if (isRevoked) {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  private async revokeToken(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.redis.setex(`revoked:${token}`, ttl, '1');
        }
      }
    } catch (error) {
      logger.error('Failed to revoke token', { error });
    }
  }

  private sanitizeUser(user: User): any {
    const { passwordHash, metadata, ...sanitized } = user;
    return {
      ...sanitized,
      metadata: {
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        lastLogin: metadata.lastLogin,
        mfaEnabled: metadata.mfaEnabled
      }
    };
  }

  private async handleFailedLogin(user: User): Promise<void> {
    user.metadata.loginAttempts++;
    
    if (user.metadata.loginAttempts >= this.config.maxLoginAttempts) {
      user.metadata.lockedUntil = new Date(Date.now() + this.config.lockoutDuration * 1000);
    }
    
    await this.dataLayer.firestoreSet('users', user.id, user);
  }

  private async updateLastLogin(user: User): Promise<void> {
    user.metadata.lastLogin = new Date();
    user.metadata.loginAttempts = 0;
    user.metadata.lockedUntil = undefined;
    
    await this.dataLayer.firestoreSet('users', user.id, user);
  }

  private async validateClient(clientId: string, clientSecret?: string): Promise<any> {
    // Implement OAuth client validation
    // This would typically check against registered OAuth clients
    return true;
  }

  private async verifyMfaCode(user: User, code: string): Promise<boolean> {
    // Implement MFA verification (TOTP, SMS, etc.)
    return true;
  }

  private async updateUserProfile(userId: string, updates: any): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.profile = { ...user.profile, ...updates };
    user.metadata.updatedAt = new Date();
    
    await this.dataLayer.firestoreSet('users', user.id, user);
    
    return user;
  }

  // Password reset handlers
  private async handleForgotPassword(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { email } = req.body;

      const user = await this.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists
        res.json({ message: 'If the email exists, a reset link has been sent' });
        return;
      }

      // Generate reset token
      const resetToken = uuidv4();
      await this.redis.setex(`reset_token:${resetToken}`, 3600, user.id);

      // Send reset email
      await this.eventBroker.publish('auth-events', 'password.reset.requested', {
        userId: user.id,
        email: user.email,
        resetToken
      });

      res.json({ message: 'If the email exists, a reset link has been sent' });
    } catch (error) {
      logger.error('Forgot password error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleResetPassword(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { token, password } = req.body;

      // Validate reset token
      const userId = await this.redis.get(`reset_token:${token}`);
      if (!userId) {
        res.status(400).json({ error: 'Invalid or expired reset token' });
        return;
      }

      // Update password
      const user = await this.getUserById(userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      user.passwordHash = await bcrypt.hash(password, 10);
      user.metadata.updatedAt = new Date();
      await this.dataLayer.firestoreSet('users', user.id, user);

      // Delete reset token
      await this.redis.del(`reset_token:${token}`);

      // Send confirmation email
      await this.eventBroker.publish('auth-events', 'password.reset.completed', {
        userId: user.id,
        email: user.email
      });

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      logger.error('Reset password error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // MFA handlers
  private async handleEnableMFA(req: express.Request, res: express.Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const user = await this.getUserById(userId);
      
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Generate MFA secret
      const speakeasy = require('speakeasy');
      const secret = speakeasy.generateSecret({
        name: `ShopifyMCP:${user.email}`,
        issuer: 'Shopify MCP Server'
      });

      user.metadata.mfaSecret = secret.base32;
      await this.dataLayer.firestoreSet('users', user.id, user);

      res.json({
        secret: secret.base32,
        qrCode: secret.otpauth_url
      });
    } catch (error) {
      logger.error('Enable MFA error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleVerifyMFA(req: express.Request, res: express.Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { code } = req.body;
      
      const user = await this.getUserById(userId);
      if (!user || !user.metadata.mfaSecret) {
        res.status(400).json({ error: 'MFA not enabled' });
        return;
      }

      const speakeasy = require('speakeasy');
      const verified = speakeasy.totp.verify({
        secret: user.metadata.mfaSecret,
        encoding: 'base32',
        token: code,
        window: 2
      });

      if (!verified) {
        res.status(400).json({ error: 'Invalid MFA code' });
        return;
      }

      user.metadata.mfaEnabled = true;
      await this.dataLayer.firestoreSet('users', user.id, user);

      res.json({ message: 'MFA enabled successfully' });
    } catch (error) {
      logger.error('Verify MFA error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // API Key handlers
  private async handleListApiKeys(req: express.Request, res: express.Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      
      const apiKeys = await this.dataLayer.firestoreQuery('api_keys', {
        where: [{ field: 'userId', operator: '==', value: userId }]
      });

      res.json(apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        roles: key.roles,
        permissions: key.permissions,
        expiresAt: key.expiresAt,
        metadata: key.metadata
      })));
    } catch (error) {
      logger.error('List API keys error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleCreateApiKey(req: express.Request, res: express.Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { name, roles, permissions, expiresIn } = req.body;

      const apiKey: ApiKey = {
        id: uuidv4(),
        key: `sk_${uuidv4().replace(/-/g, '')}`,
        userId,
        name,
        roles: roles || [],
        permissions: permissions || [],
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
        metadata: {
          createdAt: new Date(),
          usageCount: 0
        }
      };

      await this.dataLayer.firestoreSet('api_keys', apiKey.id, apiKey);

      res.status(201).json({
        id: apiKey.id,
        key: apiKey.key, // Only shown once
        name: apiKey.name,
        roles: apiKey.roles,
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt
      });
    } catch (error) {
      logger.error('Create API key error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleDeleteApiKey(req: express.Request, res: express.Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      const apiKey = await this.dataLayer.firestoreGet('api_keys', id);
      if (!apiKey || apiKey.userId !== userId) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }

      await this.dataLayer.firestoreSet('api_keys', id, null);
      res.status(204).end();
    } catch (error) {
      logger.error('Delete API key error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Admin handlers
  private async handleListUsers(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      const users = await this.dataLayer.firestoreQuery('users', {
        limit: Number(limit),
        offset: Number(offset),
        orderBy: [{ field: 'metadata.createdAt', direction: 'desc' }]
      });

      res.json(users.map(user => this.sanitizeUser(user)));
    } catch (error) {
      logger.error('List users error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleGetUser(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = await this.getUserById(id);
      
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(this.sanitizeUser(user));
    } catch (error) {
      logger.error('Get user error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleUpdateUser(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const user = await this.getUserById(id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Update user
      Object.assign(user, updates);
      user.metadata.updatedAt = new Date();
      await this.dataLayer.firestoreSet('users', user.id, user);

      res.json(this.sanitizeUser(user));
    } catch (error) {
      logger.error('Update user error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleDeleteUser(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const user = await this.getUserById(id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Soft delete
      await this.dataLayer.firestoreSet('users', id, null);
      
      // Revoke all sessions
      // Implementation needed

      res.status(204).end();
    } catch (error) {
      logger.error('Delete user error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleAssignRoles(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const { roles } = req.body;
      
      const user = await this.getUserById(id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      user.roles = roles;
      user.metadata.updatedAt = new Date();
      await this.dataLayer.firestoreSet('users', user.id, user);

      res.json(this.sanitizeUser(user));
    } catch (error) {
      logger.error('Assign roles error', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Service lifecycle
  async start(port: number = 3001): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        logger.info(`Auth service started on port ${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await this.redis.quit();
    await this.dataLayer.close();
  }
}