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

interface TransactionsTableProps {
  transactions: Transaction[];
}

function formatTimeAgo(dateString: string) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateString).toLocaleDateString('en-IN');
}

export default function TransactionsTable({ transactions }: TransactionsTableProps) {
  const [filter, setFilter] = useState<TxType>('all');

  const filtered = filter === 'all'
    ? transactions
    : transactions.filter(tx => tx.type === filter);

  const onlineCount = transactions.filter(t => t.type === 'online').length;
  const coinCount = transactions.filter(t => t.type === 'coin').length;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Recent Transactions</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Last 10 coin &amp; last 10 online payments</p>
        </div>

        {/* Toggle buttons */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              filter === 'all'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            All ({onlineCount + coinCount})
          </button>
          <button
            onClick={() => setFilter('online')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              filter === 'online'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <CreditCard className="w-3 h-3" />
            Online ({onlineCount})
          </button>
          <button
            onClick={() => setFilter('coin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              filter === 'coin'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Coins className="w-3 h-3" />
            Coin ({coinCount})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Machine</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Product / Items</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-gray-400 dark:text-gray-500">
                  No {filter !== 'all' ? filter : ''} transactions found
                </td>
              </tr>
            ) : filtered.map(tx => (
              <tr key={tx.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="py-3 px-3">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${
                    tx.type === 'online'
                      ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400'
                      : 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                  }`}>
                    {tx.type === 'online' ? <CreditCard className="w-3 h-3" /> : <Coins className="w-3 h-3" />}
                    {tx.type === 'online' ? 'Online' : 'Coin'}
                  </span>
                </td>
                <td className="py-3 px-3 font-medium text-gray-900 dark:text-white max-w-[120px] truncate">{tx.machine}</td>
                <td className="py-3 px-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                  {tx.type === 'coin' && 'product' in tx
                    ? (tx as CoinTx).product
                    : `${tx.items} item${tx.items !== 1 ? 's' : ''}`}
                </td>
                <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">₹{tx.amount.toFixed(2)}</td>
                <td className="py-3 px-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    tx.status === 'paid' || tx.status === 'dispensed'
                      ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                      : tx.status === 'pending'
                      ? 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}>
                    {tx.status === 'dispensed' ? 'Dispensed' : tx.status === 'paid' ? 'Paid' : tx.status}
                  </span>
                </td>
                <td className="py-3 px-3 text-right text-gray-400 dark:text-gray-500 text-xs hidden md:table-cell">
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
