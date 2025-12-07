import { z } from 'zod';

// User schemas
export const userRoleSchema = z.enum(['admin', 'customer']);

export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: userRoleSchema,
  full_name: z.string().nullable(),
  phone: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
});

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signupSchema = loginSchema.extend({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  role: userRoleSchema.optional(),
});

// Vending machine schemas
export const machineStatusSchema = z.enum(['online', 'offline', 'maintenance']);

export const vendingMachineSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string(),
  status: machineStatusSchema,
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  last_sync: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const createVendingMachineSchema = z.object({
  name: z.string().min(3).max(100),
  location: z.string().min(3).max(200),
  status: machineStatusSchema.optional().default('offline'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  
  // Hardware fields
  machine_id: z.string().max(50).optional(),
  mac_id: z.string().max(20).optional(),
  machine_type: z.string().max(50).optional(),
  product_type: z.string().max(100).optional(),
  ip_address: z.string().max(45).optional(),
  
  // Customer fields
  customer_id: z.string().max(50).optional(),
  customer_name: z.string().max(255).optional(),
  customer_contact: z.string().max(50).optional(),
  customer_alternate_contact: z.string().max(50).optional(),
  customer_address: z.string().optional(),
  customer_location: z.string().max(255).optional(),
  
  // Maintenance fields
  purchase_date: z.string().optional(),
  warranty_till: z.string().optional(),
  amc_till: z.string().optional(),
  firmware_version: z.string().max(50).optional(),
});

export const updateVendingMachineSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  location: z.string().min(3).max(200).optional(),
  status: machineStatusSchema.optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  
  // Hardware fields
  machine_id: z.string().max(50).optional(),
  mac_id: z.string().max(20).optional(),
  machine_type: z.string().max(50).optional(),
  product_type: z.string().max(100).optional(),
  ip_address: z.string().max(45).optional(),
  
  // Customer fields
  customer_id: z.string().max(50).optional(),
  customer_name: z.string().max(255).optional(),
  customer_contact: z.string().max(50).optional(),
  customer_alternate_contact: z.string().max(50).optional(),
  customer_address: z.string().optional(),
  customer_location: z.string().max(255).optional(),
  
  // Inventory
  product_count: z.number().optional(),
  product_variety_count: z.number().optional(),
  
  // Status
  asset_online: z.boolean().optional(),
  last_ping: z.string().optional(),
  
  // Maintenance
  purchase_date: z.string().optional(),
  warranty_till: z.string().optional(),
  amc_till: z.string().optional(),
  firmware_version: z.string().max(50).optional(),
  last_firmware_update: z.string().optional(),
});

// Product schemas
export const productSchema = z.object({
  id: z.string().uuid(),
  vending_machine_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  max_stock: z.number().int().positive(),
  image_url: z.string().url().nullable(),
  sku: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const createProductSchema = z.object({
  vending_machine_id: z.string().uuid(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  max_stock: z.number().int().positive('Max stock must be positive'),
  image_url: z.string().url().optional(),
  sku: z.string().max(50).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  max_stock: z.number().int().positive().optional(),
  image_url: z.string().url().optional(),
  sku: z.string().max(50).optional(),
  is_active: z.boolean().optional(),
});

// Transaction schemas
export const transactionStatusSchema = z.enum(['pending', 'completed', 'failed', 'refunded']);

export const transactionSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  user_id: z.string().uuid(),
  vending_machine_id: z.string().uuid(),
  amount: z.number().positive(),
  quantity: z.number().int().positive(),
  status: transactionStatusSchema,
  payment_method: z.string().nullable(),
  payment_reference: z.string().nullable(),
  error_message: z.string().nullable(),
  completed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const createTransactionSchema = z.object({
  product_id: z.string().uuid(),
  vending_machine_id: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  payment_method: z.string().optional(),
});

export const updateTransactionSchema = z.object({
  status: transactionStatusSchema,
  error_message: z.string().optional(),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Query schemas
export const vendingMachineQuerySchema = paginationSchema.extend({
  status: machineStatusSchema.optional(),
  location: z.string().optional(),
});

export const productQuerySchema = paginationSchema.extend({
  vending_machine_id: z.string().uuid().optional(),
  is_active: z.coerce.boolean().optional(),
  min_price: z.coerce.number().positive().optional(),
  max_price: z.coerce.number().positive().optional(),
});

export const transactionQuerySchema = paginationSchema.extend({
  user_id: z.string().uuid().optional(),
  vending_machine_id: z.string().uuid().optional(),
  status: transactionStatusSchema.optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

// Type exports
export type UserRole = z.infer<typeof userRoleSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type SignupCredentials = z.infer<typeof signupSchema>;
export type MachineStatus = z.infer<typeof machineStatusSchema>;
export type VendingMachine = z.infer<typeof vendingMachineSchema>;
export type CreateVendingMachine = z.infer<typeof createVendingMachineSchema>;
export type UpdateVendingMachine = z.infer<typeof updateVendingMachineSchema>;
export type Product = z.infer<typeof productSchema>;
export type CreateProduct = z.infer<typeof createProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type CreateTransaction = z.infer<typeof createTransactionSchema>;
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
export type VendingMachineQuery = z.infer<typeof vendingMachineQuerySchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
