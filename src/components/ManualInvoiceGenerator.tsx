'use client';

import { useState, useEffect } from 'react';
import { FileText, X } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
}

const MODAL: React.CSSProperties = {
  background: 'linear-gradient(160deg, #eff6ff 0%, #ffffff 55%, #f8fafc 100%)',
  border: '1px solid #e2e8f0',
  borderRadius: 20,
};

const INPUT: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  color: '#0f172a',
  borderRadius: 12,
};

const LABEL: React.CSSProperties = { color: '#0f172a' };

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
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a' }}
      >
        <FileText size={16} />
        Generate Manual Invoice
      </button>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.70)' }}
        onClick={() => setIsOpen(false)}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md p-6" style={MODAL}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Generate Invoice</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="transition-opacity hover:opacity-70"
              style={{ color: '#334155' }}
            >
              <X size={22} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={LABEL}>Organization</label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={INPUT}
                disabled={loading}
              >
                <option value="" style={{ background: '#ffffff' }}>Select organization...</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id} style={{ background: '#ffffff' }}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={LABEL}>Period Start</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={INPUT}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={LABEL}>Period End</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={INPUT}
                disabled={loading}
              />
            </div>

            {/* Quick Select */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now.getFullYear(), now.getMonth(), 1);
                  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                  setPeriodStart(start.toISOString().split('T')[0]);
                  setPeriodEnd(end.toISOString().split('T')[0]);
                }}
                className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.25)', color: '#93C5FD' }}
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
                className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a' }}
                disabled={loading}
              >
                Last Month
              </button>
            </div>

            {message && (
              <div
                className="p-3 rounded-xl text-sm"
                style={message.startsWith('✅')
                  ? { background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)', color: '#047857' }
                  : { background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(37,99,235,0.25)', color: '#B91C1C' }
                }
              >
                {message}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleGenerate}
                disabled={loading || !selectedOrg || !periodStart || !periodEnd}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)', boxShadow: '0 2px 12px rgba(37,99,235,0.35)' }}
              >
                {loading ? 'Generating...' : 'Generate Invoice'}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a' }}
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
