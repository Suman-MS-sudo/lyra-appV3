'use client';

import { useState } from 'react';
import { Nfc, Plus, RefreshCw, Wallet, Ban, CheckCircle2, Trash2, X, Receipt } from 'lucide-react';

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
  machine_id: string | null;
  machine: { id: string; name: string; location: string } | null;
  created_at: string;
};

type Machine = { id: string; name: string; location: string };

const card_style = { background: '#ffffff', border: '1px solid #f1f5f9' };
const muted = { color: '#334155' };
const inputStyle = { background: '#ffffff', border: '1px solid #f1f5f9' };

function rupees(paisa: number) {
  return `₹${(paisa / 100).toFixed(2)}`;
}

export default function CustomerRfidCardsClient({
  initialCards, machines,
}: {
  initialCards: RfidCard[]; machines: Machine[];
}) {
  const [cards, setCards] = useState<RfidCard[]>(initialCards);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [topUpId, setTopUpId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [newUid, setNewUid] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CardType>('prepaid');
  const [newCredits, setNewCredits] = useState('0');
  const [newMachineId, setNewMachineId] = useState(machines[0]?.id || '');

  const [topUpCredits, setTopUpCredits] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadCards() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/customer/rfid-cards');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load cards');
      setCards(data.cards || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    if (!newUid.trim() || !newMachineId) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/customer/rfid-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: newUid.trim(),
          holder_name: newName.trim() || null,
          card_type: newType,
          machine_id: newMachineId,
          initial_credits: newType === 'prepaid' ? (parseInt(newCredits, 10) || 0) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add card');
      setShowAdd(false);
      setNewUid(''); setNewName(''); setNewCredits('0'); setNewType('prepaid');
      loadCards();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitTopUp(e: React.FormEvent) {
    e.preventDefault();
    if (!topUpId) return;
    const credits = parseInt(topUpCredits, 10);
    if (!credits || credits <= 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/customer/rfid-cards/${topUpId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ top_up_credits: credits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to top up');
      setTopUpId(null);
      setTopUpCredits('');
      loadCards();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function settleTab(card: RfidCard) {
    if (!confirm(`Mark ${card.holder_name || card.uid}'s tab of ${rupees(card.total_spent_paisa)} (${card.vend_count} vended) as billed and reset it to zero?`)) return;
    await fetch(`/api/customer/rfid-cards/${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settle_tab: true }),
    });
    loadCards();
  }

  async function toggleActive(card: RfidCard) {
    await fetch(`/api/customer/rfid-cards/${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !card.is_active }),
    });
    loadCards();
  }

  async function deleteCard(card: RfidCard) {
    if (!confirm(`Delete card ${card.uid}? This cannot be undone.`)) return;
    await fetch(`/api/customer/rfid-cards/${card.id}`, { method: 'DELETE' });
    loadCards();
  }

  const filtered = cards.filter(c =>
    c.uid.toLowerCase().includes(search.toLowerCase()) ||
    (c.holder_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.machine?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (machines.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Nfc className="w-6 h-6" style={{ color: '#2563EB' }} />
            RFID Cards
          </h1>
        </div>
        <div className="rounded-2xl p-16 text-center" style={card_style}>
          <Nfc className="w-12 h-12 mx-auto mb-4" style={{ color: '#94a3b8' }} />
          <p className="font-medium mb-1" style={{ color: '#334155' }}>No RFID-enabled machines</p>
          <p className="text-sm" style={{ color: '#64748b' }}>None of your assigned machines have RFID enabled yet. Contact your admin to enable it.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Nfc className="w-6 h-6" style={{ color: '#2563EB' }} />
            RFID Cards
          </h1>
          <p className="text-sm mt-0.5" style={muted}>Manage tap-to-pay cards for your machines</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadCards}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-900"
            style={card_style}
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-900 transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)', boxShadow: '0 2px 12px rgba(37,99,235,0.35)' }}
          >
            <Plus className="w-4 h-4" /> Add Card
          </button>
        </div>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by UID, holder, or machine..."
        className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-900 outline-none"
        style={inputStyle}
      />

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16" style={muted}>Loading cards...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={card_style}>
          <Nfc className="w-12 h-12 mx-auto mb-4" style={{ color: '#94a3b8' }} />
          <p className="font-medium mb-1" style={{ color: '#334155' }}>No RFID cards found</p>
          <p className="text-sm" style={{ color: '#64748b' }}>Register a card to enable tap-to-pay on your machines</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={card_style}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#ffffff' }}>
                  <th className="text-left px-4 py-3 font-medium" style={muted}>UID</th>
                  <th className="text-left px-4 py-3 font-medium" style={muted}>Holder</th>
                  <th className="text-left px-4 py-3 font-medium" style={muted}>Machine</th>
                  <th className="text-left px-4 py-3 font-medium" style={muted}>Type</th>
                  <th className="text-left px-4 py-3 font-medium" style={muted}>Credits / Usage</th>
                  <th className="text-left px-4 py-3 font-medium" style={muted}>Status</th>
                  <th className="text-right px-4 py-3 font-medium" style={muted}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(card => (
                  <tr key={card.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td className="px-4 py-3 font-mono text-slate-900">{card.uid}</td>
                    <td className="px-4 py-3 text-slate-900">{card.holder_name || <span style={muted}>—</span>}</td>
                    <td className="px-4 py-3" style={{ color: '#0f172a' }}>{card.machine?.name || <span style={muted}>—</span>}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                        style={card.card_type === 'postpaid'
                          ? { background: 'rgba(96,165,250,0.12)', color: '#93C5FD', border: '1px solid rgba(96,165,250,0.25)' }
                          : { background: 'rgba(96,165,250,0.12)', color: '#93C5FD', border: '1px solid rgba(96,165,250,0.25)' }}
                      >
                        {card.card_type === 'postpaid' ? 'No limit' : 'Prepaid'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {card.card_type === 'postpaid' ? (
                        <div>
                          <span className="font-semibold" style={{ color: '#FBBF24' }}>{rupees(card.total_spent_paisa)} owed</span>
                          <p className="text-xs mt-0.5" style={muted}>{card.vend_count} vended</p>
                        </div>
                      ) : (
                        <span className="font-semibold" style={{ color: '#43e97b' }}>{card.credits_remaining} credits</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={card.is_active
                          ? { background: 'rgba(67,233,123,0.12)', color: '#43e97b', border: '1px solid rgba(67,233,123,0.25)' }
                          : { background: 'rgba(239,68,68,0.12)', color: '#B91C1C', border: '1px solid rgba(239,68,68,0.22)' }}
                      >
                        {card.is_active ? <CheckCircle2 className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                        {card.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {card.card_type === 'postpaid' ? (
                          <button
                            onClick={() => settleTab(card)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-900"
                            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.28)' }}
                          >
                            <Receipt className="w-3.5 h-3.5" /> Settle Tab
                          </button>
                        ) : (
                          <button
                            onClick={() => { setTopUpId(card.id); setTopUpCredits(''); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-900"
                            style={{ background: 'rgba(124,111,255,0.15)', border: '1px solid rgba(124,111,255,0.28)' }}
                          >
                            <Wallet className="w-3.5 h-3.5" /> Top Up
                          </button>
                        )}
                        <button
                          onClick={() => toggleActive(card)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-900"
                          style={{ background: '#ffffff', border: '1px solid #f1f5f9' }}
                        >
                          {card.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => deleteCard(card)}
                          className="p-1.5 rounded-lg"
                          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)' }}
                        >
                          <Trash2 className="w-3.5 h-3.5" style={{ color: '#B91C1C' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Card Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(5,3,18,0.72)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 my-8" style={{ background: '#1c1937', border: '1px solid #f1f5f9' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Add RFID Card</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5" style={muted} /></button>
            </div>
            <form onSubmit={addCard} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Card UID (hex)</label>
                <input value={newUid} onChange={e => setNewUid(e.target.value)} placeholder="e.g. A1B2C3D4" required
                  className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Holder Name (optional)</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. John Smith"
                  className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Machine</label>
                <select value={newMachineId} onChange={e => setNewMachineId(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 outline-none" style={inputStyle}>
                  {machines.map(m => <option key={m.id} value={m.id} style={{ color: '#111' }}>{m.name} — {m.location}</option>)}
                </select>
                <p className="text-xs mt-1" style={muted}>This card will only work on the machine you select.</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Card Type</label>
                <div className="grid grid-cols-1 gap-2">
                  <label
                    className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
                    style={{ background: '#ffffff', border: newType === 'prepaid' ? '1.5px solid #60A5FA' : '1px solid #f1f5f9' }}
                  >
                    <input type="radio" name="card_type" checked={newType === 'prepaid'} onChange={() => setNewType('prepaid')} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Limited credits</p>
                      <p className="text-xs mt-0.5" style={muted}>Each tap uses 1 credit. Declined once credits run out.</p>
                    </div>
                  </label>
                  <label
                    className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
                    style={{ background: '#ffffff', border: newType === 'postpaid' ? '1.5px solid #60A5FA' : '1px solid #f1f5f9' }}
                  >
                    <input type="radio" name="card_type" checked={newType === 'postpaid'} onChange={() => setNewType('postpaid')} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">No limit</p>
                      <p className="text-xs mt-0.5" style={muted}>No credit check — tracks usage for billing later.</p>
                    </div>
                  </label>
                </div>
              </div>
              {newType === 'prepaid' && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={muted}>Initial Credits (vends)</label>
                  <input type="number" min="0" step="1" value={newCredits} onChange={e => setNewCredits(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 outline-none" style={inputStyle} />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }}>
                  {saving ? 'Adding...' : 'Add Card'}
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-900" style={inputStyle}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top Up Modal */}
      {topUpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,3,18,0.72)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#1c1937', border: '1px solid #f1f5f9' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Top Up Credits</h3>
              <button onClick={() => setTopUpId(null)}><X className="w-5 h-5" style={muted} /></button>
            </div>
            <form onSubmit={submitTopUp} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Credits to add</label>
                <input type="number" min="1" step="1" value={topUpCredits} onChange={e => setTopUpCredits(e.target.value)}
                  autoFocus required
                  className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 outline-none" style={inputStyle} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }}>
                  {saving ? 'Saving...' : 'Add Credits'}
                </button>
                <button type="button" onClick={() => setTopUpId(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-900" style={inputStyle}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
