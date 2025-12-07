import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatNumber, truncate, slugify } from '@/lib/utils';

describe('Utils', () => {
  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0)).toBe('$0.00');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1234567)).toBe('1,234,567');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('Hello World', 5)).toBe('Hello...');
      expect(truncate('Short', 10)).toBe('Short');
    });
  });

  describe('slugify', () => {
    it('should convert strings to slugs', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('Test String 123')).toBe('test-string-123');
      expect(slugify('Special!@#$%Characters')).toBe('specialcharacters');
    });
  });
});
