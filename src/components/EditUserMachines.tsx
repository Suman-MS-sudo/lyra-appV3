'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Machine {
  id: string;
  name: string;
  location: string;
  customer_id: string;
}

interface EditUserMachinesProps {
  userId: string;
  superCustomerId: string;
  ownedMachines: Machine[];
  assignedMachines: Machine[];
}

export default function EditUserMachines({ 
  userId, 
  superCustomerId, 
  ownedMachines, 
  assignedMachines 
}: EditUserMachinesProps) {
  const router = useRouter();
  const [selectedMachines, setSelectedMachines] = useState<string[]>(
    assignedMachines.map(m => m.id)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/customer/users/${userId}/machines`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_ids: selectedMachines,
          super_customer_id: superCustomerId
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update machines');
      }

      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const allAvailableMachines = [...ownedMachines, ...assignedMachines];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          ✓ Machines updated successfully!
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Assign Machines to User
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Select which machines this user can manage. Unselected machines will return to your ownership.
        </p>
        
        {allAvailableMachines.length > 0 ? (
          <div className="border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
            {allAvailableMachines.map(machine => (
              <label 
                key={machine.id} 
                className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded cursor-pointer"
              >
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
                {machine.customer_id === userId && (
                  <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Assigned
                  </span>
                )}
              </label>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600">No machines available to assign</p>
          </div>
        )}
        
        <p className="text-xs text-gray-500 mt-2">
          Selected: {selectedMachines.length} machine{selectedMachines.length !== 1 ? 's' : ''}
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
      >
        {loading ? 'Saving...' : 'Save Machine Assignments'}
      </button>
    </form>
  );
}
