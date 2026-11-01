'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Organization {
  id: string;
  name: string;
}

interface NewUserFormProps {
  organizations: Organization[];
}

const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
};

const INPUT: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--line)',
  color: '#f3f4f6',
  borderRadius: 12,
};

const LABEL: React.CSSProperties = { color: 'var(--fg)' };

export default function NewUserForm({ organizations }: NewUserFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    account_type: 'customer',
    role: 'customer',
    organization_id: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          organization_id: formData.organization_id || null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create user');
      }

      router.push('/admin/users');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-6" style={CARD}>
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.04)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="rounded-xl px-4 py-3" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-soft)' }}>
        <p className="text-sm" style={{ color: 'var(--accent-ink)' }}>A password reset email will be automatically sent to the user after account creation.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2" style={LABEL}>
            Email <span style={{ color: 'var(--accent-ink)' }}>*</span>
          </label>
          <input
            type="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="user@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={LABEL}>Full Name</label>
          <input
            type="text"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="Enter full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={LABEL}>Phone</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="+91 98765 43210"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={LABEL}>
            Account Type <span style={{ color: 'var(--accent-ink)' }}>*</span>
          </label>
          <select
            name="account_type"
            value={formData.account_type}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
          >
            <option value="customer" style={{ background: 'var(--surface)' }}>Customer</option>
            <option value="super_customer" style={{ background: 'var(--surface)' }}>Super Customer</option>
            <option value="admin" style={{ background: 'var(--surface)' }}>Admin</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={LABEL}>
            Role <span style={{ color: 'var(--accent-ink)' }}>*</span>
          </label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
          >
            <option value="customer" style={{ background: 'var(--surface)' }}>Customer</option>
            <option value="super_customer" style={{ background: 'var(--surface)' }}>Super Customer</option>
            <option value="admin" style={{ background: 'var(--surface)' }}>Admin</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2" style={LABEL}>Organization</label>
          <select
            name="organization_id"
            value={formData.organization_id}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
          >
            <option value="" style={{ background: 'var(--surface)' }}>No Organization</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id} style={{ background: 'var(--surface)' }}>
                {org.name}
              </option>
            ))}
          </select>
          <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>Only applicable for super customers</p>
        </div>
      </div>

      <div className="flex gap-4 pt-2">
        <Link
          href="/admin/users"
          className="px-6 py-2.5 rounded-xl text-sm font-medium text-center transition-opacity hover:opacity-80"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--fg)' }}
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-6 py-2.5 lyra-chamfer text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--accent)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
        >
          {loading ? 'Creating...' : 'Create User'}
        </button>
      </div>
    </form>
  );
}
