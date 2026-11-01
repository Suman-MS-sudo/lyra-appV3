/**
 * Looping illustration of the real payment flow this app runs:
 * the machine's display shows a QR → phone scans it → pays by UPI →
 * server verifies → machine dispenses. Pure SVG + CSS (pf-* classes in
 * globals.css), so it follows the light/dark theme and stops for
 * reduced-motion visitors.
 */

// Decorative 21×21 QR-style pattern (not scannable) with the three finder squares.
function qrPath(size: number, x0: number, y0: number) {
  const n = 21;
  const m = size / n;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const inFinder = (r: number, c: number) =>
    (r < 8 && c < 8) || (r < 8 && c >= n - 8) || (r >= n - 8 && c < 8);
  let d = '';
  const sq = (r: number, c: number) => {
    d += `M${(x0 + c * m).toFixed(2)},${(y0 + r * m).toFixed(2)}h${m.toFixed(2)}v${m.toFixed(2)}h-${m.toFixed(2)}z`;
  };
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (inFinder(r, c)) continue;
      if (rnd() < 0.48) sq(r, c);
    }
  }
  // Finder squares: 7×7 ring + 3×3 core
  for (const [fr, fc] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const ring = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (ring || core) sq(fr + r, fc + c);
      }
    }
  }
  return d;
}

const MACHINE_QR = qrPath(126, 117, 107);
const PHONE_QR = qrPath(84, 428, 214);

const STEPS = ['Scan the QR on the machine', 'Pay with any UPI app', 'Payment verified', 'Napkin dispensed'];

export function PaymentFlowAnimation() {
  return (
    <figure className="pf-wrap" aria-label="Animation: scan the QR on a Lyra machine, pay by UPI, payment verified, napkin dispensed">
      <svg viewBox="0 0 640 470" className="pf-svg" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="pf-btn" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82ff" />
            <stop offset="100%" stopColor="#1a5cf0" />
          </linearGradient>
          <radialGradient id="pf-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#1f6bff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#1f6bff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="320" cy="250" rx="300" ry="220" fill="url(#pf-halo)" />

        {/* ── Vending machine ── */}
        <g>
          <rect x="70" y="36" width="220" height="410" rx="20" className="pf-body" />
          <text x="92" y="68" className="pf-brand">LYRA</text>
          <circle cx="266" cy="62" r="5" className="pf-led" />

          {/* Display */}
          <rect x="95" y="86" width="170" height="170" rx="12" fill="#0b1220" />
          <g className="pf-screen-ready">
            <rect x="111" y="101" width="138" height="138" rx="6" fill="#ffffff" />
            <path d={MACHINE_QR} fill="#0b1220" />
            <rect x="111" y="101" width="138" height="4" rx="2" fill="#3b82ff" className="pf-scanline" />
          </g>
          <g className="pf-screen-dispense">
            <circle cx="180" cy="152" r="26" fill="none" stroke="#3b82ff" strokeWidth="4" strokeDasharray="40 124" className="pf-spinner" />
            <text x="180" y="208" textAnchor="middle" className="pf-screen-text">Dispensing…</text>
          </g>
          <text x="180" y="284" textAnchor="middle" className="pf-caption-sm">Scan to pay · UPI</text>

          {/* Coin slot + RFID pad, for realism */}
          <rect x="104" y="304" width="44" height="10" rx="5" className="pf-detail" />
          <rect x="212" y="298" width="44" height="22" rx="6" className="pf-detail" />

          {/* Dispense tray */}
          <rect x="110" y="356" width="140" height="62" rx="12" className="pf-tray" />
          <rect x="122" y="368" width="116" height="8" rx="4" fill="#0b1220" opacity="0.55" />
          <g className="pf-packet">
            <rect x="136" y="384" width="88" height="26" rx="7" fill="#e8f0ff" stroke="#1f6bff" strokeWidth="2" />
            <path d="M152 397h56" stroke="#1f6bff" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 5" />
          </g>
        </g>

        {/* ── Server verification chip ── */}
        <g className="pf-verify">
          <rect x="262" y="16" width="148" height="30" rx="15" className="pf-chip" />
          <circle cx="282" cy="31" r="8" fill="#45b558" />
          <path d="M278 31l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x="296" y="35" className="pf-chip-text">Verified by server</text>
        </g>

        {/* ── Phone ── */}
        <g className="pf-phone">
          <rect x="378" y="100" width="188" height="346" rx="30" fill="#0f1520" className="pf-phone-body" />
          <rect x="390" y="114" width="164" height="318" rx="20" className="pf-phone-screen" />
          <rect x="446" y="120" width="52" height="8" rx="4" fill="#0f1520" />

          {/* 1 — camera scanning */}
          <g className="pf-s1">
            <rect x="390" y="114" width="164" height="318" rx="20" fill="#0b1220" />
            <rect x="418" y="204" width="104" height="104" rx="6" fill="#ffffff" />
            <path d={PHONE_QR} fill="#0b1220" />
            <path d="M408 214v-20h20M512 194h20v20M532 300v20h-20M428 320h-20v-20" stroke="#3b82ff" strokeWidth="4" fill="none" strokeLinecap="round" />
            <text x="472" y="356" textAnchor="middle" className="pf-screen-text">Scanning…</text>
          </g>

          {/* 2 — pay screen */}
          <g className="pf-s2">
            <text x="406" y="160" className="pf-ph-muted">Lyra machine · LYRA-0042</text>
            <text x="406" y="196" className="pf-ph-title">Sanitary napkin</text>
            <text x="406" y="244" className="pf-ph-amount">₹10</text>
            <rect x="406" y="276" width="132" height="40" rx="20" fill="url(#pf-btn)" />
            <text x="472" y="301" textAnchor="middle" className="pf-ph-btn">Pay with UPI</text>
            <circle cx="472" cy="296" r="18" className="pf-tap" />
            <text x="472" y="344" textAnchor="middle" className="pf-ph-muted">GPay · PhonePe · Paytm · BHIM</text>
          </g>

          {/* 3 — success */}
          <g className="pf-s3">
            <circle cx="472" cy="222" r="34" fill="#45b558" />
            <path d="M457 222l10 10 19-21" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <text x="472" y="290" textAnchor="middle" className="pf-ph-title">Payment verified</text>
            <text x="472" y="314" textAnchor="middle" className="pf-ph-muted">₹10 · UPI</text>
            <text x="472" y="352" textAnchor="middle" className="pf-ph-muted">Collect from the tray</text>
          </g>
        </g>
      </svg>

      <figcaption className="pf-steps">
        {STEPS.map((s, i) => (
          <span key={s} className="pf-step" style={{ animationDelay: `${i * 2}s` }}>
            <b>{i + 1}</b>
            {s}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
