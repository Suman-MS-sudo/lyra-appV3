'use client';

import { useState, type ReactNode } from 'react';
import { LayoutGrid, Nfc } from 'lucide-react';

export default function DashboardTabs({ overview, rfid }: { overview: ReactNode; rfid?: ReactNode }) {
  const [tab, setTab] = useState<'overview' | 'rfid'>('overview');

  if (!rfid) return <>{overview}</>;

  return (
    <>
      <div className="flex items-center gap-2 p-1 rounded-2xl w-fit" style={{ background: '#f5f5f7', border: '1px solid #f5f5f7' }}>
        <button
          onClick={() => setTab('overview')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={tab === 'overview'
            ? { background: '#1d1d1f', color: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }
            : { color: '#6e6e73' }}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          Overview
        </button>
        <button
          onClick={() => setTab('rfid')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={tab === 'rfid'
            ? { background: 'linear-gradient(135deg, #0071e3, #0058b0)', color: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }
            : { color: '#6e6e73' }}
        >
          <Nfc className="w-3.5 h-3.5" />
          RFID Usage
        </button>
      </div>

      <div className={tab === 'overview' ? 'space-y-6' : 'hidden'}>{overview}</div>
      <div className={tab === 'rfid' ? 'space-y-6' : 'hidden'}>{rfid}</div>
    </>
  );
}
