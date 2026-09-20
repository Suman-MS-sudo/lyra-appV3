'use client';

import { useMemo, useRef, useState } from 'react';
import { Nfc, Plus, RefreshCw, Wallet, Ban, CheckCircle2, Trash2, X, Receipt, Pencil, Upload, Download, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { parseCsv, toCsvBlob } from '@/lib/csv';

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
  machines: { id: string; name: string; location: string }[];
  product: { id: string; name: string; price: string } | null;
  created_at: string;
};

type Organization = { id: string; name: string };
type Machine = { id: string; name: string; location: string; customer_id: string | null };
type Product = { id: string; name: string; price: string };

type ImportRowResult = { row: number; uid: string; status: 'created' | 'error'; error?: string };

const CSV_TEMPLATE_HEADERS = ['uid', 'holder_name', 'card_type', 'initial_credits', 'organization', 'machine', 'product'];
const CSV_TEMPLATE_EXAMPLE = ['A1B2C3D4', 'Jane Doe', 'prepaid', '50', '', '', ''];

const card_style = { background: '#f5f5f7', border: '1px solid #e5e5e7' };
const muted = { color: '#6e6e73' };
const inputStyle = { background: '#f5f5f7', border: '1px solid #e5e5e7' };

function rupees(paisa: number) {
  return `₹${(paisa / 100).toFixed(2)}`;
}

