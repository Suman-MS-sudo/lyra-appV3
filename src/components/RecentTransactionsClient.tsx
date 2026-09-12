"use client";
import React from "react";
import { Receipt, Clock } from "lucide-react";

interface Transaction {
  created_at: string;
  total_amount: string | number;
  items: string | { name: string }[];
}

export function RecentTransactionsClient({ recentTransactions, CARD }: { recentTransactions: Transaction[]; CARD: React.CSSProperties }) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  return (
    <div className="rounded-2xl overflow-hidden" style={CARD}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #f5f5f7' }}>
        <h2 className="font-semibold text-[#1d1d1f] flex items-center gap-2">
          <Receipt className="w-4 h-4" style={{ color: '#6e6e73' }} />
          Recent Transactions
        </h2>
        <a href="/admin/transactions" className="text-xs font-medium flex items-center gap-1 transition-colors hover:text-[#1d1d1f]" style={{ color: '#0071e3' }}>
          View all <span className="w-3 h-3">→</span>
        </a>
      </div>
      <div>
        {recentTransactions && recentTransactions.length > 0 ? recentTransactions.map((tx, i) => {
          const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items || [];
          const productNames = items.map((item: { name: string }) => item.name).join(', ') || 'Product';
          const isHovered = hoveredIndex === i;
          return (
            <div
              key={i}
              className="flex items-center justify-between px-5 py-3.5 transition-colors"
              style={{ borderBottom: '1px solid #f5f5f7', background: isHovered ? '#f5f5f7' : undefined }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#1d1d1f] text-sm truncate">{productNames}</p>
                <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#86868b' }}>
                  <Clock className="w-3 h-3" />
                  {new Date(tx.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <span className="text-base font-bold ml-3" style={{ background: '#1d1d1f', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                ₹{parseFloat(String(tx.total_amount || 0)).toFixed(2)}
              </span>
            </div>
          );
        }) : (
          <div className="flex flex-col items-center justify-center py-14">
            <Receipt className="w-10 h-10 mb-3" style={{ color: '#e5e5e7' }} />
            <p className="text-sm" style={{ color: '#a1a1a6' }}>No transactions found</p>
          </div>
        )}
      </div>
    </div>
  );
}
