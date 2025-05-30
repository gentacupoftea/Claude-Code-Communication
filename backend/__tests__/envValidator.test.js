/**
 * 環境変数検証システムのテスト
 */

const {
  validateEnvironment,
  validateAndLog,
  getEnvironmentHealth,
  REQUIRED_ENV_VARS,
  ENV_PATTERNS
} = require('../src/config/envValidator');

describe('Environment Validator Tests', () => {
  
  // 元の環境変数を保存
  const originalEnv = process.env;
  
  beforeEach(() => {
    // 各テストで環境変数をリセット
    process.env = { ...originalEnv };
  });
  
  afterAll(() => {
    // テスト後に元の環境変数を復元
    process.env = originalEnv;
  });

  describe('validateEnvironment', () => {
    
    test('should validate development environment with minimal requirements', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      
      const results = validateEnvironment('development');
      
      expect(results.valid).toBe(true);
      expect(results.errors).toEqual([]);
      expect(results.missing).toEqual([]);
    });

    test('should validate production environment with all requirements', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8000';
      process.env.JWT_SECRET = 'a-very-long-and-secure-jwt-secret-key-that-meets-minimum-requirements';
      process.env.CORS_ORIGIN = 'https://example.com';
      
      const results = validateEnvironment('production');
      
      expect(results.valid).toBe(true);
      expect(results.errors).toEqual([]);
      expect(results.missing).toEqual([]);
    });

    test('should fail production validation with missing required variables', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8000';
      // Missing JWT_SECRET and CORS_ORIGIN
      
      const results = validateEnvironment('production');
      
      expect(results.valid).toBe(false);
      expect(results.missing).toContain('JWT_SECRET');
      expect(results.missing).toContain('CORS_ORIGIN');
      expect(results.errors.length).toBeGreaterThan(0);
    });

    test('should validate staging environment requirements', () => {
      process.env.NODE_ENV = 'staging';
      process.env.PORT = '8000';
      process.env.JWT_SECRET = 'staging-jwt-secret-that-is-long-enough-for-security';
      
      const results = validateEnvironment('staging');
      
      expect(results.valid).toBe(true);
      expect(results.errors).toEqual([]);
    });
  });

  describe('Pattern Validation', () => {
    
    test('should validate PORT format', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = 'invalid-port';
      
      const results = validateEnvironment();
      
      expect(results.valid).toBe(false);
      expect(results.invalid).toContain('PORT');
    });

    test('should validate JWT_SECRET length', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8000';
      process.env.JWT_SECRET = 'short'; // Less than 32 characters
      process.env.CORS_ORIGIN = 'https://example.com';
      
      const results = validateEnvironment('production');
      
      expect(results.valid).toBe(false);
      expect(results.invalid).toContain('JWT_SECRET');
    });

    test('should validate API key formats', () => {
      const testCases = [
        { var: 'ANTHROPIC_API_KEY', valid: 'sk-ant-api03-abcd1234', invalid: 'invalid-key' },
        { var: 'OPENAI_API_KEY', valid: 'sk-abcd1234efgh5678', invalid: 'invalid-key' },
        { var: 'SHOPIFY_API_KEY', valid: 'abcd1234efgh5678ijkl9012mnop3456', invalid: 'invalid-key' },
        { var: 'SHOPIFY_ACCESS_TOKEN', valid: 'shpat_abcd1234efgh5678ijkl9012mnop3456', invalid: 'invalid-token' }
      ];

      testCases.forEach(({ var: varName, valid, invalid }) => {
        // Test valid format
        process.env.NODE_ENV = 'production';
        process.env.PORT = '8000';
        process.env.JWT_SECRET = 'long-enough-jwt-secret-for-production-use-case';
        process.env.CORS_ORIGIN = 'https://example.com';
        process.env[varName] = valid;
        
        let results = validateEnvironment('production');
        expect(results.invalid).not.toContain(varName);
        
        // Test invalid format in production (should fail)
        process.env[varName] = invalid;
        results = validateEnvironment('production');
        expect(results.invalid).toContain(varName);
        
        // Test invalid format in development (should warn but not fail)
        results = validateEnvironment('development');
        expect(results.warnings.some(w => w.includes(varName))).toBe(true);
      });
    });

    test('should validate database URLs', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      
      // Valid Redis URL
      process.env.REDIS_URL = 'redis://localhost:6379';
      let results = validateEnvironment();
      expect(results.invalid).not.toContain('REDIS_URL');
      
      // Valid PostgreSQL URL
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      results = validateEnvironment();
      expect(results.invalid).not.toContain('DATABASE_URL');
      
      // Invalid URLs
      process.env.REDIS_URL = 'invalid-url';
      process.env.DATABASE_URL = 'not-a-database-url';
      results = validateEnvironment();
      expect(results.invalid).toContain('REDIS_URL');
      expect(results.invalid).toContain('DATABASE_URL');
    });
  });

  describe('Security Warnings', () => {
    
    test('should warn about default JWT secret', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.JWT_SECRET = 'your_jwt_secret_here';
      
      const results = validateEnvironment();
      
      expect(results.warnings.some(w => w.includes('JWT_SECRET'))).toBe(true);
    });

    test('should fail production with default values', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8000';
      process.env.JWT_SECRET = 'your_jwt_secret_here';
      process.env.CORS_ORIGIN = 'https://example.com';
      
      const results = validateEnvironment('production');
      
      expect(results.valid).toBe(false);
      expect(results.errors.some(e => e.includes('JWT_SECRET'))).toBe(true);
    });

    test('should warn about wildcard CORS in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8000';
      process.env.JWT_SECRET = 'production-ready-jwt-secret-that-is-very-long-and-secure';
      process.env.CORS_ORIGIN = '*';
      
      const results = validateEnvironment('production');
      
      expect(results.valid).toBe(false);
      expect(results.errors.some(e => e.includes('CORS_ORIGIN'))).toBe(true);
    });

    test('should warn about insecure API keys', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.ANTHROPIC_API_KEY = 'your_anthropic_api_key_here';
      process.env.OPENAI_API_KEY = 'your_openai_api_key_here';
      
      const results = validateEnvironment();
      
      expect(results.warnings.some(w => w.includes('ANTHROPIC_API_KEY'))).toBe(true);
      expect(results.warnings.some(w => w.includes('OPENAI_API_KEY'))).toBe(true);
    });
  });

  describe('Production-specific Validations', () => {
    
    test('should warn about HTTP CORS origin in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8000';
      process.env.JWT_SECRET = 'production-ready-jwt-secret-with-sufficient-length';
      process.env.CORS_ORIGIN = 'http://insecure-site.com';
      
      const results = validateEnvironment('production');
      
      expect(results.warnings.some(w => w.includes('HTTPS'))).toBe(true);
    });

    test('should warn about non-SSL Redis in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8000';
      process.env.JWT_SECRET = 'production-ready-jwt-secret-with-sufficient-length';
      process.env.CORS_ORIGIN = 'https://secure-site.com';
      process.env.REDIS_URL = 'redis://insecure-redis:6379';
      
      const results = validateEnvironment('production');
      
      expect(results.warnings.some(w => w.includes('SSL'))).toBe(true);
    });
  });

  describe('validateAndLog', () => {
    
    test('should return validation results', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      
      // Mock console to capture logs
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const results = validateAndLog();
      
      expect(results).toBeDefined();
      expect(results.valid).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('should log validation failures', () => {
      process.env.NODE_ENV = 'production';
      // Missing required variables
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const results = validateAndLog();
      
      expect(results.valid).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getEnvironmentHealth', () => {
    
    test('should return health status for valid environment', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      
      const health = getEnvironmentHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.environment).toBe('development');
      expect(health.missingVariables).toBe(0);
      expect(health.invalidVariables).toBe(0);
      expect(health.details).toBeDefined();
    });

    test('should return unhealthy status for invalid environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = 'invalid';
      // Missing required variables
      
      const health = getEnvironmentHealth();
      
      expect(health.status).toBe('unhealthy');
      expect(health.missingVariables).toBeGreaterThan(0);
      expect(health.invalidVariables).toBeGreaterThan(0);
    });

    test('should include detailed error information', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8000';
      // Missing JWT_SECRET and CORS_ORIGIN
      
      const health = getEnvironmentHealth();
      
      expect(health.details.missing).toContain('JWT_SECRET');
      expect(health.details.missing).toContain('CORS_ORIGIN');
      expect(Array.isArray(health.details.invalid)).toBe(true);
      expect(Array.isArray(health.details.warnings)).toBe(true);
    });
  });

  describe('REQUIRED_ENV_VARS Configuration', () => {
    
    test('should have different requirements for each environment', () => {
      expect(REQUIRED_ENV_VARS.development).toBeDefined();
      expect(REQUIRED_ENV_VARS.production).toBeDefined();
      expect(REQUIRED_ENV_VARS.staging).toBeDefined();
      
      expect(REQUIRED_ENV_VARS.production.length).toBeGreaterThan(REQUIRED_ENV_VARS.development.length);
      expect(REQUIRED_ENV_VARS.production).toContain('JWT_SECRET');
      expect(REQUIRED_ENV_VARS.production).toContain('CORS_ORIGIN');
    });
  });

  describe('ENV_PATTERNS Configuration', () => {
    
    test('should contain valid regex patterns', () => {
      Object.entries(ENV_PATTERNS).forEach(([varName, pattern]) => {
        expect(pattern).toBeInstanceOf(RegExp);
        expect(() => pattern.test('test')).not.toThrow();
      });
    });

    test('should validate common environment variable formats', () => {
      expect(ENV_PATTERNS.PORT.test('3000')).toBe(true);
      expect(ENV_PATTERNS.PORT.test('invalid')).toBe(false);
      
      expect(ENV_PATTERNS.NODE_ENV.test('development')).toBe(true);
      expect(ENV_PATTERNS.NODE_ENV.test('production')).toBe(true);
      expect(ENV_PATTERNS.NODE_ENV.test('invalid')).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    
    test('should handle undefined environment gracefully', () => {
      delete process.env.NODE_ENV;
      
      expect(() => validateEnvironment()).not.toThrow();
      expect(() => getEnvironmentHealth()).not.toThrow();
    });

    test('should handle empty environment variables', () => {
      process.env.NODE_ENV = '';
      process.env.PORT = '';
      
      const results = validateEnvironment();
      expect(results).toBeDefined();
    });

    test('should handle very long environment variables', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.VERY_LONG_VAR = 'a'.repeat(10000);
      
      expect(() => validateEnvironment()).not.toThrow();
    });

    test('should handle special characters in environment variables', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      expect(() => validateEnvironment()).not.toThrow();
    });
  });
});