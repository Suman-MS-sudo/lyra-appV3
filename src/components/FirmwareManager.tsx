'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Rocket, RefreshCw, CheckCircle2, XCircle, Clock, Download, LucideIcon } from 'lucide-react';

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
  firmware_version: string | null;
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

  const [uploadVersion, setUploadVersion] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [deployingVersionId, setDeployingVersionId] = useState<string | null>(null);
  const [selectedMachineIds, setSelectedMachineIds] = useState<Set<string>>(new Set());
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState('');

  const [refreshing, setRefreshing] = useState(false);

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

  const openDeployDialog = (versionId: string) => {
    setDeployingVersionId(versionId);
    setSelectedMachineIds(new Set());
    setDeployError('');
  };

  const toggleMachine = (id: string) => {
    setSelectedMachineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllMachines = () => {
    setSelectedMachineIds((prev) =>
      prev.size === machines.length ? new Set() : new Set(machines.map((m) => m.id))
    );
  };

  const handleDeploy = async () => {
    if (!deployingVersionId || selectedMachineIds.size === 0) return;
    setDeploying(true);
    setDeployError('');

    try {
      const response = await fetch('/api/firmware/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmware_version_id: deployingVersionId,
          machine_ids: Array.from(selectedMachineIds),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(extractError(data, 'Deploy failed'));

      setDeployingVersionId(null);
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
              <th className="text-right px-4 py-3 font-medium text-[#6e6e73]">Action</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#a1a1a6]">No firmware uploaded yet</td></tr>
            )}
            {versions.map((v) => (
              <tr key={v.id} className="border-t" style={{ borderColor: '#e5e5e7' }}>
                <td className="px-4 py-3 font-medium text-[#1d1d1f]">{v.version}</td>
                <td className="px-4 py-3 text-[#6e6e73]">{formatBytes(v.size_bytes)}</td>
                <td className="px-4 py-3 text-[#6e6e73] font-mono text-xs">{v.sha256.slice(0, 12)}…</td>
                <td className="px-4 py-3 text-[#6e6e73]">{v.notes || '—'}</td>
                <td className="px-4 py-3 text-[#6e6e73]">{new Date(v.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openDeployDialog(v.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90"
                    style={{ background: '#1d1d1f' }}
                  >
                    <Rocket className="w-3 h-3" />
                    Deploy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Deploy dialog */}
      {deployingVersionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-[#1d1d1f] mb-1">
              Deploy {versions.find((v) => v.id === deployingVersionId)?.version}
            </h3>
            <p className="text-sm mb-4" style={{ color: '#6e6e73' }}>
              Select which machines should receive this update. Only selected machines are affected.
            </p>

            <button
              onClick={toggleAllMachines}
              className="text-xs font-medium mb-2"
              style={{ color: '#0066cc' }}
            >
              {selectedMachineIds.size === machines.length ? 'Deselect all' : 'Select all'}
            </button>

            <div className="space-y-1 mb-4">
              {machines.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#f5f5f7]"
                >
                  <input
                    type="checkbox"
                    checked={selectedMachineIds.has(m.id)}
                    onChange={() => toggleMachine(m.id)}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[#1d1d1f]">{m.name}</div>
                    <div className="text-xs" style={{ color: '#a1a1a6' }}>
                      {m.machine_id} — current: {m.firmware_version || 'unknown'}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {deployError && <p className="text-sm mb-3" style={{ color: '#c8102e' }}>{deployError}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeployingVersionId(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[#1d1d1f] border border-[#e5e5e7]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeploy}
                disabled={deploying || selectedMachineIds.size === 0}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background: '#1d1d1f' }}
              >
                {deploying ? 'Deploying…' : `Deploy to ${selectedMachineIds.size} machine${selectedMachineIds.size === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}

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
