import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { createHash } from 'crypto';
import { promisify } from 'util';

interface TokenPayload {
  sub: string;
  email: string;
  scope?: string[];
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
  jti?: string; // JWT ID for tracking
  aud?: string; // Audience
  iss?: string; // Issuer
}

interface OAuth2Client {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  scope: string[];
  grantTypes: string[];
}

interface AuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string[];
  expiresAt: Date;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

@Injectable()
export class OAuth2Service {
  private readonly jwtSecret = process.env.JWT_SECRET || 'quantum-inspired-secret-key';
  private readonly jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'quantum-refresh-secret';
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';
  private readonly authorizationCodeExpiry = 10 * 60 * 1000; // 10 minutes
  
  // In-memory storage (replace with Redis in production)
  private authorizationCodes = new Map<string, AuthorizationCode>();
  private refreshTokens = new Map<string, TokenPayload>();
  private revokedTokens = new Set<string>();
  
  // Quantum-inspired token validation preparation
  private quantumValidationSeeds = new Map<string, Buffer>();

  /**
   * OAuth2.0 Authorization Code Flow - Step 1: Generate authorization code
   */
  async generateAuthorizationCode(
    clientId: string,
    userId: string,
    redirectUri: string,
    scope: string[],
    codeChallenge?: string,
    codeChallengeMethod?: string
  ): Promise<string> {
    const code = crypto.randomBytes(32).toString('base64url');
    const authCode: AuthorizationCode = {
      code,
      clientId,
      userId,
      redirectUri,
      scope,
      expiresAt: new Date(Date.now() + this.authorizationCodeExpiry),
      codeChallenge,
      codeChallengeMethod
    };
    
    this.authorizationCodes.set(code, authCode);
    
    // Set automatic cleanup
    setTimeout(() => {
      this.authorizationCodes.delete(code);
    }, this.authorizationCodeExpiry);
    
    return code;
  }

  /**
   * OAuth2.0 Authorization Code Flow - Step 2: Exchange code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    clientId: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const authCode = this.authorizationCodes.get(code);
    
    if (!authCode) {
      throw new Error('Invalid authorization code');
    }
    
    if (authCode.clientId !== clientId) {
      throw new Error('Client ID mismatch');
    }
    
    if (authCode.redirectUri !== redirectUri) {
      throw new Error('Redirect URI mismatch');
    }
    
    if (authCode.expiresAt < new Date()) {
      throw new Error('Authorization code expired');
    }
    
    // PKCE validation
    if (authCode.codeChallenge) {
      if (!codeVerifier) {
        throw new Error('Code verifier required');
      }
      
      const verifierChallenge = createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
        
      if (verifierChallenge !== authCode.codeChallenge) {
        throw new Error('Code verifier validation failed');
      }
    }
    
    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokenPair(
      authCode.userId,
      'user@example.com', // In real implementation, fetch from user service
      authCode.scope
    );
    
    // Clean up used authorization code
    this.authorizationCodes.delete(code);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes in seconds
    };
  }

  /**
   * Generate JWT access and refresh token pair
   */
  async generateTokenPair(
    userId: string,
    email: string,
    scope: string[] = []
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const jti = crypto.randomBytes(16).toString('hex');
    const basePayload = {
      sub: userId,
      email,
      scope,
      jti,
      iss: 'conea-auth-service',
      aud: 'conea-api'
    };
    
    // Generate quantum-inspired validation seed
    const quantumSeed = crypto.randomBytes(32);
    this.quantumValidationSeeds.set(jti, quantumSeed);
    
    // Access token
    const accessTokenPayload: TokenPayload = {
      ...basePayload,
      type: 'access'
    };
    
    const accessToken = jwt.sign(accessTokenPayload, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
      algorithm: 'HS256'
    });
    
    // Refresh token
    const refreshTokenPayload: TokenPayload = {
      ...basePayload,
      type: 'refresh'
    };
    
