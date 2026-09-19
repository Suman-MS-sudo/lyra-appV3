'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { deleteOrganization } from '@/app/actions/admin';
import { useRouter } from 'next/navigation';

interface Props {
  orgId: string;
  orgName: string;
}

const MODAL: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e5e7',
  borderRadius: 20,
};

export function DeleteOrganizationButton({ orgId, orgName }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await deleteOrganization(orgId);
      setShowConfirm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete organization');
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="p-2 rounded-lg transition-colors hover:bg-white/10"
        title="Delete organization"
        style={{ color: '#c8102e' }}
        disabled={isDeleting}
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.70)' }}
          onClick={() => setShowConfirm(false)}
        >
          <div className="w-full max-w-lg p-6" style={MODAL} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 rounded-full shrink-0" style={{ background: 'rgba(0,0,0,0.04)' }}>
                <AlertTriangle className="h-6 w-6" style={{ color: '#c8102e' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-[#1d1d1f] mb-2">Delete Organization?</h3>
                <p className="text-sm mb-2" style={{ color: '#3a3a3c' }}>
                  Are you sure you want to delete <strong className="text-[#1d1d1f]">{orgName}</strong>?
                </p>
                <p className="text-sm font-medium" style={{ color: '#c8102e' }}>
                  This action cannot be undone.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.04)' }}>
                <p className="text-sm" style={{ color: '#c8102e' }}>{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowConfirm(false); setError(null); }}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
                style={{ background: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f' }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: '#1d1d1f', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Organization'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
