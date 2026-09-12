'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { deleteInvoice } from '@/app/actions/organization-billing';
import { useRouter } from 'next/navigation';

interface DeleteInvoiceButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  organizationName: string;
}

const MODAL: React.CSSProperties = {
  background: 'linear-gradient(160deg, #eff6ff 0%, #ffffff 55%, #f8fafc 100%)',
  border: '1px solid #e2e8f0',
  borderRadius: 20,
};

export function DeleteInvoiceButton({ invoiceId, invoiceNumber, organizationName }: DeleteInvoiceButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await deleteInvoice(invoiceId);
      setShowConfirm(false);
      setIsDeleting(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invoice');
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.25)', color: '#B91C1C' }}
        disabled={isDeleting}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.70)' }}
          onClick={() => setShowConfirm(false)}
        >
          <div className="w-full max-w-lg p-6" style={MODAL} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 rounded-full shrink-0" style={{ background: 'rgba(37,99,235,0.15)' }}>
                <AlertTriangle className="h-6 w-6" style={{ color: '#B91C1C' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Invoice?</h3>
                <p className="text-sm mb-2" style={{ color: '#0f172a', wordBreak: 'break-word' }}>
                  Are you sure you want to delete invoice <strong className="text-slate-900">{invoiceNumber}</strong> for <strong className="text-slate-900">{organizationName}</strong>?
                </p>
                <p className="text-sm font-medium" style={{ color: '#B91C1C', wordBreak: 'break-word' }}>
                  This action cannot be undone. All associated payment records will also be deleted.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-xl p-3" style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)' }}>
                <p className="text-sm wrap-break-word" style={{ color: '#B91C1C' }}>{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowConfirm(false); setError(null); }}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a' }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)', boxShadow: '0 2px 12px rgba(37,99,235,0.35)' }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
