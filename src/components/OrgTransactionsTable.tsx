'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { deleteOrgTransactions } from '@/app/actions/admin';
import { useRouter } from 'next/navigation';

export interface TxRow {
  id: string;
  type: 'online' | 'coin';
  machine_name: string;
  product: string;
  amount: number;
  status: string;
  created_at: string;
}

interface Props {
  rows: TxRow[];
  orgId: string;
}

const MODAL: React.CSSProperties = {
  background: 'linear-gradient(160deg, #2D1257 0%, #1E0A3C 55%, #150828 100%)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 20,
};

export function OrgTransactionsTable({ rows, orgId }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const allIds = rows.map(r => r.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const openConfirm = (ids: string[]) => {
    setTargetIds(ids);
    setError(null);
    setShowConfirm(true);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const onlineIds = targetIds.filter(id => rows.find(r => r.id === id)?.type === 'online');
      const coinIds   = targetIds.filter(id => rows.find(r => r.id === id)?.type === 'coin');
      await deleteOrgTransactions(onlineIds, coinIds, orgId);
      setSelected(new Set());
      setShowConfirm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl py-20 text-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
        <p className="text-white font-semibold mb-1">No transactions found</p>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>This organization has no recorded transactions yet.</p>
      </div>
    );
  }

  return (
    <>
      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-3" style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.25)' }}>
          <span className="text-sm font-medium" style={{ color: '#FCA5A5' }}>
            {selected.size} selected
          </span>
          <button
            onClick={() => openConfirm(Array.from(selected))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
            style={{ background: 'rgba(244,63,94,0.20)', border: '1px solid rgba(244,63,94,0.35)', color: '#FCA5A5' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete selected
          </button>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded accent-pink-500 cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Type</th>
              <th className="px-4 py-3 text-left font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Machine</th>
              <th className="px-4 py-3 text-left font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Product</th>
              <th className="px-4 py-3 text-left font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Amount</th>
              <th className="px-4 py-3 text-left font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Status</th>
              <th className="px-4 py-3 text-left font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Date</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id}
                style={{
                  borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                  background: selected.has(row.id) ? 'rgba(244,63,94,0.06)' : undefined,
                }}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    className="w-4 h-4 rounded accent-pink-500 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={row.type === 'online'
                      ? { background: 'rgba(139,92,246,0.15)', color: '#C4B5FD' }
                      : { background: 'rgba(234,179,8,0.15)', color: '#FDE047' }
                    }
                  >
                    {row.type === 'online' ? 'Online' : 'Coin'}
                  </span>
                </td>
                <td className="px-4 py-3 text-white">{row.machine_name}</td>
                <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.70)' }}>{row.product}</td>
                <td className="px-4 py-3 text-white font-medium">₹{row.amount.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={
                      row.status === 'paid' || row.status === 'dispensed'
                        ? { background: 'rgba(34,197,94,0.15)', color: '#86EFAC' }
                        : row.status === 'pending'
                        ? { background: 'rgba(234,179,8,0.15)', color: '#FDE047' }
                        : { background: 'rgba(244,63,94,0.15)', color: '#FCA5A5' }
                    }
                  >
                    {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {new Date(row.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => openConfirm([row.id])}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                    title="Delete"
                    style={{ color: 'rgba(252,165,165,0.60)' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.70)' }}
          onClick={() => !isDeleting && setShowConfirm(false)}
        >
          <div className="w-full max-w-md p-6" style={MODAL} onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 rounded-full shrink-0" style={{ background: 'rgba(244,63,94,0.15)' }}>
                <AlertTriangle className="h-6 w-6" style={{ color: '#FCA5A5' }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Delete Transactions?</h3>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.60)' }}>
                  {targetIds.length === 1
                    ? 'This transaction will be permanently deleted.'
                    : `${targetIds.length} transactions will be permanently deleted.`}
                </p>
                <p className="text-sm mt-1 font-medium" style={{ color: '#FCA5A5' }}>This cannot be undone.</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-xl p-3" style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)' }}>
                <p className="text-sm" style={{ color: '#FCA5A5' }}>{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowConfirm(false); setError(null); }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.70)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 2px 12px rgba(244,63,94,0.35)' }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
