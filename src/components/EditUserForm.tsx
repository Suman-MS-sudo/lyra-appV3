'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  account_type: string;
  role: string;
  organization_id: string | null;
}

interface Organization {
  id: string;
  name: string;
}

interface EditUserFormProps {
  user: UserProfile;
  organizations: Organization[];
}

export default function EditUserForm({ user, organizations }: EditUserFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    phone: user.phone || '',
    account_type: user.account_type || 'customer',
    role: user.role || 'customer',
    organization_id: user.organization_id || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Submitting form data:', {
        ...formData,
        organization_id: formData.organization_id || null
      });
      
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          organization_id: formData.organization_id || null
        })
      });

      console.log('Response status:', response.status);
      const text = await response.text();
      console.log('Response text:', text);
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${text}`);
      }
      
      if (!response.ok) {
        console.error('Update failed:', data);
        throw new Error(data.error?.message || data.message || 'Failed to update user');
      }

      router.push('/admin/users');
      router.refresh();
    } catch (err: any) {
      console.error('Error updating user:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin/users" className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit User</h1>
              <p className="text-sm text-gray-500">Update user details and permissions</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-3xl">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Read-only Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter full name"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+91 1234567890"
              />
            </div>

            {/* Account Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type
              </label>
              <select
                name="account_type"
                value={formData.account_type}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="customer">Customer</option>
                <option value="super_customer">Super Customer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="customer">Customer</option>
                <option value="super_customer">Super Customer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Organization */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization
              </label>
              <select
                name="organization_id"
                value={formData.organization_id}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">No Organization</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Only applicable for super customers
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Link
              href="/admin/users"
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update User'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