function AssignmentFields({
  organizations, machines, products,
  organizationId, setOrganizationId,
  machineIds, setMachineIds,
  productId, setProductId,
}: {
  organizations: Organization[]; machines: Machine[]; products: Product[];
  organizationId: string; setOrganizationId: (v: string) => void;
  machineIds: string[]; setMachineIds: (v: string[]) => void;
  productId: string; setProductId: (v: string) => void;
}) {
  // Narrow the machine list to the selected org, same convention as MachineForm
  const scopedMachines = organizationId
    ? machines.filter(m => m.customer_id === organizationId)
    : machines;

  function toggleMachine(id: string) {
    setMachineIds(machineIds.includes(id) ? machineIds.filter(m => m !== id) : [...machineIds, id]);
  }

  return (
    <>
      <div>
        <label className="block text-xs font-medium mb-1" style={muted}>Customer / Organization (optional)</label>
        <select value={organizationId} onChange={e => { setOrganizationId(e.target.value); setMachineIds([]); }}
          className="w-full px-3 py-2 rounded-lg text-sm text-[#1d1d1f] outline-none" style={inputStyle}>
          <option value="" style={{ color: '#111' }}>Any / unassigned</option>
          {organizations.map(o => <option key={o.id} value={o.id} style={{ color: '#111' }}>{o.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={muted}>Restrict to Machines (optional)</label>
        {scopedMachines.length === 0 ? (
          <p className="text-xs" style={muted}>No machines to choose from{organizationId ? ' for this customer' : ''}.</p>
        ) : (
          <div className="max-h-40 overflow-y-auto rounded-lg p-2 space-y-1" style={inputStyle}>
            {scopedMachines.map(m => (
              <label key={m.id} className="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer text-sm text-[#1d1d1f]">
                <input type="checkbox" checked={machineIds.includes(m.id)} onChange={() => toggleMachine(m.id)} />
                {m.name} — {m.location}
              </label>
            ))}
          </div>
        )}
        <p className="text-xs mt-1" style={muted}>
          {machineIds.length === 0
            ? organizationId
              ? 'None selected — card works on every machine belonging to this customer.'
              : 'None selected — card works on any machine (admin-wide wildcard).'
            : `Selected ${machineIds.length} machine${machineIds.length === 1 ? '' : 's'} — card works ONLY on ${machineIds.length === 1 ? 'that one' : 'these'}.`}
        </p>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={muted}>Product (optional)</label>
        <select value={productId} onChange={e => setProductId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm text-[#1d1d1f] outline-none" style={inputStyle}>
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
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  const [filterType, setFilterType] = useState<'all' | CardType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterMachineId, setFilterMachineId] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'uid' | 'credits'>('newest');

  const [newUid, setNewUid] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CardType>('prepaid');
  const [newCredits, setNewCredits] = useState('0');
  const [newOrgId, setNewOrgId] = useState('');
  const [newMachineIds, setNewMachineIds] = useState<string[]>([]);
  const [newProductId, setNewProductId] = useState('');

  const [editOrgId, setEditOrgId] = useState('');
  const [editMachineIds, setEditMachineIds] = useState<string[]>([]);
  const [editProductId, setEditProductId] = useState('');
  const [editName, setEditName] = useState('');
  const [editUid, setEditUid] = useState('');

  const [topUpCredits, setTopUpCredits] = useState('');
  const [saving, setSaving] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importParseError, setImportParseError] = useState('');
  const [importResults, setImportResults] = useState<ImportRowResult[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          machine_ids: newMachineIds,
          product_id: newProductId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add card');
      setShowAdd(false);
      setNewUid(''); setNewName(''); setNewCredits('0'); setNewType('prepaid');
      setNewOrgId(''); setNewMachineIds([]); setNewProductId('');
      loadCards();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function downloadCsvTemplate() {
    const blob = toCsvBlob(CSV_TEMPLATE_HEADERS, [CSV_TEMPLATE_EXAMPLE]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rfid-cards-import-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResults(null);
    setImportParseError('');
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { headers, rows } = parseCsv(String(reader.result || ''));
        if (!headers.includes('uid')) {
          setImportParseError('CSV must have a "uid" column header.');
          setImportRows([]);
          return;
        }
        if (rows.length === 0) {
          setImportParseError('No data rows found in this file.');
          setImportRows([]);
          return;
        }
        setImportRows(rows);
      } catch {
        setImportParseError('Could not parse this file as CSV.');
        setImportRows([]);
      }
    };
    reader.readAsText(file);
  }

  async function submitImport() {
    if (importRows.length === 0) return;
    setImporting(true);
    setImportParseError('');
    try {
      const res = await fetch('/api/rfid-cards/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: importRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setImportResults(data.results);
      loadCards();
    } catch (e: any) {
      setImportParseError(e.message);
    } finally {
      setImporting(false);
    }
  }

  function closeImportModal() {
    setShowImport(false);
    setImportFileName('');
    setImportRows([]);
    setImportParseError('');
    setImportResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openEdit(card: RfidCard) {
    setEditCard(card);
    setEditUid(card.uid);
    setEditName(card.holder_name || '');
    setEditOrgId(card.organization_id || '');
    setEditMachineIds(card.machines.map(m => m.id));
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
          machine_ids: editMachineIds,
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

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[]) {
    setSelectedIds(prev => {
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      }
      return new Set([...prev, ...ids]);
    });
  }

  function selectOrg(orgId: string | null) {
    setSelectedOrgId(orgId);
    setSelectedIds(new Set());
    setPage(1);
    setFilterType('all');
    setFilterStatus('all');
    setFilterMachineId('all');
    setSortBy('newest');
  }

  async function bulkDeleteCards(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected card${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    setError('');
    try {
      const res = await fetch('/api/rfid-cards/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete cards');
      setSelectedIds(new Set());
      loadCards();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBulkDeleting(false);
    }
  }

  function openAddForOrg(orgId: string) {
    setNewOrgId(orgId);
    setNewMachineIds([]);
    setNewProductId('');
    setShowAdd(true);
  }

  const filtered = cards.filter(c =>
    c.uid.toLowerCase().includes(search.toLowerCase()) ||
    (c.holder_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.organization?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.machine?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  // All customer tiles come from the full card list, not the search-filtered
  // one -- a search should narrow which cards show up inside a tile you've
  // opened, not make whole customer tiles disappear from the overview.
  const allGroups = useMemo(() => {
    const byOrg = new Map<string, { id: string; name: string; cards: RfidCard[] }>();
    for (const card of cards) {
      const key = card.organization?.id || '__unassigned';
      const name = card.organization?.name || 'Unassigned';
      if (!byOrg.has(key)) byOrg.set(key, { id: key, name, cards: [] });
      byOrg.get(key)!.cards.push(card);
    }
    return Array.from(byOrg.values()).sort((a, b) => {
      if (a.id === '__unassigned') return 1;
      if (b.id === '__unassigned') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [cards]);

  const filteredGroups = useMemo(() => {
    const byOrg = new Map<string, { id: string; name: string; cards: RfidCard[] }>();
    for (const card of filtered) {
      const key = card.organization?.id || '__unassigned';
      const name = card.organization?.name || 'Unassigned';
      if (!byOrg.has(key)) byOrg.set(key, { id: key, name, cards: [] });
      byOrg.get(key)!.cards.push(card);
    }
    return byOrg;
  }, [filtered]);

  const selectedGroup = selectedOrgId
    ? allGroups.find(g => g.id === selectedOrgId) || null
    : null;
  const selectedGroupCardsRaw = selectedOrgId
    ? (filteredGroups.get(selectedOrgId)?.cards || [])
    : [];

  // Machines actually in use within this customer's cards -- narrower and
  // more useful than the full machine list, which may include machines that
  // belong to this org but have no cards assigned yet.
  const groupMachineOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; location: string }>();
    for (const card of selectedGroup?.cards || []) {
      for (const m of card.machines) byId.set(m.id, m);
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedGroup]);

  const selectedGroupCards = useMemo(() => {
    let list = selectedGroupCardsRaw;
    if (filterType !== 'all') list = list.filter(c => c.card_type === filterType);
    if (filterStatus !== 'all') list = list.filter(c => filterStatus === 'active' ? c.is_active : !c.is_active);
    if (filterMachineId === '__any') list = list.filter(c => c.machines.length === 0);
    else if (filterMachineId !== 'all') list = list.filter(c => c.machines.some(m => m.id === filterMachineId));

    const sorted = [...list];
    switch (sortBy) {
      case 'oldest': sorted.sort((a, b) => a.created_at.localeCompare(b.created_at)); break;
      case 'name': sorted.sort((a, b) => (a.holder_name || '').localeCompare(b.holder_name || '')); break;
      case 'uid': sorted.sort((a, b) => a.uid.localeCompare(b.uid)); break;
      case 'credits': sorted.sort((a, b) => b.credits_remaining - a.credits_remaining); break;
      default: sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return sorted;
  }, [selectedGroupCardsRaw, filterType, filterStatus, filterMachineId, sortBy]);

  const filtersActive = filterType !== 'all' || filterStatus !== 'all' || filterMachineId !== 'all';

  function resetFilters() {
    setFilterType('all');
    setFilterStatus('all');
    setFilterMachineId('all');
    setSortBy('newest');
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(selectedGroupCards.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedCards = selectedGroupCards.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allOnPageSelected = pagedCards.length > 0 && pagedCards.every(c => selectedIds.has(c.id));
  const allAcrossPagesSelected = selectedGroupCards.length > 0 && selectedGroupCards.every(c => selectedIds.has(c.id));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          {selectedGroup ? (
            <button
              onClick={() => selectOrg(null)}
              className="flex items-center gap-1.5 text-sm font-medium mb-2"
              style={{ color: '#0071e3' }}
            >
              <ChevronLeft className="w-4 h-4" /> All Customers
            </button>
          ) : null}
          <h1 className="text-2xl font-bold text-[#1d1d1f] flex items-center gap-2">
            {selectedGroup ? (
              <>
                <Building2 className="w-6 h-6" style={{ color: selectedGroup.id === '__unassigned' ? '#a1a1a6' : '#0071e3' }} />
                {selectedGroup.name}
              </>
            ) : (
              <>
                <Nfc className="w-6 h-6" style={{ color: '#0071e3' }} />
                RFID Cards
              </>
            )}
          </h1>
          <p className="text-sm mt-0.5" style={muted}>
            {selectedGroup
              ? `${selectedGroup.cards.length} card${selectedGroup.cards.length === 1 ? '' : 's'} registered to this customer`
              : 'Select a customer to view or manage their RFID tap-to-pay cards'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadCards}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-[#1d1d1f]"
            style={card_style}
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-[#1d1d1f]"
            style={card_style}
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button
            onClick={() => selectedGroup && selectedGroup.id !== '__unassigned' ? openAddForOrg(selectedGroup.id) : setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: '#1d1d1f', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
          >
            <Plus className="w-4 h-4" /> Add Card
          </button>
        </div>
      </div>

      <input
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        placeholder={selectedGroup ? 'Search by UID, holder, or machine...' : 'Search by UID, holder, customer, or machine...'}
        className="w-full px-4 py-2.5 rounded-xl text-sm text-[#1d1d1f] outline-none"
        style={inputStyle}
      />

      {selectedGroup && (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value as any); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm text-[#1d1d1f] outline-none"
            style={inputStyle}
          >
            <option value="all" style={{ color: '#111' }}>All types</option>
            <option value="prepaid" style={{ color: '#111' }}>Prepaid</option>
            <option value="postpaid" style={{ color: '#111' }}>No limit</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value as any); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm text-[#1d1d1f] outline-none"
            style={inputStyle}
          >
            <option value="all" style={{ color: '#111' }}>All statuses</option>
            <option value="active" style={{ color: '#111' }}>Active</option>
            <option value="inactive" style={{ color: '#111' }}>Inactive</option>
          </select>
          <select
            value={filterMachineId}
            onChange={e => { setFilterMachineId(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm text-[#1d1d1f] outline-none"
            style={inputStyle}
          >
            <option value="all" style={{ color: '#111' }}>All machines</option>
            <option value="__any" style={{ color: '#111' }}>Any machine (unrestricted)</option>
            {groupMachineOptions.map(m => (
              <option key={m.id} value={m.id} style={{ color: '#111' }}>{m.name} — {m.location}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-lg text-sm text-[#1d1d1f] outline-none"
            style={inputStyle}
          >
            <option value="newest" style={{ color: '#111' }}>Newest first</option>
            <option value="oldest" style={{ color: '#111' }}>Oldest first</option>
            <option value="name" style={{ color: '#111' }}>Holder name (A–Z)</option>
            <option value="uid" style={{ color: '#111' }}>UID (A–Z)</option>
            <option value="credits" style={{ color: '#111' }}>Credits (high to low)</option>
          </select>
          {filtersActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ color: '#c8102e' }}
            >
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(200,16,46,0.10)', border: '1px solid rgba(200,16,46,0.10)', color: '#c8102e' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16" style={muted}>Loading cards...</div>
      ) : !selectedGroup ? (
        allGroups.length === 0 ? (
          <div className="rounded-2xl p-16 text-center" style={card_style}>
            <Nfc className="w-12 h-12 mx-auto mb-4" style={{ color: '#e5e5e7' }} />
            <p className="font-medium mb-1" style={{ color: '#6e6e73' }}>No RFID cards found</p>
            <p className="text-sm" style={{ color: '#a1a1a6' }}>Register a card to enable RFID payments</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allGroups.map(group => {
              const activeCount = group.cards.filter(c => c.is_active).length;
              const matchesSearch = filteredGroups.has(group.id);
              if (search && !matchesSearch) return null;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => selectOrg(group.id)}
                  className="text-left rounded-2xl p-5 transition-opacity hover:opacity-90"
                  style={card_style}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: group.id === '__unassigned' ? 'rgba(0,0,0,0.05)' : 'rgba(0,113,227,0.10)' }}
                      >
                        <Building2 className="w-5 h-5" style={{ color: group.id === '__unassigned' ? '#a1a1a6' : '#0071e3' }} />
                      </div>
                      <span className="font-semibold text-[#1d1d1f] truncate">{group.name}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0 mt-2.5" style={muted} />
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(0,0,0,0.05)', color: '#6e6e73' }}
                    >
                      {group.cards.length} card{group.cards.length === 1 ? '' : 's'}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(67,233,123,0.12)', color: '#43e97b' }}
                    >
                      <CheckCircle2 className="w-3 h-3" /> {activeCount} active
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : selectedGroupCards.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={card_style}>
          <Nfc className="w-12 h-12 mx-auto mb-4" style={{ color: '#e5e5e7' }} />
          <p className="font-medium mb-1" style={{ color: '#6e6e73' }}>
            {search || filtersActive ? 'No cards match your search/filters' : 'No RFID cards for this customer yet'}
          </p>
          <p className="text-sm" style={{ color: '#a1a1a6' }}>
            {search || filtersActive ? 'Try a different search term or clear the filters' : 'Add a card to enable RFID payments for them'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {selectedIds.size > 0 && (
            <div
              className="flex items-center justify-between flex-wrap gap-2 px-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.18)' }}
            >
              <span style={{ color: '#c8102e' }} className="font-medium">
                {selectedIds.size} card{selectedIds.size === 1 ? '' : 's'} selected
                {allOnPageSelected && !allAcrossPagesSelected && totalPages > 1 && (
                  <>
                    {' — '}
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set(selectedGroupCards.map(c => c.id)))}
                      className="underline font-semibold"
                    >
                      Select all {selectedGroupCards.length} cards across {totalPages} pages
                    </button>
                  </>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#1d1d1f]"
                  style={{ background: '#fff', border: '1px solid #e5e5e7' }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={bulkDeleting}
                  onClick={() => bulkDeleteCards(Array.from(selectedIds))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: '#c8102e' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedIds.size})`}
                </button>
              </div>
            </div>
          )}
          <div className="rounded-2xl overflow-hidden" style={card_style}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f5f5f7' }}>
                  <th className="px-4 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={() => toggleSelectAll(pagedCards.map(c => c.id))}
                    />
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={muted}>UID</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={muted}>Holder</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={muted}>Machine</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={muted}>Product</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={muted}>Type</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={muted}>Credits / Usage</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs" style={muted}>Status</th>
                  <th className="text-right px-4 py-2.5 font-medium text-xs" style={muted}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedCards.map(card => (
                          <tr key={card.id} style={{ borderTop: '1px solid #f5f5f7', background: selectedIds.has(card.id) ? 'rgba(0,113,227,0.04)' : undefined }}>
                            <td className="px-4 py-3">
                              <input type="checkbox" checked={selectedIds.has(card.id)} onChange={() => toggleSelected(card.id)} />
                            </td>
                            <td className="px-4 py-3 font-mono text-[#1d1d1f]">{card.uid}</td>
                            <td className="px-4 py-3 text-[#1d1d1f]">{card.holder_name || <span style={muted}>—</span>}</td>
                            <td className="px-4 py-3" style={{ color: '#1d1d1f' }}>
                              {card.machines.length === 0 ? (
                                <span style={muted}>Any</span>
                              ) : card.machines.length === 1 ? (
                                card.machines[0].name
                              ) : (
                                <span title={card.machines.map(m => m.name).join(', ')}>{card.machines.length} machines</span>
                              )}
                            </td>
                            <td className="px-4 py-3" style={{ color: '#1d1d1f' }}>{card.product?.name || <span style={muted}>Default</span>}</td>
                            <td className="px-4 py-3">
                              <span
                                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                                style={card.card_type === 'postpaid'
                                  ? { background: 'rgba(0,113,227,0.10)', color: '#93C5FD', border: '1px solid rgba(0,113,227,0.10)' }
                                  : { background: 'rgba(0,0,0,0.04)', color: '#6e6e73', border: '1px solid rgba(0,0,0,0.04)' }}
                              >
                                {card.card_type === 'postpaid' ? 'No limit' : 'Prepaid'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {card.card_type === 'postpaid' ? (
                                <div>
                                  <span className="font-semibold" style={{ color: '#9a6400' }}>{rupees(card.total_spent_paisa)} owed</span>
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
                                  : { background: 'rgba(200,16,46,0.10)', color: '#c8102e', border: '1px solid rgba(200,16,46,0.10)' }}
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
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#1d1d1f]"
                                    style={{ background: 'rgba(154,100,0,0.12)', border: '1px solid rgba(154,100,0,0.12)' }}
                                  >
                                    <Receipt className="w-3.5 h-3.5" /> Settle Tab
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => { setTopUpId(card.id); setTopUpCredits(''); }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#1d1d1f]"
                                    style={{ background: 'rgba(124,111,255,0.15)', border: '1px solid rgba(124,111,255,0.28)' }}
                                  >
                                    <Wallet className="w-3.5 h-3.5" /> Top Up
                                  </button>
                                )}
                                <button
                                  onClick={() => openEdit(card)}
                                  className="p-1.5 rounded-lg"
                                  style={{ background: '#f5f5f7', border: '1px solid #e5e5e7' }}
                                >
                                  <Pencil className="w-3.5 h-3.5 text-[#1d1d1f]" />
                                </button>
                                <button
                                  onClick={() => toggleActive(card)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#1d1d1f]"
                                  style={{ background: '#f5f5f7', border: '1px solid #e5e5e7' }}
                                >
                                  {card.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  onClick={() => deleteCard(card)}
                                  className="p-1.5 rounded-lg"
                                  style={{ background: 'rgba(200,16,46,0.10)', border: '1px solid rgba(200,16,46,0.10)' }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" style={{ color: '#c8102e' }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between flex-wrap gap-2 px-1">
              <p className="text-xs" style={muted}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, selectedGroupCards.length)} of {selectedGroupCards.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#1d1d1f] disabled:opacity-40"
                  style={card_style}
                >
                  Previous
                </button>
                <span className="text-xs" style={muted}>Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#1d1d1f] disabled:opacity-40"
                  style={card_style}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Card Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(5,3,18,0.72)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 my-8" style={{ background: '#1c1937', border: '1px solid #e5e5e7' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1d1d1f]">Add RFID Card</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5" style={muted} /></button>
            </div>
            <form onSubmit={addCard} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Card UID (hex)</label>
                <input value={newUid} onChange={e => setNewUid(e.target.value)} placeholder="e.g. A1B2C3D4" required
                  className="w-full px-3 py-2 rounded-lg text-sm text-[#1d1d1f] outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Holder Name (optional)</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. John Smith"
                  className="w-full px-3 py-2 rounded-lg text-sm text-[#1d1d1f] outline-none" style={inputStyle} />
              </div>

              <AssignmentFields
                organizations={organizations} machines={machines} products={products}
                organizationId={newOrgId} setOrganizationId={setNewOrgId}
                machineIds={newMachineIds} setMachineIds={setNewMachineIds}
                productId={newProductId} setProductId={setNewProductId}
              />

              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Card Type</label>
                <div className="grid grid-cols-1 gap-2">
                  <label
                    className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
                    style={{ background: '#f5f5f7', border: newType === 'prepaid' ? '1.5px solid #6e6e73' : '1px solid #e5e5e7' }}
                  >
                    <input type="radio" name="card_type" checked={newType === 'prepaid'} onChange={() => setNewType('prepaid')} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-[#1d1d1f]">Limited credits</p>
                      <p className="text-xs mt-0.5" style={muted}>Each tap uses 1 credit, regardless of product price. Declined once credits run out.</p>
                    </div>
                  </label>
                  <label
                    className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
                    style={{ background: '#f5f5f7', border: newType === 'postpaid' ? '1.5px solid #0071e3' : '1px solid #e5e5e7' }}
                  >
                    <input type="radio" name="card_type" checked={newType === 'postpaid'} onChange={() => setNewType('postpaid')} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-[#1d1d1f]">No limit</p>
                      <p className="text-xs mt-0.5" style={muted}>No balance check — every tap dispenses. Tracks how many napkins were vended and the total cost, for billing later.</p>
                    </div>
                  </label>
                </div>
              </div>
              {newType === 'prepaid' && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={muted}>Initial Credits (vends)</label>
                  <input type="number" min="0" step="1" value={newCredits} onChange={e => setNewCredits(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-[#1d1d1f] outline-none" style={inputStyle} />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: '#1d1d1f' }}>
                  {saving ? 'Adding...' : 'Add Card'}
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#1d1d1f]" style={inputStyle}>
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
          <div className="w-full max-w-md rounded-2xl p-6 my-8" style={{ background: '#1c1937', border: '1px solid #e5e5e7' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1d1d1f]">Edit Card {editCard.uid}</h3>
              <button onClick={() => setEditCard(null)}><X className="w-5 h-5" style={muted} /></button>
            </div>
            <form onSubmit={submitEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Card UID (hex)</label>
                <input value={editUid} onChange={e => setEditUid(e.target.value)} required
                  className="w-full px-3 py-2 rounded-lg text-sm text-[#1d1d1f] outline-none font-mono" style={inputStyle} />
                <p className="text-xs mt-1" style={muted}>Only change this if the card was registered with the wrong UID — it must match what the reader scans.</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Holder Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm text-[#1d1d1f] outline-none" style={inputStyle} />
              </div>
              <AssignmentFields
                organizations={organizations} machines={machines} products={products}
                organizationId={editOrgId} setOrganizationId={setEditOrgId}
                machineIds={editMachineIds} setMachineIds={setEditMachineIds}
                productId={editProductId} setProductId={setEditProductId}
              />
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: '#1d1d1f' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditCard(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#1d1d1f]" style={inputStyle}>
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
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#1c1937', border: '1px solid #e5e5e7' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1d1d1f]">Top Up Credits</h3>
              <button onClick={() => setTopUpId(null)}><X className="w-5 h-5" style={muted} /></button>
            </div>
            <form onSubmit={submitTopUp} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={muted}>Credits to add</label>
                <input type="number" min="1" step="1" value={topUpCredits} onChange={e => setTopUpCredits(e.target.value)}
                  autoFocus required
                  className="w-full px-3 py-2 rounded-lg text-sm text-[#1d1d1f] outline-none" style={inputStyle} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: '#1d1d1f' }}>
                  {saving ? 'Saving...' : 'Add Credits'}
                </button>
                <button type="button" onClick={() => setTopUpId(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#1d1d1f]" style={inputStyle}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(5,3,18,0.72)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 my-8" style={{ background: '#1c1937', border: '1px solid #e5e5e7' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1d1d1f]">Import RFID Cards from CSV</h3>
              <button onClick={closeImportModal}><X className="w-5 h-5" style={muted} /></button>
            </div>

            {!importResults ? (
              <div className="space-y-3">
                <p className="text-sm" style={{ color: '#1d1d1f' }}>
                  Upload a CSV to register many cards at once — one row per employee. Only <span className="font-mono">uid</span> is required;
                  everything else is optional and defaults the same way as adding a card by hand.
                </p>
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#1d1d1f]"
                  style={inputStyle}
                >
                  <Download className="w-4 h-4" /> Download CSV template
                </button>
                <div>
                  <label className="block text-xs font-medium mb-1" style={muted}>CSV file</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleImportFile}
                    className="w-full text-sm text-[#1d1d1f] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:text-[#1d1d1f]"
                    style={{ ...inputStyle, padding: '0.5rem' }}
                  />
                  <p className="text-xs mt-1" style={muted}>
                    Columns: uid (required), holder_name, card_type (prepaid/postpaid), initial_credits, organization, machine, product.
                    Organization/machine/product are matched by exact name — leave blank to leave a card unassigned.
                  </p>
                  <p className="text-xs mt-1" style={muted}>
                    An existing employee-roster sheet works too — &quot;name&quot; and &quot;tag no&quot; are accepted in place of holder_name/uid,
                    and the tag can be formatted like <span className="font-mono">aa:bb:CC;DD</span> (separators are stripped automatically).
                    Any other columns (employee code, department, date of joining, etc.) are ignored, not an error.
                  </p>
                </div>

                {importParseError && (
                  <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(200,16,46,0.10)', border: '1px solid rgba(200,16,46,0.10)', color: '#c8102e' }}>
                    {importParseError}
                  </div>
                )}

                {importFileName && importRows.length > 0 && !importParseError && (
                  <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(67,233,123,0.10)', border: '1px solid rgba(67,233,123,0.22)', color: '#43e97b' }}>
                    {importFileName}: {importRows.length} row{importRows.length === 1 ? '' : 's'} ready to import.
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={importRows.length === 0 || importing}
                    onClick={submitImport}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: '#1d1d1f' }}
                  >
                    {importing ? 'Importing...' : `Import ${importRows.length || ''} Card${importRows.length === 1 ? '' : 's'}`}
                  </button>
                  <button type="button" onClick={closeImportModal}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#1d1d1f]" style={inputStyle}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 px-3 py-2 rounded-lg text-center" style={{ background: 'rgba(67,233,123,0.10)', border: '1px solid rgba(67,233,123,0.22)' }}>
                    <p className="text-xl font-bold" style={{ color: '#43e97b' }}>
                      {importResults.filter(r => r.status === 'created').length}
                    </p>
                    <p className="text-xs" style={muted}>Created</p>
                  </div>
                  <div className="flex-1 px-3 py-2 rounded-lg text-center" style={{ background: 'rgba(200,16,46,0.10)', border: '1px solid rgba(200,16,46,0.10)' }}>
                    <p className="text-xl font-bold" style={{ color: '#c8102e' }}>
                      {importResults.filter(r => r.status === 'error').length}
                    </p>
                    <p className="text-xs" style={muted}>Failed</p>
                  </div>
                </div>

                {importResults.some(r => r.status === 'error') && (
                  <div className="max-h-64 overflow-y-auto rounded-lg" style={{ border: '1px solid #e5e5e7' }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: '#f5f5f7' }}>
                          <th className="text-left px-3 py-2 font-medium" style={muted}>Row</th>
                          <th className="text-left px-3 py-2 font-medium" style={muted}>UID</th>
                          <th className="text-left px-3 py-2 font-medium" style={muted}>Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.filter(r => r.status === 'error').map(r => (
                          <tr key={r.row} style={{ borderTop: '1px solid #f5f5f7' }}>
                            <td className="px-3 py-2" style={muted}>{r.row}</td>
                            <td className="px-3 py-2 font-mono text-[#1d1d1f]">{r.uid || '—'}</td>
                            <td className="px-3 py-2" style={{ color: '#c8102e' }}>{r.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <button type="button" onClick={closeImportModal}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
                  style={{ background: '#1d1d1f' }}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
