'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Machine {
  id: string;
  name: string;
  location: string;
}

interface NewCustomerUserFormProps {
  superCustomerId: string;
  organizationId: string | null;
  machines: Machine[];
}

export default function NewCustomerUserForm({ superCustomerId, organizationId, machines }: NewCustomerUserFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email') as string,
      full_name: formData.get('full_name') as string,
      phone: formData.get('phone') as string,
      organization_id: organizationId,
      role: 'customer',
      account_type: 'customer',
      machine_ids: selectedMachines
    };

    try {
      const response = await fetch('/api/customer/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      // Show success message
      alert(`User created successfully! A password setup link has been sent to ${data.email}`);
      
      router.push('/customer/users');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-1">📧 Password Setup</h4>
        <p className="text-sm text-blue-700">
          A password reset link will be sent to the user's email address. They will set their own password upon first login.
        </p>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email Address *
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="user@example.com"
        />
        <p className="text-xs text-gray-500 mt-1">User will receive a setup link at this email</p>
      </div>

      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
          Full Name
        </label>
        <input
          type="text"
          id="full_name"
          name="full_name"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="John Doe"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
          Phone Number
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="+91 98765 43210"
        />
      </div>

      {/* Machine Assignment */}
      {machines.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Assign Machines (Optional)
          </label>
          <div className="border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
            {machines.map(machine => (
              <label key={machine.id} className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedMachines.includes(machine.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedMachines([...selectedMachines, machine.id]);
                    } else {
                      setSelectedMachines(selectedMachines.filter(id => id !== machine.id));
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-900">{machine.name}</span>
                <span className="text-xs text-gray-500">- {machine.location}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Selected: {selectedMachines.length} machine{selectedMachines.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">User Permissions</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>✓ View machines and their status</li>
          <li>✓ See revenue and transaction data</li>
          <li>✓ Access customer dashboard</li>
          <li>✗ Cannot create or manage users</li>
          <li>✗ Cannot access admin features</li>
        </ul>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {loading ? 'Creating...' : 'Create User'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
