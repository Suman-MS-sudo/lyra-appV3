'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Rocket, RefreshCw, CheckCircle2, XCircle, Clock, Download, LucideIcon, Search, Circle } from 'lucide-react';

interface FirmwareVersion {
  id: string;
  version: string;
  filename: string;
  sha256: string;
  size_bytes: number;
  notes: string | null;
  created_at: string;
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

function extractError(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const { error } = data as { error?: unknown };
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
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

  const [refreshing, setRefreshing] = useState(false);

  const knownVersions = useMemo(
    () => Array.from(new Set(machines.map((m) => m.firmware_version || 'Unknown'))).sort(),
    [machines]
  );
  const knownBodyTypes = useMemo(
    () => Array.from(new Set(machines.map((m) => m.body_type || 'Unknown'))).sort(),
    [machines]
  );

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

      if (!response.ok) throw new Error(extractError(data, 'Upload failed'));

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

  const handlePush = async () => {
    if (!pushVersionId || selectedMachineIds.size === 0) return;
    setDeploying(true);
    setDeployError('');

    try {
      const response = await fetch('/api/firmware/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmware_version_id: pushVersionId,
          machine_ids: Array.from(selectedMachineIds),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(extractError(data, 'Deploy failed'));

      setSelectedMachineIds(new Set());
      router.refresh();
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeploying(false);
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
              </tr>
            </thead>
            <tbody>
              {filteredMachines.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[#a1a1a6]">No machines match these filters</td></tr>
              )}
              {filteredMachines.map((m) => (
                <tr
                  key={m.id}
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
                </tr>
              ))}
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
            {versions.map((v) => <option key={v.id} value={v.id}>{v.version}</option>)}
          </select>
          <button
            onClick={handlePush}
            disabled={deploying || selectedMachineIds.size === 0 || !pushVersionId}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40"
            style={{ background: '#1d1d1f' }}
          >
            <Rocket className="w-3.5 h-3.5" />
            {deploying ? 'Deploying…' : 'Push update'}
          </button>
          {versions.length === 0 && (
            <span className="text-xs" style={{ color: '#a1a1a6' }}>Upload a firmware build below first</span>
          )}
          {deployError && <span className="text-sm" style={{ color: '#c8102e' }}>{deployError}</span>}
        </div>
      </div>

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
              <th className="text-left px-4 py-3 font-medium text-[#6e6e73]">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[#a1a1a6]">No firmware uploaded yet</td></tr>
            )}
            {versions.map((v) => (
              <tr key={v.id} className="border-t" style={{ borderColor: '#e5e5e7' }}>
                <td className="px-4 py-3 font-medium text-[#1d1d1f]">{v.version}</td>
                <td className="px-4 py-3 text-[#6e6e73]">{formatBytes(v.size_bytes)}</td>
                <td className="px-4 py-3 text-[#6e6e73] font-mono text-xs">{v.sha256.slice(0, 12)}…</td>
                <td className="px-4 py-3 text-[#6e6e73]">{v.notes || '—'}</td>
                <td className="px-4 py-3 text-[#6e6e73]">{new Date(v.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
