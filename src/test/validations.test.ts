import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  loginSchema,
  signupSchema,
  createVendingMachineSchema,
  createProductSchema,
  createTransactionSchema,
} from '@/lib/validations';

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
      };
      expect(() => loginSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'password123',
      };
      expect(() => loginSchema.parse(invalidData)).toThrow();
    });

    it('should reject short password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'short',
      };
      expect(() => loginSchema.parse(invalidData)).toThrow();
    });
  });

  describe('signupSchema', () => {
    it('should validate correct signup data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        full_name: 'John Doe',
      };
      expect(() => signupSchema.parse(validData)).not.toThrow();
    });

    it('should reject short name', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
        full_name: 'J',
      };
      expect(() => signupSchema.parse(invalidData)).toThrow();
    });
  });

  describe('createVendingMachineSchema', () => {
    it('should validate correct vending machine data', () => {
      const validData = {
        name: 'Machine 1',
        location: 'Building A',
        latitude: 40.7128,
        longitude: -74.0060,
      };
      expect(() => createVendingMachineSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid coordinates', () => {
      const invalidData = {
        name: 'Machine 1',
        location: 'Building A',
        latitude: 100, // Invalid: > 90
        longitude: -74.0060,
      };
      expect(() => createVendingMachineSchema.parse(invalidData)).toThrow();
    });
  });

  describe('createProductSchema', () => {
    it('should validate correct product data', () => {
      const validData = {
        vending_machine_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Coca Cola',
        price: 2.50,
        stock: 10,
        max_stock: 20,
      };
      expect(() => createProductSchema.parse(validData)).not.toThrow();
    });

    it('should reject negative price', () => {
      const invalidData = {
        vending_machine_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Coca Cola',
        price: -2.50,
        stock: 10,
        max_stock: 20,
      };
      expect(() => createProductSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative stock', () => {
      const invalidData = {
        vending_machine_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Coca Cola',
        price: 2.50,
        stock: -10,
        max_stock: 20,
      };
      expect(() => createProductSchema.parse(invalidData)).toThrow();
    });
  });

  describe('createTransactionSchema', () => {
    it('should validate correct transaction data', () => {
      const validData = {
        product_id: '123e4567-e89b-12d3-a456-426614174000',
        vending_machine_id: '123e4567-e89b-12d3-a456-426614174001',
        quantity: 2,
      };
      expect(() => createTransactionSchema.parse(validData)).not.toThrow();
    });

    it('should use default quantity of 1', () => {
      const data = {
        product_id: '123e4567-e89b-12d3-a456-426614174000',
        vending_machine_id: '123e4567-e89b-12d3-a456-426614174001',
      };
      const result = createTransactionSchema.parse(data);
      expect(result.quantity).toBe(1);
    });
  });
});
