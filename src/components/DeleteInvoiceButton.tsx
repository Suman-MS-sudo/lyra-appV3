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
      
      // Close modal
      setShowConfirm(false);
      setIsDeleting(false);
      
      // Refresh the current page to show updated data
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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 disabled:opacity-50"
        disabled={isDeleting}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-red-100 rounded-full flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Delete Invoice?
                  </h3>
                  <p className="text-sm text-gray-600 mb-2" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    Are you sure you want to delete invoice <strong>{invoiceNumber}</strong> for <strong>{organizationName}</strong>?
                  </p>
                  <p className="text-sm text-red-600 font-medium" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    This action cannot be undone. All associated payment records will also be deleted.
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 break-words">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    setError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
