export interface User {
  id: string;
  email: string;
  role: 'admin' | 'customer';
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials extends LoginCredentials {
  role?: 'admin' | 'customer';
}

export interface VendingMachine {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'maintenance';
  inventory_count: number;
  last_sync: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url?: string;
  vending_machine_id: string;
}

export interface Transaction {
  id: string;
  product_id: string;
  user_id: string;
  vending_machine_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}
