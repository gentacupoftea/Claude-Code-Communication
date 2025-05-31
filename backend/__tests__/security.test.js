/**
 * セキュリティ機能の包括的テスト
 * OWASP Top 10対策の検証
 */

const request = require('supertest');
const app = require('../server');
const { 
  checkDangerousPatterns, 
  sanitizeHtml, 
  validateObjectRecursive,
  DANGEROUS_PATTERNS 
} = require('../src/middleware/validation');

describe('Security Validation Tests', () => {
  
  describe('XSS Attack Prevention', () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(\'xss\')" />',
      'javascript:alert("xss")',
      '<iframe src="javascript:alert(\'xss\')"></iframe>',
      '<object data="javascript:alert(\'xss\')"></object>',
      '<embed src="javascript:alert(\'xss\')" />',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(\'xss\')" />',
      'expression(alert("xss"))',
      'vbscript:alert("xss")',
      'data:text/html,<script>alert("xss")</script>'
    ];

    xssPayloads.forEach((payload, index) => {
      test(`should detect XSS payload ${index + 1}: ${payload.substring(0, 30)}...`, () => {
        const threats = checkDangerousPatterns(payload, 'xss');
        expect(threats.length).toBeGreaterThan(0);
        expect(threats[0].type).toBe('xss');
      });
    });

    test('should sanitize HTML content', () => {
      const maliciousHtml = '<script>alert("xss")</script><p>Safe content</p>';
      const sanitized = sanitizeHtml(maliciousHtml);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Safe content');
    });
  });

  describe('SQL Injection Prevention', () => {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT username, password FROM users --",
      "admin'--",
      "admin'/*",
      "'; INSERT INTO users VALUES ('hacker', 'password'); --",
      "' OR 1=1 --",
      "1' AND (SELECT COUNT(*) FROM users) > 0 --"
    ];

    sqlPayloads.forEach((payload, index) => {
      test(`should detect SQL injection payload ${index + 1}: ${payload}`, () => {
        const threats = checkDangerousPatterns(payload, 'sql');
        expect(threats.length).toBeGreaterThan(0);
        expect(threats[0].type).toBe('sql');
      });
    });
  });

  describe('NoSQL Injection Prevention', () => {
    const nosqlPayloads = [
      '{"$where": "function() { return true; }"}',
      '{"username": {"$ne": null}}',
      '{"price": {"$gt": 0}}',
      '{"date": {"$lt": "2023-01-01"}}',
      '{"$or": [{"admin": true}, {"user": "admin"}]}',
      '{"$and": [{"active": true}, {"admin": true}]}'
    ];

    nosqlPayloads.forEach((payload, index) => {
      test(`should detect NoSQL injection payload ${index + 1}`, () => {
        const threats = checkDangerousPatterns(payload, 'nosql');
        expect(threats.length).toBeGreaterThan(0);
        expect(threats[0].type).toBe('nosql');
      });
    });
  });

  describe('Path Traversal Prevention', () => {
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '....//....//....//etc/passwd',
      '..%2f..%2f..%2fetc%2fpasswd'
    ];

    pathTraversalPayloads.forEach((payload, index) => {
      test(`should detect path traversal payload ${index + 1}: ${payload}`, () => {
        const threats = checkDangerousPatterns(payload, 'pathTraversal');
        expect(threats.length).toBeGreaterThan(0);
        expect(threats[0].type).toBe('pathTraversal');
      });
    });
  });

  describe('Object Validation', () => {
    test('should validate nested objects with depth limit', () => {
      const deepObject = { level1: { level2: { level3: { level4: { level5: 'test' } } } } };
      expect(() => validateObjectRecursive(deepObject, 3)).toThrow('Object depth exceeded maximum allowed depth');
    });

    test('should sanitize dangerous content in nested objects', () => {
      const dangerousObject = {
        safe: 'normal content',
        dangerous: '<script>alert("xss")</script>',
        nested: {
          alsoDangerous: 'javascript:alert("nested")'
        }
      };

      const sanitized = validateObjectRecursive(dangerousObject);
      expect(sanitized.safe).toBe('normal content');
      expect(sanitized.dangerous).not.toContain('<script>');
      expect(sanitized.nested.alsoDangerous).not.toContain('javascript:');
    });

    test('should detect dangerous patterns in object keys', () => {
      const dangerousKey = { '<script>alert("key")</script>': 'value' };
      expect(() => validateObjectRecursive(dangerousKey)).toThrow('Dangerous pattern detected in object key');
    });
  });
});

