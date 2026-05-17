'use client';

import { useState } from 'react';
import { IndianRupee, X } from 'lucide-react';
import { recordManualPayment } from '@/app/actions/organization-billing';

interface RecordPaymentButtonProps {
  invoiceId: string;
  amountDue: number;
  organizationName: string;
}

const MODAL: React.CSSProperties = {
  background: 'linear-gradient(160deg, #2D1257 0%, #1E0A3C 55%, #150828 100%)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 20,
};

const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#f3f4f6',
  borderRadius: 12,
};

const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.70)' };

export function RecordPaymentButton({ invoiceId, amountDue, organizationName }: RecordPaymentButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState((amountDue / 100).toFixed(2));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const amountPaisa = Math.round(parseFloat(amount) * 100);

      const result = await recordManualPayment({
        invoiceId,
        amountPaisa,
        notes: notes || undefined
      });

      if (result.success) {
        alert('Payment recorded successfully!');
        setShowModal(false);
        window.location.reload();
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="p-2 rounded-lg transition-colors hover:opacity-80"
        style={{ color: '#34D399' }}
        title="Record Payment"
      >
        <IndianRupee className="h-4 w-4" />
      </button>

      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.70)' }}
        >
          <div className="w-full max-w-md" style={MODAL}>
            <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="text-lg font-semibold text-white">Record Payment</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                style={{ color: 'rgba(255,255,255,0.50)' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={LABEL}>Organization</label>
                <input
                  type="text"
                  value={organizationName}
                  disabled
                  className="w-full px-3 py-2 cursor-not-allowed"
                  style={{ ...INPUT, background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.40)' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={LABEL}>Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={amountDue / 100}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  style={INPUT}
                />
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Amount due: ₹{(amountDue / 100).toFixed(2)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={LABEL}>Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Payment reference, transaction ID, etc."
                  className="w-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  style={INPUT}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.70)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #059669, #10B981)', boxShadow: '0 2px 12px rgba(16,185,129,0.30)' }}
                >
                  {loading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
