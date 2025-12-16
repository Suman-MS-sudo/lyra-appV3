'use client';

import { useState, useEffect } from 'react';
import { FileText, X } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
}

export function ManualInvoiceGenerator() {
  const [isOpen, setIsOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchOrganizations();
      
      // Set default to current month
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      setPeriodStart(start.toISOString().split('T')[0]);
      setPeriodEnd(end.toISOString().split('T')[0]);
    }
  }, [isOpen]);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/billing/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  const handleGenerate = async () => {
    if (!selectedOrg || !periodStart || !periodEnd) {
      setMessage('Please fill in all fields');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/billing/generate-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedOrg,
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd + 'T23:59:59').toISOString(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ Invoice ${data.invoice.invoice_number} generated successfully!`);
        setTimeout(() => {
          setIsOpen(false);
          window.location.reload();
        }, 2000);
      } else {
        setMessage(`❌ ${data.error || 'Failed to generate invoice'}`);
      }
    } catch (error: any) {
      setMessage(`❌ ${error.message || 'An error occurred'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
      >
        <FileText size={16} />
        Generate Manual Invoice
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Generate Invoice</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Organization Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization
              </label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              >
                <option value="">Select organization...</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Period Start */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Period Start
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* Period End */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Period End
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* Quick Select Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now.getFullYear(), now.getMonth(), 1);
                  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                  setPeriodStart(start.toISOString().split('T')[0]);
                  setPeriodEnd(end.toISOString().split('T')[0]);
                }}
                className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                disabled={loading}
              >
                This Month
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const end = new Date(now.getFullYear(), now.getMonth(), 0);
                  setPeriodStart(start.toISOString().split('T')[0]);
                  setPeriodEnd(end.toISOString().split('T')[0]);
                }}
                className="text-xs px-3 py-1.5 bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
                disabled={loading}
              >
                Last Month
              </button>
            </div>

            {/* Message */}
            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                message.startsWith('✅') 
                  ? 'bg-green-50 text-green-800' 
                  : 'bg-red-50 text-red-800'
              }`}>
                {message}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleGenerate}
                disabled={loading || !selectedOrg || !periodStart || !periodEnd}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Generating...' : 'Generate Invoice'}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
