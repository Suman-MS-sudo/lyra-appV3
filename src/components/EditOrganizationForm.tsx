'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Organization {
  id: string;
  name: string;
  customer_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  gstin: string | null;
  pan: string | null;
  notes: string | null;
}

interface EditOrganizationFormProps {
  organization: Organization;
}

const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
};

const INPUT: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  color: 'var(--fg)',
  borderRadius: 12,
};

const LABEL: React.CSSProperties = { color: 'var(--fg)' };

export default function EditOrganizationForm({ organization }: EditOrganizationFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: organization.name || '',
    customer_id: organization.customer_id || '',
    contact_email: organization.contact_email || '',
    contact_phone: organization.contact_phone || '',
    address: organization.address || '',
    city: organization.city || '',
    state: organization.state || '',
    zip_code: organization.zip_code || '',
    gstin: organization.gstin || '',
    pan: organization.pan || '',
    notes: organization.notes || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        // A proxy in front of the app can replace error bodies with an HTML
        // page, so don't assume the response is JSON.
        const text = await response.text();
        let message = '';
        try {
          const data = JSON.parse(text);
          message = data.error?.message || data.message || '';
        } catch {}
        throw new Error(message || `Failed to update organization (HTTP ${response.status})`);
      }

      router.push('/admin/organizations');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-6" style={CARD}>
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.04)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2" style={LABEL}>
            Organization Name <span style={{ color: 'var(--accent-ink)' }}>*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="Enter organization name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={LABEL}>Customer ID</label>
          <input
            type="text"
            name="customer_id"
            value={formData.customer_id}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="e.g. CN00005"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={LABEL}>Contact Email</label>
          <input
            type="email"
            name="contact_email"
            value={formData.contact_email}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="contact@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={LABEL}>Contact Phone</label>
          <input
            type="tel"
            name="contact_phone"
            value={formData.contact_phone}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="+91 98765 43210"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2" style={LABEL}>Address</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="Street address"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={LABEL}>City</label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="City"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={LABEL}>State</label>
          <input
            type="text"
            name="state"
            value={formData.state}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="State"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={LABEL}>ZIP Code</label>
          <input
            type="text"
            name="zip_code"
            value={formData.zip_code}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="600001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={LABEL}>GSTIN</label>
          <input
            type="text"
            name="gstin"
            value={formData.gstin}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="GST Number"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={LABEL}>PAN</label>
          <input
            type="text"
            name="pan"
            value={formData.pan}
            onChange={handleChange}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="PAN Number"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2" style={LABEL}>Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={INPUT}
            placeholder="Additional notes..."
          />
        </div>
      </div>

      <div className="flex gap-4 pt-2">
        <Link
          href="/admin/organizations"
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
          {loading ? 'Updating...' : 'Update Organization'}
        </button>
      </div>
    </form>
  );
}
