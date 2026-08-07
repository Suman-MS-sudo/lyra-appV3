'use client';

import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Calendar, Loader2, X } from 'lucide-react';

const CARD: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 20,
};

const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#f3f4f6',
  borderRadius: 12,
};

type Preset = '15' | '30' | '60' | '90' | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: '15', label: 'Last 15 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '60', label: 'Last 60 Days' },
  { value: '90', label: 'Last 90 Days' },
];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function ReportDownload() {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<Preset>('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState(todayISO());
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  function getRange(): { start: string; end: string } | null {
    if (preset === 'custom') {
      if (!customStart || !customEnd) return null;
      if (customStart > customEnd) return null;
      return { start: customStart, end: customEnd };
    }
    const days = parseInt(preset, 10);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }

  const range = getRange();
  const rangeInvalid = preset === 'custom' && !range;

  async function handleDownload() {
    if (!range) return;
    setDownloading(true);
    setError('');
    try {
      const url = `/api/customer/reports?format=${format}&start=${range.start}&end=${range.end}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate report');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `lyra-report.${format}`;

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      setError(e.message || 'Failed to download report');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 2px 12px rgba(244,63,94,0.35)' }}
      >
        <Download className="w-4 h-4" />
        Report
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.60)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-5 relative"
            style={{ ...CARD, background: '#1A1030' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.60)' }} />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Download className="w-4 h-4" style={{ color: '#F472B6' }} />
              <h2 className="font-semibold text-white">Download Reports</h2>
            </div>
            <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.40)' }}>
              Export machine &amp; RFID usage insights — most-used machines, top users, revenue trends — as CSV or a branded PDF for any date range
            </p>

            {/* Time range presets */}
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                  style={
                    preset === p.value
                      ? { background: 'linear-gradient(135deg, #F43F5E, #EC4899)', color: 'white' }
                      : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.60)' }
                  }
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => setPreset('custom')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                style={
                  preset === 'custom'
                    ? { background: 'linear-gradient(135deg, #F43F5E, #EC4899)', color: 'white' }
                    : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.60)' }
                }
              >
                <Calendar className="w-3.5 h-3.5" />
                Custom Range
              </button>
            </div>

            {/* Custom calendar range */}
            {preset === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mb-4 max-w-md">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>From</label>
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd || todayISO()}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                    style={INPUT}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>To</label>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    max={todayISO()}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                    style={INPUT}
                  />
                </div>
              </div>
            )}

            {/* Format + download */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
                <button
                  onClick={() => setFormat('csv')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors"
                  style={format === 'csv' ? { background: 'rgba(244,63,94,0.20)', color: '#FDA4AF' } : { background: 'transparent', color: 'rgba(255,255,255,0.50)' }}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                </button>
                <button
                  onClick={() => setFormat('pdf')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors"
                  style={format === 'pdf' ? { background: 'rgba(244,63,94,0.20)', color: '#FDA4AF' } : { background: 'transparent', color: 'rgba(255,255,255,0.50)' }}
                >
                  <FileText className="w-3.5 h-3.5" /> PDF
                </button>
              </div>

              <button
                onClick={handleDownload}
                disabled={downloading || rangeInvalid}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 4px 14px rgba(244,63,94,0.30)' }}
              >
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {downloading ? 'Generating…' : 'Download Report'}
              </button>

              {rangeInvalid && (
                <span className="text-xs" style={{ color: '#FCA5A5' }}>Select a valid date range</span>
              )}
              {error && (
                <span className="text-xs" style={{ color: '#FCA5A5' }}>{error}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
