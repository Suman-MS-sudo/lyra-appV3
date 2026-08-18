'use client';

import { useState } from 'react';
import { Nfc, Plus, RefreshCw, Wallet, Ban, CheckCircle2, Trash2, X, Receipt, Pencil } from 'lucide-react';

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
  organization_id: string | null;
  machine_id: string | null;
  product_id: string | null;
  organization: { id: string; name: string } | null;
  machine: { id: string; name: string; location: string } | null;
  product: { id: string; name: string; price: string } | null;
  created_at: string;
};

type Organization = { id: string; name: string };
type Machine = { id: string; name: string; location: string; customer_id: string | null };
type Product = { id: string; name: string; price: string };

const card_style = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' };
const muted = { color: 'rgba(255,255,255,0.45)' };
const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' };

function rupees(paisa: number) {
  return `₹${(paisa / 100).toFixed(2)}`;
}

function AssignmentFields({
  organizations, machines, products,
  organizationId, setOrganizationId,
  machineId, setMachineId,
  productId, setProductId,
}: {
  organizations: Organization[]; machines: Machine[]; products: Product[];
  organizationId: string; setOrganizationId: (v: string) => void;
  machineId: string; setMachineId: (v: string) => void;
  productId: string; setProductId: (v: string) => void;
}) {
  // Narrow the machine list to the selected org, same convention as MachineForm
  const scopedMachines = organizationId
    ? machines.filter(m => m.customer_id === organizationId)
    : machines;

  return (
    <>
      <div>
        <label className="block text-xs font-medium mb-1" style={muted}>Customer / Organization (optional)</label>
        <select value={organizationId} onChange={e => { setOrganizationId(e.target.value); setMachineId(''); }}
          className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputStyle}>
          <option value="" style={{ color: '#111' }}>Any / unassigned</option>
          {organizations.map(o => <option key={o.id} value={o.id} style={{ color: '#111' }}>{o.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={muted}>Restrict to Machine (optional)</label>
        <select value={machineId} onChange={e => setMachineId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputStyle}>
          <option value="" style={{ color: '#111' }}>Any machine</option>
          {scopedMachines.map(m => <option key={m.id} value={m.id} style={{ color: '#111' }}>{m.name} — {m.location}</option>)}
        </select>
        <p className="text-xs mt-1" style={muted}>Leave as &quot;Any machine&quot; unless this card should only work on one specific machine.</p>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={muted}>Product (optional)</label>
        <select value={productId} onChange={e => setProductId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputStyle}>
          <option value="" style={{ color: '#111' }}>Machine&apos;s default product</option>
          {products.map(p => <option key={p.id} value={p.id} style={{ color: '#111' }}>{p.name} — ₹{p.price}</option>)}
        </select>
        <p className="text-xs mt-1" style={muted}>Overrides which product is charged/dispensed on tap.</p>
      </div>
    </>
  );
}

export default function RfidCardsClient({
  initialCards, organizations, machines, products,
}: {
  initialCards: RfidCard[]; organizations: Organization[]; machines: Machine[]; products: Product[];
}) {
  const [cards, setCards] = useState<RfidCard[]>(initialCards);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editCard, setEditCard] = useState<RfidCard | null>(null);
  const [topUpId, setTopUpId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [newUid, setNewUid] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CardType>('prepaid');
  const [newCredits, setNewCredits] = useState('0');
  const [newOrgId, setNewOrgId] = useState('');
  const [newMachineId, setNewMachineId] = useState('');
  const [newProductId, setNewProductId] = useState('');

  const [editOrgId, setEditOrgId] = useState('');
  const [editMachineId, setEditMachineId] = useState('');
  const [editProductId, setEditProductId] = useState('');
  const [editName, setEditName] = useState('');
  const [editUid, setEditUid] = useState('');

  const [topUpCredits, setTopUpCredits] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadCards() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rfid-cards');
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
    if (!newUid.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/rfid-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: newUid.trim(),
          holder_name: newName.trim() || null,
          card_type: newType,
          initial_credits: newType === 'prepaid' ? (parseInt(newCredits, 10) || 0) : 0,
          organization_id: newOrgId || null,
          machine_id: newMachineId || null,
          product_id: newProductId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add card');
      setShowAdd(false);
      setNewUid(''); setNewName(''); setNewCredits('0'); setNewType('prepaid');
      setNewOrgId(''); setNewMachineId(''); setNewProductId('');
      loadCards();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(card: RfidCard) {
    setEditCard(card);
    setEditUid(card.uid);
    setEditName(card.holder_name || '');
    setEditOrgId(card.organization_id || '');
    setEditMachineId(card.machine_id || '');
    setEditProductId(card.product_id || '');
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editCard) return;
    if (!editUid.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/rfid-cards/${editCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: editUid.trim(),
          holder_name: editName.trim() || null,
          organization_id: editOrgId || null,
          machine_id: editMachineId || null,
          product_id: editProductId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save changes');
      setEditCard(null);
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
      const res = await fetch(`/api/rfid-cards/${topUpId}`, {
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
    await fetch(`/api/rfid-cards/${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settle_tab: true }),
    });
    loadCards();
  }

  async function toggleActive(card: RfidCard) {
    await fetch(`/api/rfid-cards/${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !card.is_active }),
    });
    loadCards();
  }

  async function deleteCard(card: RfidCard) {
    if (!confirm(`Delete card ${card.uid}? This cannot be undone.`)) return;
    await fetch(`/api/rfid-cards/${card.id}`, { method: 'DELETE' });
    loadCards();
  }

  const filtered = cards.filter(c =>
    c.uid.toLowerCase().includes(search.toLowerCase()) ||
    (c.holder_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.organization?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.machine?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Nfc className="w-6 h-6" style={{ color: '#F472B6' }} />
            RFID Cards
          </h1>
          <p className="text-sm mt-0.5" style={muted}>Manage credit-limited and no-limit RFID tap-to-pay cards</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadCards}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white"
            style={card_style}
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 2px 12px rgba(244,63,94,0.35)' }}
          >
            <Plus className="w-4 h-4" /> Add Card
          </button>
        </div>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by UID, holder, customer, or machine..."
        className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
        style={inputStyle}
      />

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#FCA5A5' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16" style={muted}>Loading cards...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={card_style}>
          <Nfc className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.15)' }} />
          <p className="font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>No RFID cards found</p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>Register a card to enable RFID payments</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={card_style}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th className="text-left px-4 py-3 font-medium" style={muted}>UID</th>
                  <th className="text-left px-4 py-3 font-medium" style={muted}>Holder</th>
                  <th className="text-left px-4 py-3 font-medium" style={muted}>Customer</th>
                  <th className="text-left px-4 py-3 font-medium" style={muted}>Machine</th>
                  <th className="text-left px-4 py-3 font-medium" style={muted}>Product</th>
                  <th className="text-left px-4 py-3 font-medium" style={muted}>Type</th>
                  <th className="text-left px-4 py-3 font-medium" style={muted}>Credits / Usage</th>
                  <th className="text-left px-4 py-3 font-medium" style={muted}>Status</th>
                  <th className="text-right px-4 py-3 font-medium" style={muted}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(card => (
                  <tr key={card.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <td className="px-4 py-3 font-mono text-white">{card.uid}</td>
                    <td className="px-4 py-3 text-white">{card.holder_name || <span style={muted}>—</span>}</td>
                    <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.7)' }}>{card.organization?.name || <span style={muted}>Any</span>}</td>
                    <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.7)' }}>{card.machine?.name || <span style={muted}>Any</span>}</td>
                    <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.7)' }}>{card.product?.name || <span style={muted}>Default</span>}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                        style={card.card_type === 'postpaid'
                          ? { background: 'rgba(96,165,250,0.12)', color: '#93C5FD', border: '1px solid rgba(96,165,250,0.25)' }
                          : { background: 'rgba(167,139,250,0.12)', color: '#C4B5FD', border: '1px solid rgba(167,139,250,0.25)' }}
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
                          : { background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.22)' }}
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
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.28)' }}
                          >
                            <Receipt className="w-3.5 h-3.5" /> Settle Tab
                          </button>
                        ) : (
                          <button
                            onClick={() => { setTopUpId(card.id); setTopUpCredits(''); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                            style={{ background: 'rgba(124,111,255,0.15)', border: '1px solid rgba(124,111,255,0.28)' }}
                          >
                            <Wallet className="w-3.5 h-3.5" /> Top Up
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(card)}
                          className="p-1.5 rounded-lg"
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
                        >
                          <Pencil className="w-3.5 h-3.5 text-white" />
                        </button>
                        <button
                          onClick={() => toggleActive(card)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
                        >
                          {card.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => deleteCard(card)}
                          className="p-1.5 rounded-lg"
                          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)' }}
                        >
                          <Trash2 className="w-3.5 h-3.5" style={{ color: '#FCA5A5' }} />
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
          <div className="w-full max-w-md rounded-2xl p-6 my-8" style={{ background: '#1c1937', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Add RFID Card</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5" style={muted} /></button>
            </div>
            <form onSubmit={addCard} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Card UID (hex)</label>
                <input value={newUid} onChange={e => setNewUid(e.target.value)} placeholder="e.g. A1B2C3D4" required
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Holder Name (optional)</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. John Smith"
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputStyle} />
              </div>

              <AssignmentFields
                organizations={organizations} machines={machines} products={products}
                organizationId={newOrgId} setOrganizationId={setNewOrgId}
                machineId={newMachineId} setMachineId={setNewMachineId}
                productId={newProductId} setProductId={setNewProductId}
              />

              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Card Type</label>
                <div className="grid grid-cols-1 gap-2">
                  <label
                    className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.05)', border: newType === 'prepaid' ? '1.5px solid #A78BFA' : '1px solid rgba(255,255,255,0.10)' }}
                  >
                    <input type="radio" name="card_type" checked={newType === 'prepaid'} onChange={() => setNewType('prepaid')} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-white">Limited credits</p>
                      <p className="text-xs mt-0.5" style={muted}>Each tap uses 1 credit, regardless of product price. Declined once credits run out.</p>
                    </div>
                  </label>
                  <label
                    className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.05)', border: newType === 'postpaid' ? '1.5px solid #60A5FA' : '1px solid rgba(255,255,255,0.10)' }}
                  >
                    <input type="radio" name="card_type" checked={newType === 'postpaid'} onChange={() => setNewType('postpaid')} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-white">No limit</p>
                      <p className="text-xs mt-0.5" style={muted}>No balance check — every tap dispenses. Tracks how many napkins were vended and the total cost, for billing later.</p>
                    </div>
                  </label>
                </div>
              </div>
              {newType === 'prepaid' && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={muted}>Initial Credits (vends)</label>
                  <input type="number" min="0" step="1" value={newCredits} onChange={e => setNewCredits(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputStyle} />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)' }}>
                  {saving ? 'Adding...' : 'Add Card'}
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-white" style={inputStyle}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Card Modal */}
      {editCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(5,3,18,0.72)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 my-8" style={{ background: '#1c1937', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Edit Card {editCard.uid}</h3>
              <button onClick={() => setEditCard(null)}><X className="w-5 h-5" style={muted} /></button>
            </div>
            <form onSubmit={submitEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Card UID (hex)</label>
                <input value={editUid} onChange={e => setEditUid(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none font-mono" style={inputStyle} />
                <p className="text-xs mt-1" style={muted}>Only change this if the card was registered with the wrong UID — it must match what the reader scans.</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Holder Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputStyle} />
              </div>
              <AssignmentFields
                organizations={organizations} machines={machines} products={products}
                organizationId={editOrgId} setOrganizationId={setEditOrgId}
                machineId={editMachineId} setMachineId={setEditMachineId}
                productId={editProductId} setProductId={setEditProductId}
              />
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditCard(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-white" style={inputStyle}>
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
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#1c1937', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Top Up Credits</h3>
              <button onClick={() => setTopUpId(null)}><X className="w-5 h-5" style={muted} /></button>
            </div>
            <form onSubmit={submitTopUp} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Credits to add</label>
                <input type="number" min="1" step="1" value={topUpCredits} onChange={e => setTopUpCredits(e.target.value)}
                  autoFocus required
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none" style={inputStyle} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)' }}>
                  {saving ? 'Saving...' : 'Add Credits'}
                </button>
                <button type="button" onClick={() => setTopUpId(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-white" style={inputStyle}>
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