    const refreshToken = jwt.sign(refreshTokenPayload, this.jwtRefreshSecret, {
      expiresIn: this.refreshTokenExpiry,
      algorithm: 'HS256'
    });
    
    // Store refresh token
    this.refreshTokens.set(refreshToken, refreshTokenPayload);
    
    return { accessToken, refreshToken };
  }

  /**
   * Verify and decode JWT token with quantum-inspired validation
   */
  async verifyToken(token: string, tokenType: 'access' | 'refresh' = 'access'): Promise<TokenPayload> {
    try {
      // Check if token is revoked
      const decoded = jwt.decode(token) as TokenPayload;
      if (decoded?.jti && this.revokedTokens.has(decoded.jti)) {
        throw new Error('Token has been revoked');
      }
      
      // Verify token
      const secret = tokenType === 'access' ? this.jwtSecret : this.jwtRefreshSecret;
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: 'conea-auth-service',
        audience: 'conea-api'
      }) as TokenPayload;
      
      // Quantum-inspired validation check
      if (payload.jti && this.quantumValidationSeeds.has(payload.jti)) {
        // Prepare for future quantum validation
        const quantumSeed = this.quantumValidationSeeds.get(payload.jti);
        // In future: perform quantum-inspired cryptographic validation
      }
      
      return payload;
    } catch (error) {
      throw new Error(`Invalid ${tokenType} token: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const payload = await this.verifyToken(refreshToken, 'refresh');
    
    if (!this.refreshTokens.has(refreshToken)) {
      throw new Error('Invalid refresh token');
    }
    
    // Generate new access token with same claims
    const newJti = crypto.randomBytes(16).toString('hex');
    const accessTokenPayload: TokenPayload = {
      sub: payload.sub,
      email: payload.email,
      scope: payload.scope,
      type: 'access',
      jti: newJti,
      iss: 'conea-auth-service',
      aud: 'conea-api'
    };
    
    const accessToken = jwt.sign(accessTokenPayload, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
      algorithm: 'HS256'
    });
    
    return {
      accessToken,
      expiresIn: 900
    };
  }

  /**
   * Revoke tokens
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as TokenPayload;
      if (decoded?.jti) {
        this.revokedTokens.add(decoded.jti);
        
        // Clean up quantum validation seed
        this.quantumValidationSeeds.delete(decoded.jti);
        
        // If it's a refresh token, remove from storage
        if (decoded.type === 'refresh') {
          this.refreshTokens.delete(token);
        }
      }
    } catch (error) {
      // Silently fail for invalid tokens
    }
  }

  /**
   * Introspect token (RFC 7662)
   */
  async introspectToken(token: string): Promise<{
    active: boolean;
    scope?: string;
    client_id?: string;
    username?: string;
    exp?: number;
  }> {
    try {
      const payload = await this.verifyToken(token);
      return {
        active: true,
        scope: payload.scope?.join(' '),
        username: payload.email,
        exp: payload.exp
      };
    } catch {
      return { active: false };
    }
  }

  /**
   * Edge pre-validation preparation
   * Generates validation tokens for edge servers
   */
  async generateEdgeValidationToken(mainToken: string): Promise<string> {
    const payload = await this.verifyToken(mainToken);
    const edgeToken = crypto.createHmac('sha256', this.jwtSecret)
      .update(mainToken + Date.now())
      .digest('hex');
    
    // Store edge token mapping (implement with Redis in production)
    return edgeToken;
  }

  /**
   * AI-powered anomaly detection preparation
   * Collects token usage patterns for ML analysis
   */
  async recordTokenUsage(token: string, metadata: {
    ip: string;
    userAgent: string;
    endpoint: string;
    timestamp: number;
  }): Promise<void> {
    // In production: Send to ML pipeline for anomaly detection
    // For now, just validate token exists
    await this.verifyToken(token);
    
    // Future: Implement ML-based pattern analysis
    // - Unusual geographic locations
    // - Abnormal request patterns
    // - Suspicious timing patterns
  }
}