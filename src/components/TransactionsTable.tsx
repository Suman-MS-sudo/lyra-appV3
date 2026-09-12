'use client';

import { useState } from 'react';
import { CreditCard, Coins, Nfc } from 'lucide-react';

type TxType = 'all' | 'online' | 'coin' | 'rfid';

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

interface RfidTx {
  id: string;
  type: 'rfid';
  amount: number;
  status: string;
  machine: string;
  product: string;
  items: number;
  created_at: string;
}

type Transaction = OnlineTx | CoinTx | RfidTx;

function formatTimeAgo(dateString: string) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60)     return 'Just now';
  if (seconds < 3600)   return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)  return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateString).toLocaleDateString('en-IN');
}

const CARD: React.CSSProperties = {
  background: '#f5f5f7',
  border: '1px solid #f5f5f7',
  borderRadius: 20,
};

export default function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const [filter, setFilter] = useState<TxType>('all');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const filtered = filter === 'all' ? transactions : transactions.filter(tx => tx.type === filter);
  const onlineCount = transactions.filter(t => t.type === 'online').length;
  const coinCount   = transactions.filter(t => t.type === 'coin').length;
  const rfidCount   = transactions.filter(t => t.type === 'rfid').length;

  const tabs: { key: TxType; label: string; count: number; activeStyle: React.CSSProperties }[] = [
    { key: 'all',    label: 'All',    count: onlineCount + coinCount + rfidCount, activeStyle: { background: '#e5e5e7', color: '#1d1d1f' } },
    { key: 'online', label: 'Online', count: onlineCount,             activeStyle: { background: 'rgba(0,0,0,0.04)',  color: '#0071e3', border: '1px solid rgba(0,0,0,0.04)' } },
    { key: 'coin',   label: 'Coin',   count: coinCount,               activeStyle: { background: 'rgba(154,100,0,0.12)', color: '#9a6400', border: '1px solid rgba(154,100,0,0.12)' } },
    { key: 'rfid',   label: 'RFID',   count: rfidCount,               activeStyle: { background: 'rgba(0,0,0,0.04)', color: '#6e6e73', border: '1px solid rgba(0,0,0,0.04)' } },
  ];

  return (
    <div className="rounded-2xl p-5" style={CARD}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-semibold text-[#1d1d1f]">Recent Transactions</h2>
          <p className="text-xs mt-0.5" style={{ color: '#6e6e73' }}>Last 10 each of coin, online &amp; RFID payments</p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#f5f5f7' }}>
          {tabs.map(({ key, label, count, activeStyle }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
              style={filter === key ? activeStyle : { color: '#6e6e73' }}
            >
              {key === 'online' && <CreditCard className="w-3 h-3" />}
              {key === 'coin'   && <Coins className="w-3 h-3" />}
              {key === 'rfid'   && <Nfc className="w-3 h-3" />}
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #f5f5f7' }}>
              {['Type', 'Machine', 'Product / Items', 'Amount', 'Status', 'Time'].map((h, i) => (
                <th
                  key={h}
                  className={`py-2 px-3 text-xs font-semibold uppercase tracking-wide ${
                    i === 0 ? 'text-left' : i === 3 ? 'text-right' : i === 4 ? 'text-center' : i === 5 ? 'text-right hidden md:table-cell' : i === 2 ? 'text-left hidden sm:table-cell' : 'text-left'
                  }`}
                  style={{ color: '#86868b' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm" style={{ color: '#a1a1a6' }}>
                  No {filter !== 'all' ? filter : ''} transactions found
                </td>
              </tr>
            ) : filtered.map((tx, i) => (
              <tr
                key={tx.id}
                className="transition-colors"
                style={{ borderBottom: '1px solid #f5f5f7', background: hoveredIndex === i ? '#f5f5f7' : undefined }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Type badge */}
                <td className="py-3 px-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold"
                    style={tx.type === 'online'
                      ? { background: 'rgba(0,0,0,0.04)', color: '#0071e3' }
                      : tx.type === 'rfid'
                      ? { background: 'rgba(0,0,0,0.04)', color: '#6e6e73' }
                      : { background: 'rgba(154,100,0,0.12)', color: '#9a6400' }
                    }
                  >
                    {tx.type === 'online' ? <CreditCard className="w-3 h-3" /> : tx.type === 'rfid' ? <Nfc className="w-3 h-3" /> : <Coins className="w-3 h-3" />}
                    {tx.type === 'online' ? 'Online' : tx.type === 'rfid' ? 'RFID' : 'Coin'}
                  </span>
                </td>

                {/* Machine */}
                <td className="py-3 px-3 font-medium text-[#1d1d1f] max-w-28 truncate">{tx.machine}</td>

                {/* Product / Items */}
                <td className="py-3 px-3 hidden sm:table-cell" style={{ color: '#6e6e73' }}>
                  {(tx.type === 'coin' || tx.type === 'rfid') && 'product' in tx
                    ? (tx as CoinTx | RfidTx).product
                    : `${tx.items} item${tx.items !== 1 ? 's' : ''}`}
                </td>

                {/* Amount */}
                <td className="py-3 px-3 text-right font-semibold text-[#1d1d1f]">₹{tx.amount.toFixed(2)}</td>

                {/* Status */}
                <td className="py-3 px-3 text-center">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                    style={
                      tx.status === 'paid' || tx.status === 'dispensed'
                        ? { background: 'rgba(29,122,60,0.12)', color: '#1d7a3c' }
                        : tx.status === 'pending'
                        ? { background: 'rgba(154,100,0,0.12)', color: '#9a6400' }
                        : { background: '#f5f5f7', color: '#6e6e73' }
                    }
                  >
                    {tx.status === 'dispensed' ? 'Dispensed' : tx.status === 'paid' ? 'Paid' : tx.status}
                  </span>
                </td>

                {/* Time */}
                <td className="py-3 px-3 text-right text-xs hidden md:table-cell" style={{ color: '#86868b' }}>
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
