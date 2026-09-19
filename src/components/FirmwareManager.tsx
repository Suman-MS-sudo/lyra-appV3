'use client';

import { useState, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Rocket, RefreshCw, CheckCircle2, XCircle, Clock, Download, LucideIcon, Search, Circle, Archive, ArchiveRestore, Trash2, History, Undo2, ChevronDown, ChevronUp } from 'lucide-react';

interface FirmwareVersion {
  id: string;
  version: string;
  filename: string;
  sha256: string;
  size_bytes: number;
  notes: string | null;
  created_at: string;
  archived_at: string | null;
  compatible_body_type: 'single_motor' | 'single_motor_35' | 'quad_motor' | null;
}

interface Machine {
  id: string;
  name: string;
  machine_id: string;
  customer_name: string | null;
  body_type: string | null;
  asset_online: boolean;
  last_ping: string | null;
  firmware_version: string | null;
  last_firmware_update: string | null;
}

interface DeploymentMachine {
  id: string;
  name: string;
  machine_id: string;
}

interface Deployment {
  id: string;
  status: 'pending' | 'downloading' | 'applied' | 'failed';
  error_message: string | null;
  requested_at: string;
  applied_at: string | null;
  updated_at: string;
  firmware_version_id: string;
  vending_machines: DeploymentMachine | DeploymentMachine[] | null;
}

function machineOf(d: Deployment): DeploymentMachine | null {
  if (!d.vending_machines) return null;
  return Array.isArray(d.vending_machines) ? d.vending_machines[0] ?? null : d.vending_machines;
}

