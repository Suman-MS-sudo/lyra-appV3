'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Wallet, Infinity as InfinityIcon, Plus, Minus, Receipt, Ban, CheckCircle2 } from 'lucide-react';

type CardType = 'prepaid' | 'postpaid';

type RfidCard = {
  id: string;
  uid: string;
  holder_name: string | null;
  credits_remaining: number;
  is_active: boolean;
  card_type: CardType;
  vend_count: number;
  total_spent_paisa: number;
  machine: { id: string; name: string; location: string } | null;
};

const card_style = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' };
const muted = { color: 'rgba(255,255,255,0.45)' };
const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' };

function rupees(paisa: number) {
  return `₹${(paisa / 100).toFixed(2)}`;
}

export default function RfidCardsUsagePanel({ initialCards }: { initialCards: RfidCard[] }) {
  const [cards, setCards] = useState<RfidCard[]>(initialCards);
  const [subTab, setSubTab] = useState<CardType>('prepaid');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const prepaidCards = cards.filter(c => c.card_type === 'prepaid');
  const postpaidCards = cards.filter(c => c.card_type === 'postpaid');
  const visible = subTab === 'prepaid' ? prepaidCards : postpaidCards;

  async function adjustCredits(card: RfidCard, direction: 1 | -1) {
    const raw = amounts[card.id];
    const credits = parseInt(raw, 10);
    if (!credits || credits <= 0) {
      setError('Enter a credit count first');
      return;
    }
    if (direction === -1 && credits > card.credits_remaining) {
      setError(`Can't deduct more than the current credits (${card.credits_remaining})`);
      return;
    }
    setBusyId(card.id);
    setError('');
    try {
      const res = await fetch(`/api/customer/rfid-cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ top_up_credits: credits * direction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update credits');
      setCards(prev => prev.map(c => (c.id === card.id ? { ...c, credits_remaining: data.card.credits_remaining } : c)));
      setAmounts(prev => ({ ...prev, [card.id]: '' }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function settleTab(card: RfidCard) {
    if (!confirm(`Mark ${card.holder_name || card.uid}'s tab of ${rupees(card.total_spent_paisa)} (${card.vend_count} vended) as billed and reset it?`)) return;
    setBusyId(card.id);
    try {
      const res = await fetch(`/api/customer/rfid-cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settle_tab: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to settle tab');
      setCards(prev => prev.map(c => (c.id === card.id ? { ...c, vend_count: 0, total_spent_paisa: 0 } : c)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(card: RfidCard) {
    setBusyId(card.id);
    try {
      const res = await fetch(`/api/customer/rfid-cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !card.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update card');
      setCards(prev => prev.map(c => (c.id === card.id ? { ...c, is_active: data.card.is_active } : c)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-2xl p-5" style={card_style}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-white">RFID Card Holders</h2>
          <p className="text-xs mt-0.5" style={muted}>Manage credits by card type</p>
        </div>
        <Link href="/customer/rfid-cards" className="text-xs font-medium transition-colors hover:text-white" style={{ color: '#F472B6' }}>
          Add / manage cards →
        </Link>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-2 p-1 rounded-xl w-fit mb-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <button
          onClick={() => setSubTab('prepaid')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={subTab === 'prepaid'
            ? { background: 'rgba(167,139,250,0.22)', color: '#C4B5FD' }
            : { color: 'rgba(255,255,255,0.45)' }}
        >
          <Wallet className="w-3.5 h-3.5" /> Credit Based ({prepaidCards.length})
        </button>
        <button
          onClick={() => setSubTab('postpaid')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={subTab === 'postpaid'
            ? { background: 'rgba(96,165,250,0.22)', color: '#93C5FD' }
            : { color: 'rgba(255,255,255,0.45)' }}
        >
          <InfinityIcon className="w-3.5 h-3.5" /> No Limit ({postpaidCards.length})
        </button>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#FCA5A5' }}>
          {error}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-center py-8" style={muted}>
          No {subTab === 'prepaid' ? 'credit-based' : 'no-limit'} cards yet
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map(card => (
            <div key={card.id} className="rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{card.holder_name || card.uid}</p>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                      style={card.is_active
                        ? { background: 'rgba(67,233,123,0.12)', color: '#43e97b' }
                        : { background: 'rgba(239,68,68,0.12)', color: '#FCA5A5' }}
                    >
                      {card.is_active ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Ban className="w-2.5 h-2.5" />}
                      {card.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {card.holder_name && <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.30)' }}>{card.uid}</p>}
                  <p className="text-xs mt-0.5" style={muted}>{card.machine?.name || 'Unassigned'}</p>
                </div>
                <div className="text-right shrink-0">
                  {card.card_type === 'prepaid' ? (
                    <p className="text-base font-bold" style={{ color: '#43e97b' }}>{card.credits_remaining} credits</p>
                  ) : (
                    <>
                      <p className="text-base font-bold" style={{ color: '#FBBF24' }}>{rupees(card.total_spent_paisa)} owed</p>
                      <p className="text-xs" style={muted}>{card.vend_count} vended</p>
                    </>
                  )}
                </div>
              </div>

              {card.card_type === 'prepaid' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Credits"
                    value={amounts[card.id] || ''}
                    onChange={e => setAmounts(prev => ({ ...prev, [card.id]: e.target.value }))}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                    style={inputStyle}
                  />
                  <button
                    onClick={() => adjustCredits(card, 1)}
                    disabled={busyId === card.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: 'rgba(67,233,123,0.15)', border: '1px solid rgba(67,233,123,0.28)' }}
                  >
                    <Plus className="w-3 h-3" /> Increase
                  </button>
                  <button
                    onClick={() => adjustCredits(card, -1)}
                    disabled={busyId === card.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
                  >
                    <Minus className="w-3 h-3" /> Decrease
                  </button>
                  <button
                    onClick={() => toggleActive(card)}
                    disabled={busyId === card.id}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                  >
                    {card.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => settleTab(card)}
                    disabled={busyId === card.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.28)' }}
                  >
                    <Receipt className="w-3.5 h-3.5" /> Settle Tab
                  </button>
                  <button
                    onClick={() => toggleActive(card)}
                    disabled={busyId === card.id}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                  >
                    {card.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
