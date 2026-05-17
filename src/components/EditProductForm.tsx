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
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 20,
};

const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#f3f4f6',
  borderRadius: 12,
};

const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.70)' };

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
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', color: '#FCA5A5' }}>
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2" style={LABEL}>
          Product Name <span style={{ color: '#F472B6' }}>*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
          style={INPUT}
          placeholder="e.g., Coca Cola"
        />
      </div>

      <div>
        <label htmlFor="sku" className="block text-sm font-medium mb-2" style={LABEL}>
          SKU <span style={{ color: '#F472B6' }}>*</span>
        </label>
        <input
          type="text"
          id="sku"
          name="sku"
          required
          value={formData.sku}
          onChange={handleChange}
          className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
          style={INPUT}
          placeholder="e.g., SKU-001"
        />
      </div>

      <div>
        <label htmlFor="price" className="block text-sm font-medium mb-2" style={LABEL}>
          Price <span style={{ color: '#F472B6' }}>*</span>
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
          className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-500"
          style={INPUT}
          placeholder="0.00"
        />
      </div>

      <div className="flex gap-4 pt-2">
        <Link
          href="/admin/products"
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-center transition-opacity hover:opacity-80"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.70)' }}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 2px 12px rgba(244,63,94,0.35)' }}
        >
          {loading ? 'Updating...' : 'Update Product'}
        </button>
      </div>
    </form>
  );
}
