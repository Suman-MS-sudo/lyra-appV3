'use client';

import { useState } from 'react';
import { CreditCard, Coins } from 'lucide-react';

type TxType = 'all' | 'online' | 'coin';

interface OnlineTx {
  id: string;
  type: 'online';
  amount: number;
  status: string;
  machine: string;
  items: number;
  created_at: string;
}

interface CoinTx {
  id: string;
  type: 'coin';
  amount: number;
  status: string;
  machine: string;
  product: string;
  items: number;
  created_at: string;
}

type Transaction = OnlineTx | CoinTx;

function formatTimeAgo(dateString: string) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60)     return 'Just now';
  if (seconds < 3600)   return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)  return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateString).toLocaleDateString('en-IN');
}

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 20,
};

export default function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const [filter, setFilter] = useState<TxType>('all');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const filtered = filter === 'all' ? transactions : transactions.filter(tx => tx.type === filter);
  const onlineCount = transactions.filter(t => t.type === 'online').length;
  const coinCount   = transactions.filter(t => t.type === 'coin').length;

  const tabs: { key: TxType; label: string; count: number; activeStyle: React.CSSProperties }[] = [
    { key: 'all',    label: 'All',    count: onlineCount + coinCount, activeStyle: { background: 'rgba(255,255,255,0.12)', color: 'white' } },
    { key: 'online', label: 'Online', count: onlineCount,             activeStyle: { background: 'rgba(244,63,94,0.22)',  color: '#FDA4AF', border: '1px solid rgba(244,63,94,0.35)' } },
    { key: 'coin',   label: 'Coin',   count: coinCount,               activeStyle: { background: 'rgba(251,191,36,0.18)', color: '#FDE68A', border: '1px solid rgba(251,191,36,0.30)' } },
  ];

  return (
    <div className="rounded-2xl p-5" style={CARD}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-semibold text-white">Recent Transactions</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>Last 10 coin &amp; last 10 online payments</p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {tabs.map(({ key, label, count, activeStyle }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
              style={filter === key ? activeStyle : { color: 'rgba(255,255,255,0.40)' }}
            >
              {key === 'online' && <CreditCard className="w-3 h-3" />}
              {key === 'coin'   && <Coins className="w-3 h-3" />}
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Type', 'Machine', 'Product / Items', 'Amount', 'Status', 'Time'].map((h, i) => (
                <th
                  key={h}
                  className={`py-2 px-3 text-xs font-semibold uppercase tracking-wide ${
                    i === 0 ? 'text-left' : i === 3 ? 'text-right' : i === 4 ? 'text-center' : i === 5 ? 'text-right hidden md:table-cell' : i === 2 ? 'text-left hidden sm:table-cell' : 'text-left'
                  }`}
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  No {filter !== 'all' ? filter : ''} transactions found
                </td>
              </tr>
            ) : filtered.map((tx, i) => (
              <tr
                key={tx.id}
                className="transition-colors"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: hoveredIndex === i ? 'rgba(255,255,255,0.03)' : undefined }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Type badge */}
                <td className="py-3 px-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold"
                    style={tx.type === 'online'
                      ? { background: 'rgba(244,63,94,0.15)', color: '#FDA4AF' }
                      : { background: 'rgba(251,191,36,0.15)', color: '#FDE68A' }
                    }
                  >
                    {tx.type === 'online' ? <CreditCard className="w-3 h-3" /> : <Coins className="w-3 h-3" />}
                    {tx.type === 'online' ? 'Online' : 'Coin'}
                  </span>
                </td>

                {/* Machine */}
                <td className="py-3 px-3 font-medium text-white max-w-28 truncate">{tx.machine}</td>

                {/* Product / Items */}
                <td className="py-3 px-3 hidden sm:table-cell" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {tx.type === 'coin' && 'product' in tx
                    ? (tx as CoinTx).product
                    : `${tx.items} item${tx.items !== 1 ? 's' : ''}`}
                </td>

                {/* Amount */}
                <td className="py-3 px-3 text-right font-semibold text-white">₹{tx.amount.toFixed(2)}</td>

                {/* Status */}
                <td className="py-3 px-3 text-center">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                    style={
                      tx.status === 'paid' || tx.status === 'dispensed'
                        ? { background: 'rgba(52,211,153,0.15)', color: '#6EE7B7' }
                        : tx.status === 'pending'
                        ? { background: 'rgba(251,191,36,0.15)', color: '#FDE68A' }
                        : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }
                    }
                  >
                    {tx.status === 'dispensed' ? 'Dispensed' : tx.status === 'paid' ? 'Paid' : tx.status}
                  </span>
                </td>

                {/* Time */}
                <td className="py-3 px-3 text-right text-xs hidden md:table-cell" style={{ color: 'rgba(255,255,255,0.32)' }}>
                  {formatTimeAgo(tx.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