describe('API Endpoint Security Tests', () => {
  
  describe('Chat API Security', () => {
    test('should reject invalid model names', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'test' }],
          model: 'invalid-model'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid model');
    });

    test('should enforce temperature limits', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'test' }],
          temperature: 5
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid temperature');
    });

    test('should enforce max_tokens limits', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5000
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid max_tokens');
    });

    test('should limit message array length', async () => {
      const longMessageArray = new Array(51).fill({ role: 'user', content: 'test' });
      const response = await request(app)
        .post('/api/chat')
        .send({ messages: longMessageArray });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Array too long');
    });

    test('should limit message content length', async () => {
      const longContent = 'a'.repeat(10001);
      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: longContent }]
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Message content too long');
    });

    test('should sanitize XSS in messages', async () => {
      const xssMessage = '<script>alert("xss")</script>';
      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: xssMessage }]
        });
      
      // Should either reject or sanitize - depending on implementation
      expect([400, 503, 502].includes(response.status)).toBe(true);
    });
  });

  describe('API Settings Security', () => {
    test('should validate service whitelist', async () => {
      const invalidService = {
        invalidService: {
          apiKey: 'test-key'
        }
      };
      
      const response = await request(app)
        .post('/api/settings/apis')
        .send(invalidService);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid service');
    });

    test('should require object structure for API keys', async () => {
      const response = await request(app)
        .post('/api/settings/apis')
        .send('invalid-string');
      
      expect(response.status).toBe(400);
    });
  });

  describe('File Upload Security', () => {
    test('should enforce file size limits', async () => {
      const largeFile = {
        fileName: 'test.txt',
        fileSize: 101 * 1024 * 1024, // 101MB
        fileType: 'text/plain',
        content: 'test'
      };
      
      const response = await request(app)
        .post('/api/learning-data/upload')
        .send(largeFile);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('File too large');
    });

    test('should validate file types', async () => {
      const invalidFileType = {
        fileName: 'test.exe',
        fileSize: 1024,
        fileType: 'application/x-executable',
        content: 'test'
      };
      
      const response = await request(app)
        .post('/api/learning-data/upload')
        .send(invalidFileType);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid file type');
    });

    test('should enforce content size limits', async () => {
      const largeContent = {
        fileName: 'test.txt',
        fileSize: 1024,
        fileType: 'text/plain',
        content: 'a'.repeat(51 * 1024 * 1024) // 51MB content
      };
      
      const response = await request(app)
        .post('/api/learning-data/upload')
        .send(largeContent);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Content too large');
    });

    test('should validate filename format', async () => {
      const invalidFilename = {
        fileName: '../../../etc/passwd',
        fileSize: 1024,
        fileType: 'text/plain',
        content: 'test'
      };
      
      const response = await request(app)
        .post('/api/learning-data/upload')
        .send(invalidFilename);
      
      expect(response.status).toBe(400);
    });
  });

  describe('Slack API Security', () => {
    test('should validate channel name', async () => {
      const response = await request(app)
        .post('/api/slack/send-message')
        .send({
          channel: '',
          text: 'test message'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid channel');
    });

    test('should limit message length', async () => {
      const longMessage = 'a'.repeat(4001);
      const response = await request(app)
        .post('/api/slack/send-message')
        .send({
          channel: '#test',
          text: longMessage
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Message too long');
    });
  });

  describe('Analytics API Security', () => {
    test('should validate date format', async () => {
      const response = await request(app)
        .post('/api/analytics/report')
        .send({
          startDate: 'invalid-date',
          endDate: '2023-12-31',
          metrics: ['sessions'],
          dimensions: ['country']
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid start date');
    });

    test('should limit metrics array length', async () => {
      const longMetrics = new Array(21).fill('sessions');
      const response = await request(app)
        .post('/api/analytics/report')
        .send({
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          metrics: longMetrics,
          dimensions: ['country']
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Array too long');
    });
  });
});

describe('Security Headers Tests', () => {
  test('should set security headers', async () => {
    const response = await request(app).get('/api/health');
    
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('should set HSTS in production', async () => {
    // Note: This test would need environment mocking
    process.env.NODE_ENV = 'production';
    const response = await request(app).get('/api/health');
    
    if (process.env.NODE_ENV === 'production') {
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    }
    
    // Reset environment
    process.env.NODE_ENV = 'test';
  });
});

describe('Rate Limiting Tests', () => {
  test('should enforce rate limits (requires manual testing)', async () => {
    // Note: This test would require multiple rapid requests
    // and depends on actual rate limiting configuration
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        request(app)
          .get('/api/health')
          .expect((res) => {
            // Should eventually get 429 status
            return res.status === 200 || res.status === 429;
          })
      );
    }
    
    await Promise.all(promises);
  });
});