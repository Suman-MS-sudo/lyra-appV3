'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
}

interface EditProductFormProps {
  product: Product;
}

const CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #f1f5f9',
  borderRadius: 20,
};

const INPUT: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  color: '#0f172a',
  borderRadius: 12,
};

const LABEL: React.CSSProperties = { color: '#0f172a' };

export default function EditProductForm({ product }: EditProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: product.name || '',
    sku: product.sku || '',
    price: product.price?.toString() || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          sku: formData.sku,
          price: parseFloat(formData.price)
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update product');
      }

      router.push('/admin/products');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-6" style={CARD}>
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2" style={LABEL}>
          Product Name <span style={{ color: '#2563EB' }}>*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={INPUT}
          placeholder="e.g., Coca Cola"
        />
      </div>

      <div>
        <label htmlFor="sku" className="block text-sm font-medium mb-2" style={LABEL}>
          SKU <span style={{ color: '#2563EB' }}>*</span>
        </label>
        <input
          type="text"
          id="sku"
          name="sku"
          required
          value={formData.sku}
          onChange={handleChange}
          className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={INPUT}
          placeholder="e.g., SKU-001"
        />
      </div>

      <div>
        <label htmlFor="price" className="block text-sm font-medium mb-2" style={LABEL}>
          Price <span style={{ color: '#2563EB' }}>*</span>
        </label>
        <input
          type="number"
          id="price"
          name="price"
          step="0.01"
          min="0"
          required
          value={formData.price}
          onChange={handleChange}
          className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={INPUT}
          placeholder="0.00"
        />
      </div>

      <div className="flex gap-4 pt-2">
        <Link
          href="/admin/products"
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-center transition-opacity hover:opacity-80"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a' }}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)', boxShadow: '0 2px 12px rgba(37,99,235,0.35)' }}
        >
          {loading ? 'Updating...' : 'Update Product'}
        </button>
      </div>
    </form>
  );
}