function extractError(data: unknown, fallback: string): { message: string; code: string | null } {
  if (!data || typeof data !== 'object') return { message: fallback, code: null };
  const { error } = data as { error?: unknown };
  if (typeof error === 'string') return { message: error, code: null };
  if (error && typeof error === 'object') {
    const message = typeof (error as { message?: unknown }).message === 'string' ? (error as { message: string }).message : fallback;
    const code = typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : null;
    return { message, code };
  }
  return { message: fallback, code: null };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatRelative(dateString: string | null): string {
  if (!dateString) return 'Never';
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const STATUS_STYLES: Record<Deployment['status'], { bg: string; color: string; icon: LucideIcon; label: string }> = {
  pending: { bg: '#fff4e5', color: '#b06a00', icon: Clock, label: 'Pending' },
  downloading: { bg: '#e5f1ff', color: '#0066cc', icon: Download, label: 'Downloading' },
  applied: { bg: '#e6f9ed', color: '#1a7f37', icon: CheckCircle2, label: 'Applied' },
  failed: { bg: '#fbe9e9', color: '#c8102e', icon: XCircle, label: 'Failed' },
};

function StatusBadge({ status }: { status: Deployment['status'] }) {
  const s = STATUS_STYLES[status];
  const Icon = s.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

const SELECT_STYLE: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e5e7',
  color: '#1d1d1f',
  borderRadius: 10,
};

const ALL = '__all__';

export default function FirmwareManager({
  versions,
  machines,
  deployments,
}: {
  versions: FirmwareVersion[];
  machines: Machine[];
  deployments: Deployment[];
}) {
  const router = useRouter();

  // ── Upload ──────────────────────────────────────────────
  const [uploadVersion, setUploadVersion] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // ── Machine list filters ────────────────────────────────
  const [search, setSearch] = useState('');
  const [versionFilter, setVersionFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [bodyTypeFilter, setBodyTypeFilter] = useState(ALL);
  const [selectedMachineIds, setSelectedMachineIds] = useState<Set<string>>(new Set());

  // ── Push update ─────────────────────────────────────────
  const [pushVersionId, setPushVersionId] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState('');
  const [deployForceable, setDeployForceable] = useState(false);

  // ── Version management (archive/compat tag/delete) ──────
  const [busyVersionIds, setBusyVersionIds] = useState<Set<string>>(new Set());
  const [versionActionError, setVersionActionError] = useState('');

  // ── Per-machine history + rollback ───────────────────────
  const [expandedMachineId, setExpandedMachineId] = useState<string | null>(null);
  const [rollingBackMachineId, setRollingBackMachineId] = useState<string | null>(null);
  const [rollbackError, setRollbackError] = useState('');

  const [refreshing, setRefreshing] = useState(false);

  const knownVersions = useMemo(
    () => Array.from(new Set(machines.map((m) => m.firmware_version || 'Unknown'))).sort(),
    [machines]
  );
  const knownBodyTypes = useMemo(
    () => Array.from(new Set(machines.map((m) => m.body_type || 'Unknown'))).sort(),
    [machines]
  );
  // Archived versions have already been pushed at least once historically
  // (that's typically why they get archived rather than deleted), but they
  // shouldn't be offered for new deployments -- that's the point of
  // archiving vs. deleting.
  const deployableVersions = useMemo(() => versions.filter((v) => !v.archived_at), [versions]);

  const filteredMachines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return machines.filter((m) => {
      if (q && !(`${m.name} ${m.machine_id} ${m.customer_name || ''}`.toLowerCase().includes(q))) return false;
      if (versionFilter !== ALL && (m.firmware_version || 'Unknown') !== versionFilter) return false;
      if (statusFilter === 'online' && !m.asset_online) return false;
      if (statusFilter === 'offline' && m.asset_online) return false;
      if (bodyTypeFilter !== ALL && (m.body_type || 'Unknown') !== bodyTypeFilter) return false;
      return true;
    });
  }, [machines, search, versionFilter, statusFilter, bodyTypeFilter]);

  const allFilteredSelected = filteredMachines.length > 0 && filteredMachines.every((m) => selectedMachineIds.has(m.id));

  const toggleMachine = (id: string) => {
    setSelectedMachineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedMachineIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredMachines.forEach((m) => next.delete(m.id));
        return next;
      }
      const next = new Set(prev);
      filteredMachines.forEach((m) => next.add(m.id));
      return next;
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('version', uploadVersion);
      formData.append('notes', uploadNotes);
      formData.append('file', uploadFile);

      const response = await fetch('/api/firmware/upload', { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(extractError(data, 'Upload failed').message);

      setUploadVersion('');
      setUploadNotes('');
      setUploadFile(null);
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const handlePush = async (force = false) => {
    if (!pushVersionId || selectedMachineIds.size === 0) return;
    setDeploying(true);
    setDeployError('');
    setDeployForceable(false);

    try {
      const response = await fetch('/api/firmware/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmware_version_id: pushVersionId,
          machine_ids: Array.from(selectedMachineIds),
          force,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const { message, code } = extractError(data, 'Deploy failed');
        if (code === 'INCOMPATIBLE_BODY_TYPE') setDeployForceable(true);
        throw new Error(message);
      }

      setSelectedMachineIds(new Set());
      router.refresh();
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeploying(false);
    }
  };

  const withVersionBusy = async (versionId: string, action: () => Promise<void>) => {
    setBusyVersionIds((prev) => new Set(prev).add(versionId));
    setVersionActionError('');
    try {
      await action();
      router.refresh();
    } catch (err) {
      setVersionActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyVersionIds((prev) => {
        const next = new Set(prev);
        next.delete(versionId);
        return next;
      });
    }
  };

  const handleToggleArchive = (v: FirmwareVersion) =>
    withVersionBusy(v.id, async () => {
      const response = await fetch(`/api/firmware/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !v.archived_at }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(extractError(data, 'Failed to update archive status').message);
    });

  const handleCompatibilityChange = (v: FirmwareVersion, value: string) =>
    withVersionBusy(v.id, async () => {
      const response = await fetch(`/api/firmware/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compatible_body_type: value === ALL ? null : value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(extractError(data, 'Failed to update compatibility tag').message);
    });

  const handleDeleteVersion = (v: FirmwareVersion) => {
    if (!confirm(`Permanently delete firmware ${v.version}? This cannot be undone.`)) return;
    withVersionBusy(v.id, async () => {
      const response = await fetch(`/api/firmware/${v.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(extractError(data, 'Failed to delete firmware version').message);
    });
  };

  const handleRollback = async (machine: Machine) => {
    if (!confirm(`Roll back ${machine.name} to its previous firmware version?`)) return;
    setRollingBackMachineId(machine.id);
    setRollbackError('');
    try {
      const response = await fetch('/api/firmware/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machine_id: machine.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(extractError(data, 'Rollback failed').message);
      router.refresh();
    } catch (err) {
      setRollbackError(err instanceof Error ? err.message : String(err));
    } finally {
      setRollingBackMachineId(null);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <div className="space-y-6">
      {/* Machine list: filter + select + push */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e5e5e7' }}>
        <div className="p-4 flex flex-wrap gap-2 items-center" style={{ background: '#f5f5f7', borderBottom: '1px solid #e5e5e7' }}>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a1a1a6' }} />
            <input
              type="text"
              placeholder="Search name, ID, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg"
              style={SELECT_STYLE}
            />
          </div>
          <select value={versionFilter} onChange={(e) => setVersionFilter(e.target.value)} className="px-2 py-1.5 text-sm" style={SELECT_STYLE}>
            <option value={ALL}>All firmware versions</option>
            {knownVersions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-2 py-1.5 text-sm" style={SELECT_STYLE}>
            <option value={ALL}>All statuses</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
          <select value={bodyTypeFilter} onChange={(e) => setBodyTypeFilter(e.target.value)} className="px-2 py-1.5 text-sm" style={SELECT_STYLE}>
            <option value={ALL}>All body types</option>
            {knownBodyTypes.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <span className="text-xs ml-auto" style={{ color: '#6e6e73' }}>
            {filteredMachines.length} of {machines.length} machines
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th className="px-4 py-2.5 text-left">
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} />
                </th>
                <th className="text-left px-2 py-2.5 font-medium text-[#6e6e73]">Machine</th>
                <th className="text-left px-2 py-2.5 font-medium text-[#6e6e73]">Customer</th>
                <th className="text-left px-2 py-2.5 font-medium text-[#6e6e73]">Body type</th>
                <th className="text-left px-2 py-2.5 font-medium text-[#6e6e73]">Status</th>
                <th className="text-left px-2 py-2.5 font-medium text-[#6e6e73]">Firmware</th>
                <th className="text-left px-2 py-2.5 font-medium text-[#6e6e73]">Last update</th>
                <th className="text-left px-2 py-2.5 font-medium text-[#6e6e73]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMachines.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-[#a1a1a6]">No machines match these filters</td></tr>
              )}
              {filteredMachines.map((m) => {
                const machineDeployments = deployments
                  .filter((d) => machineOf(d)?.id === m.id)
                  .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
                const appliedCount = machineDeployments.filter((d) => d.status === 'applied').length;
                const isExpanded = expandedMachineId === m.id;

                return (
                  <Fragment key={m.id}>
                    <tr
                      className="border-t cursor-pointer hover:bg-[#fafafa]"
                      style={{ borderColor: '#e5e5e7' }}
                      onClick={() => toggleMachine(m.id)}
                    >
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedMachineIds.has(m.id)} onChange={() => toggleMachine(m.id)} />
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="font-medium text-[#1d1d1f]">{m.name}</div>
                        <div className="text-xs" style={{ color: '#a1a1a6' }}>{m.machine_id}</div>
                      </td>
                      <td className="px-2 py-2.5 text-[#6e6e73]">{m.customer_name || '—'}</td>
                      <td className="px-2 py-2.5 text-[#6e6e73]">{m.body_type || '—'}</td>
                      <td className="px-2 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: m.asset_online ? '#1a7f37' : '#a1a1a6' }}>
                          <Circle className="w-2 h-2" fill="currentColor" />
                          {m.asset_online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-[#1d1d1f]">{m.firmware_version || <span style={{ color: '#a1a1a6' }}>Unknown</span>}</td>
                      <td className="px-2 py-2.5 text-[#6e6e73]">{formatRelative(m.last_firmware_update)}</td>
                      <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedMachineId(isExpanded ? null : m.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium"
                            style={{ color: '#6e6e73' }}
                            title="Deployment history"
                          >
                            <History className="w-3.5 h-3.5" />
                            {machineDeployments.length}
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => handleRollback(m)}
                            disabled={appliedCount < 2 || rollingBackMachineId === m.id}
                            className="inline-flex items-center gap-1 text-xs font-medium disabled:opacity-30"
                            style={{ color: '#0066cc' }}
                            title={appliedCount < 2 ? 'Needs at least 2 applied deployments to roll back' : 'Roll back to previous version'}
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            {rollingBackMachineId === m.id ? 'Rolling back…' : 'Rollback'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: '#fafafa' }}>
                        <td colSpan={8} className="px-4 py-3">
                          {machineDeployments.length === 0 ? (
                            <p className="text-xs" style={{ color: '#a1a1a6' }}>No deployment history for this machine yet.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr style={{ color: '#6e6e73' }}>
                                  <th className="text-left py-1 pr-4 font-medium">Version</th>
                                  <th className="text-left py-1 pr-4 font-medium">Status</th>
                                  <th className="text-left py-1 pr-4 font-medium">Requested</th>
                                  <th className="text-left py-1 pr-4 font-medium">Applied</th>
                                  <th className="text-left py-1 font-medium">Error</th>
                                </tr>
                              </thead>
                              <tbody>
                                {machineDeployments.map((d) => {
                                  const version = versions.find((v) => v.id === d.firmware_version_id);
                                  return (
                                    <tr key={d.id} className="border-t" style={{ borderColor: '#e5e5e7' }}>
                                      <td className="py-1.5 pr-4 text-[#1d1d1f]">{version?.version || '(deleted)'}</td>
                                      <td className="py-1.5 pr-4"><StatusBadge status={d.status} /></td>
                                      <td className="py-1.5 pr-4 text-[#6e6e73]">{new Date(d.requested_at).toLocaleString()}</td>
                                      <td className="py-1.5 pr-4 text-[#6e6e73]">{d.applied_at ? new Date(d.applied_at).toLocaleString() : '—'}</td>
                                      <td className="py-1.5" style={{ color: '#c8102e' }}>{d.error_message || '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Push update bar */}
        <div className="p-4 flex flex-wrap gap-3 items-center" style={{ background: '#f5f5f7', borderTop: '1px solid #e5e5e7' }}>
          <span className="text-sm font-medium text-[#1d1d1f]">
            {selectedMachineIds.size} machine{selectedMachineIds.size === 1 ? '' : 's'} selected
          </span>
          <select
            value={pushVersionId}
            onChange={(e) => setPushVersionId(e.target.value)}
            className="px-2 py-1.5 text-sm"
            style={SELECT_STYLE}
          >
            <option value="">Choose firmware version to push…</option>
            {deployableVersions.map((v) => <option key={v.id} value={v.id}>{v.version}</option>)}
          </select>
          <button
            onClick={() => handlePush(false)}
            disabled={deploying || selectedMachineIds.size === 0 || !pushVersionId}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40"
            style={{ background: '#1d1d1f' }}
          >
            <Rocket className="w-3.5 h-3.5" />
            {deploying ? 'Deploying…' : 'Push update'}
          </button>
          {deployableVersions.length === 0 && (
            <span className="text-xs" style={{ color: '#a1a1a6' }}>Upload a firmware build below first</span>
          )}
          {deployError && (
            <span className="text-sm flex items-center gap-2" style={{ color: '#c8102e' }}>
              {deployError}
              {deployForceable && (
                <button
                  onClick={() => handlePush(true)}
                  disabled={deploying}
                  className="px-2 py-0.5 rounded text-xs font-medium text-white"
                  style={{ background: '#c8102e' }}
                >
                  Force push anyway
                </button>
              )}
            </span>
          )}
        </div>
      </div>
      {rollbackError && <p className="text-sm" style={{ color: '#c8102e' }}>{rollbackError}</p>}

      {/* Upload form */}
      <div className="rounded-2xl p-6" style={{ background: '#f5f5f7', border: '1px solid #e5e5e7' }}>
        <h2 className="text-sm font-semibold text-[#1d1d1f] mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Upload Firmware Build
        </h2>
        <form onSubmit={handleUpload} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Version (e.g. 1.1.0)"
            value={uploadVersion}
            onChange={(e) => setUploadVersion(e.target.value)}
            required
            className="px-3 py-2 rounded-lg text-sm border border-[#e5e5e7] bg-white"
          />
          <input
            type="text"
            placeholder="Notes (optional)"
            value={uploadNotes}
            onChange={(e) => setUploadNotes(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border border-[#e5e5e7] bg-white"
          />
          <input
            type="file"
            accept=".bin"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            required
            className="px-3 py-2 rounded-lg text-sm border border-[#e5e5e7] bg-white file:mr-3 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[#1d1d1f] file:text-white"
          />
          <button
            type="submit"
            disabled={uploading || !uploadFile}
            className="sm:col-span-3 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: '#1d1d1f' }}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>
        {uploadError && <p className="text-sm mt-3" style={{ color: '#c8102e' }}>{uploadError}</p>}
      </div>

      {/* Versions table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e5e5e7' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#f5f5f7' }}>
              <th className="text-left px-4 py-3 font-medium text-[#6e6e73]">Version</th>
              <th className="text-left px-4 py-3 font-medium text-[#6e6e73]">Size</th>
              <th className="text-left px-4 py-3 font-medium text-[#6e6e73]">SHA-256</th>
              <th className="text-left px-4 py-3 font-medium text-[#6e6e73]">Notes</th>
              <th className="text-left px-4 py-3 font-medium text-[#6e6e73]">Compatible with</th>
              <th className="text-left px-4 py-3 font-medium text-[#6e6e73]">Uploaded</th>
              <th className="text-left px-4 py-3 font-medium text-[#6e6e73]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[#a1a1a6]">No firmware uploaded yet</td></tr>
            )}
            {versions.map((v) => {
              const busy = busyVersionIds.has(v.id);
              return (
                <tr
                  key={v.id}
                  className="border-t"
                  style={{ borderColor: '#e5e5e7', opacity: v.archived_at ? 0.5 : 1 }}
                >
                  <td className="px-4 py-3 font-medium text-[#1d1d1f]">
                    <div className="flex items-center gap-2">
                      {v.version}
                      {v.archived_at && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: '#e5e5e7', color: '#6e6e73' }}>
                          Archived
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#6e6e73]">{formatBytes(v.size_bytes)}</td>
                  <td className="px-4 py-3 text-[#6e6e73] font-mono text-xs">{v.sha256.slice(0, 12)}…</td>
                  <td className="px-4 py-3 text-[#6e6e73]">{v.notes || '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={v.compatible_body_type || ALL}
                      onChange={(e) => handleCompatibilityChange(v, e.target.value)}
                      disabled={busy}
                      className="px-2 py-1 text-xs"
                      style={SELECT_STYLE}
                    >
                      <option value={ALL}>All body types</option>
                      <option value="single_motor">single_motor only</option>
                      <option value="single_motor_35">single_motor_35 only</option>
                      <option value="quad_motor">quad_motor only</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-[#6e6e73]">{new Date(v.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleArchive(v)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 text-xs font-medium disabled:opacity-30"
                        style={{ color: '#6e6e73' }}
                        title={v.archived_at ? 'Unarchive' : 'Archive'}
                      >
                        {v.archived_at ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                        {v.archived_at ? 'Unarchive' : 'Archive'}
                      </button>
                      <button
                        onClick={() => handleDeleteVersion(v)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 text-xs font-medium disabled:opacity-30"
                        style={{ color: '#c8102e' }}
                        title="Delete permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {versionActionError && (
          <p className="text-sm px-4 py-3" style={{ color: '#c8102e', borderTop: '1px solid #e5e5e7' }}>{versionActionError}</p>
        )}
      </div>

      {/* Deployment status table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#1d1d1f]">Deployments</h2>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#6e6e73] border border-[#e5e5e7] hover:text-[#1d1d1f]"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e5e5e7' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f5f5f7' }}>
                <th className="text-left px-4 py-3 font-medium text-[#6e6e73]">Machine</th>
                <th className="text-left px-4 py-3 font-medium text-[#6e6e73]">Version</th>
                <th className="text-left px-4 py-3 font-medium text-[#6e6e73]">Status</th>
                <th className="text-left px-4 py-3 font-medium text-[#6e6e73]">Requested</th>
                <th className="text-left px-4 py-3 font-medium text-[#6e6e73]">Applied</th>
                <th className="text-left px-4 py-3 font-medium text-[#6e6e73]">Error</th>
              </tr>
            </thead>
            <tbody>
              {deployments.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[#a1a1a6]">No deployments yet</td></tr>
              )}
              {deployments.map((d) => {
                const machine = machineOf(d);
                const version = versions.find((v) => v.id === d.firmware_version_id);
                return (
                  <tr key={d.id} className="border-t" style={{ borderColor: '#e5e5e7' }}>
                    <td className="px-4 py-3 text-[#1d1d1f]">{machine?.name || machine?.machine_id || '—'}</td>
                    <td className="px-4 py-3 text-[#6e6e73]">{version?.version || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-[#6e6e73]">{new Date(d.requested_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-[#6e6e73]">{d.applied_at ? new Date(d.applied_at).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#c8102e' }}>{d.error_message || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
