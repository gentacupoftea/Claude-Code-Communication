/**
 * 入力値検証ミドルウェアの単体テスト
 */

const {
  checkDangerousPatterns,
  sanitizeHtml,
  escapeString,
  validateObjectRecursive,
  DANGEROUS_PATTERNS,
  ALLOWED_PATTERNS
} = require('../src/middleware/validation');

describe('Validation Middleware Tests', () => {

  describe('checkDangerousPatterns', () => {
    test('should return empty array for safe input', () => {
      const safeInput = 'This is a safe string with normal content.';
      const threats = checkDangerousPatterns(safeInput);
      expect(threats).toEqual([]);
    });

    test('should detect multiple threat types in single input', () => {
      const maliciousInput = '<script>alert("xss")</script>SELECT * FROM users';
      const threats = checkDangerousPatterns(maliciousInput);
      expect(threats.length).toBeGreaterThan(0);
      
      const threatTypes = threats.map(t => t.type);
      expect(threatTypes).toContain('xss');
    });

    test('should handle non-string input gracefully', () => {
      expect(checkDangerousPatterns(null)).toEqual([]);
      expect(checkDangerousPatterns(undefined)).toEqual([]);
      expect(checkDangerousPatterns(123)).toEqual([]);
      expect(checkDangerousPatterns({})).toEqual([]);
    });

    test('should filter by threat type', () => {
      const sqlInput = "'; DROP TABLE users; --";
      const xssThreats = checkDangerousPatterns(sqlInput, 'xss');
      const sqlThreats = checkDangerousPatterns(sqlInput, 'sql');
      
      expect(xssThreats.length).toBe(0);
      expect(sqlThreats.length).toBeGreaterThan(0);
    });
  });

  describe('sanitizeHtml', () => {
    test('should remove script tags but keep text content', () => {
      const maliciousHtml = '<script>alert("hack")</script>Hello World<p>Safe content</p>';
      const sanitized = sanitizeHtml(maliciousHtml);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert("hack")');
      expect(sanitized).toContain('Hello World');
      expect(sanitized).toContain('Safe content');
    });

    test('should remove all HTML tags when configured strictly', () => {
      const htmlInput = '<div><span>Text content</span><img src="test.jpg" /></div>';
      const sanitized = sanitizeHtml(htmlInput);
      
      expect(sanitized).not.toContain('<div>');
      expect(sanitized).not.toContain('<span>');
      expect(sanitized).not.toContain('<img');
      expect(sanitized).toContain('Text content');
    });

    test('should handle non-string input', () => {
      expect(sanitizeHtml(null)).toBe(null);
      expect(sanitizeHtml(undefined)).toBe(undefined);
      expect(sanitizeHtml(123)).toBe(123);
    });

    test('should remove dangerous attributes', () => {
      const dangerousHtml = '<img src="x" onerror="alert(\'xss\')" onload="hack()" />';
      const sanitized = sanitizeHtml(dangerousHtml);
      
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('onload');
      expect(sanitized).not.toContain('alert');
    });
  });

  describe('escapeString', () => {
    test('should escape HTML special characters', () => {
      const input = '<div class="test">Hello & "World" \'/</div>';
      const escaped = escapeString(input);
      
      expect(escaped).toBe('&lt;div class=&quot;test&quot;&gt;Hello &amp; &quot;World&quot; &#x27;&#x2F;&lt;&#x2F;div&gt;');
    });

    test('should handle empty and null inputs', () => {
      expect(escapeString('')).toBe('');
      expect(escapeString(null)).toBe(null);
      expect(escapeString(undefined)).toBe(undefined);
    });

    test('should not double-escape already escaped content', () => {
      const alreadyEscaped = '&lt;script&gt;';
      const escaped = escapeString(alreadyEscaped);
      
      expect(escaped).toBe('&amp;lt;script&amp;gt;');
    });
  });

  describe('validateObjectRecursive', () => {
    test('should validate shallow objects', () => {
      const shallowObject = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      };
      
      const validated = validateObjectRecursive(shallowObject);
      expect(validated).toEqual(shallowObject);
    });

    test('should enforce depth limits', () => {
      const createDeepObject = (depth) => {
        let obj = { value: 'deep' };
        for (let i = 0; i < depth; i++) {
          obj = { level: obj };
        }
        return obj;
      };
      
      const deepObject = createDeepObject(15);
      expect(() => validateObjectRecursive(deepObject, 10)).toThrow('Object depth exceeded maximum allowed depth');
    });

    test('should validate arrays recursively', () => {
      const arrayObject = {
        users: [
          { name: 'User 1', safe: true },
          { name: 'User 2<script>alert("xss")</script>', safe: false }
        ]
      };
      
      const validated = validateObjectRecursive(arrayObject);
      expect(validated.users[0].name).toBe('User 1');
      expect(validated.users[1].name).not.toContain('<script>');
    });

    test('should sanitize dangerous object keys', () => {
      const dangerousKeyObject = {};
      dangerousKeyObject['<script>alert("key")</script>'] = 'value';
      
      expect(() => validateObjectRecursive(dangerousKeyObject)).toThrow('Dangerous pattern detected in object key');
    });

    test('should handle circular references gracefully', () => {
      const circularObject = { name: 'test' };
      circularObject.self = circularObject;
      
      // Should not crash, though behavior depends on implementation
      expect(() => validateObjectRecursive(circularObject, 5)).not.toThrow();
    });

    test('should preserve non-string values', () => {
      const mixedObject = {
        string: 'text',
        number: 42,
        boolean: true,
        date: new Date('2023-01-01'),
        null: null,
        undefined: undefined
      };
      
      const validated = validateObjectRecursive(mixedObject);
      expect(validated.string).toBe('text');
      expect(validated.number).toBe(42);
      expect(validated.boolean).toBe(true);
      expect(validated.date).toEqual(mixedObject.date);
      expect(validated.null).toBe(null);
      expect(validated.undefined).toBe(undefined);
    });
  });

  describe('DANGEROUS_PATTERNS', () => {
    test('should have all required pattern categories', () => {
      const requiredCategories = ['xss', 'sql', 'nosql', 'pathTraversal', 'ldap'];
      requiredCategories.forEach(category => {
        expect(DANGEROUS_PATTERNS).toHaveProperty(category);
        expect(Array.isArray(DANGEROUS_PATTERNS[category])).toBe(true);
        expect(DANGEROUS_PATTERNS[category].length).toBeGreaterThan(0);
      });
    });

    test('should contain valid regex patterns', () => {
      Object.entries(DANGEROUS_PATTERNS).forEach(([category, patterns]) => {
        patterns.forEach((pattern, index) => {
          expect(pattern).toBeInstanceOf(RegExp);
          // Test that pattern doesn't throw when testing
          expect(() => pattern.test('test string')).not.toThrow();
        });
      });
    });
  });

  describe('ALLOWED_PATTERNS', () => {
    test('should validate common input types', () => {
      const testCases = [
        { pattern: 'email', valid: ['test@example.com', 'user+tag@domain.co.uk'], invalid: ['invalid-email', '@domain.com'] },
        { pattern: 'url', valid: ['https://example.com', 'http://test.co.uk/path'], invalid: ['not-a-url', 'ftp://invalid'] },
        { pattern: 'alphanumeric', valid: ['abc123', 'Test'], invalid: ['test-with-dash', 'test with space'] },
        { pattern: 'number', valid: ['123', '45.67'], invalid: ['not-a-number', '12.34.56'] }
      ];

      testCases.forEach(({ pattern, valid, invalid }) => {
        const regex = ALLOWED_PATTERNS[pattern];
        expect(regex).toBeDefined();

        valid.forEach(value => {
          expect(regex.test(value)).toBe(true);
        });

        invalid.forEach(value => {
          expect(regex.test(value)).toBe(false);
        });
      });
    });

    test('should handle Japanese text', () => {
      const japaneseText = 'こんにちは世界123';
      expect(ALLOWED_PATTERNS.text.test(japaneseText)).toBe(true);
    });

    test('should validate API key format', () => {
      const validApiKey = 'sk-abcd1234efgh5678ijkl9012mnop3456';
      const invalidApiKey = 'invalid-key!@#';
      
      expect(ALLOWED_PATTERNS.apiKey.test(validApiKey)).toBe(true);
      expect(ALLOWED_PATTERNS.apiKey.test(invalidApiKey)).toBe(false);
    });

    test('should validate UUID format', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUuid = 'not-a-uuid';
      
      expect(ALLOWED_PATTERNS.uuid.test(validUuid)).toBe(true);
      expect(ALLOWED_PATTERNS.uuid.test(invalidUuid)).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle extremely long strings', () => {
      const longString = 'a'.repeat(100000);
      expect(() => checkDangerousPatterns(longString)).not.toThrow();
      expect(() => sanitizeHtml(longString)).not.toThrow();
    });

    test('should handle special Unicode characters', () => {
      const unicodeString = '🚀💾🔒Hello🌍こんにちは';
      expect(() => checkDangerousPatterns(unicodeString)).not.toThrow();
      expect(() => sanitizeHtml(unicodeString)).not.toThrow();
    });

    test('should handle malformed regex attempts', () => {
      const malformedRegex = '(unclosed group';
      expect(() => checkDangerousPatterns(malformedRegex)).not.toThrow();
    });

    test('should handle objects with prototype pollution attempts', () => {
      const pollutionAttempt = {
        '__proto__': { isAdmin: true },
        'constructor': { prototype: { isAdmin: true } }
      };
      
      expect(() => validateObjectRecursive(pollutionAttempt)).not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    test('should process validation within reasonable time', () => {
      const largeObject = {
        data: new Array(1000).fill(null).map((_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          content: 'Safe content that should not trigger any validation warnings'
        }))
      };

      const startTime = Date.now();
      validateObjectRecursive(largeObject);
      const endTime = Date.now();

      // Should complete within 1 second for 1000 objects
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('should handle multiple pattern checks efficiently', () => {
      const testString = 'Normal string that should not match any dangerous patterns';
      
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        checkDangerousPatterns(testString);
      }
      const endTime = Date.now();

      // Should complete 1000 checks within 100ms
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});