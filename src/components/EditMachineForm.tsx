'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface EditMachineFormProps {
  machine: any;
  organizations: { id: string; name: string }[];
}

export default function EditMachineForm({ machine, organizations }: EditMachineFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The machines list link carries its current search term forward as ?q=
  // so we can return to it here — using router.back() would land back on
  // the list with the search box reset, since the list re-mounts fresh on
  // every visit and only knows its search term from this same query param.
  const q = searchParams.get('q');
  const machinesListHref = `/admin/machines${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: machine.name || '',
    machine_id: machine.machine_id || '',
    mac_id: machine.mac_id || '',
    ip_address: machine.ip_address || '',
    location: machine.location || '',
    status: machine.status || 'offline',
    machine_type: machine.machine_type || '',
    product_type: machine.product_type || '',
    customer_id: machine.customer_id || '',
    rfid_enabled: !!machine.rfid_enabled,
    body_type: machine.body_type || 'single_motor',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/machines/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: machine.id,
          ...formData,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        let message = 'Failed to update machine';
        if (data) {
          if (typeof data.error === 'string') message = data.error;
          else if (data.error && typeof data.error.message === 'string') message = data.error.message;
          else if (typeof data.message === 'string') message = data.message;
          else {
            try {
              message = JSON.stringify(data);
            } catch (e) {
              message = String(data);
            }
          }
        }
        throw new Error(message);
      }

      alert('Machine updated successfully!');
      router.push(machinesListHref);
      router.refresh();
    } catch (err: any) {
      const message = (err && err.message) ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Machine Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Machine Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Vending Machine 001"
            />
          </div>

          {/* Machine ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Machine ID *
            </label>
            <input
              type="text"
              value={formData.machine_id}
              onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., lyra_SNVM_003"
            />
            <p className="mt-1 text-xs text-gray-500">Unique identifier for this machine</p>
          </div>

          {/* MAC Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              MAC Address *
            </label>
            <input
              type="text"
              value={formData.mac_id}
              onChange={(e) => setFormData({ ...formData, mac_id: e.target.value })}
              required
              pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              placeholder="e.g., C0:CD:D6:84:85:DC"
            />
            <p className="mt-1 text-xs text-gray-500">Format: XX:XX:XX:XX:XX:XX</p>
          </div>

          {/* IP Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              IP Address
            </label>
            <input
              type="text"
              value={formData.ip_address}
              onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              placeholder="e.g., 192.168.1.100"
            />
            <p className="mt-1 text-xs text-gray-500">Optional while editing; IP is required when creating a new machine.</p>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location *
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Building A, Floor 2"
            />
          </div>

          {/* Machine Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Machine Type *
            </label>
            <input
              type="text"
              value={formData.machine_type}
              onChange={(e) => setFormData({ ...formData, machine_type: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., SNVM_WF_SL30"
            />
          </div>

          {/* Product Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Type *
            </label>
            <input
              type="text"
              value={formData.product_type}
              onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., SANITARY PAD"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status *
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
            >
              <option value="online" className="text-gray-900">Online</option>
              <option value="offline" className="text-gray-900">Offline</option>
              <option value="maintenance" className="text-gray-900">Maintenance</option>
            </select>
          </div>

          {/* Organization */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization
            </label>
            <select
              value={formData.customer_id}
              onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
            >
              <option value="" className="text-gray-900">No organization assigned</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id} className="text-gray-900">
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Payment Modes */}
        <div className="pt-2 border-t border-gray-200">
          <label className="flex items-center gap-3 pt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.rfid_enabled}
              onChange={(e) => setFormData({ ...formData, rfid_enabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Enable RFID card payments on this machine</span>
          </label>
          <p className="mt-1 ml-7 text-xs text-gray-500">Machine firmware must also be flashed with RFID-enabled firmware.</p>
        </div>

        {/* Body Type */}
        <div className="pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Dispenser Body Type</label>
          <select
            value={formData.body_type}
            onChange={(e) => setFormData({ ...formData, body_type: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
          >
            <option value="single_motor">Single Motor — 35 napkin capacity</option>
            <option value="quad_motor">Quad Motor — 100 napkin capacity (4x25)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">Must match the firmware flashed on this machine (ESP32_RFID_Firmware_SingleMotor.ino or _QuadMotor.ino).</p>
        </div>

        <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => router.push(machinesListHref)}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
