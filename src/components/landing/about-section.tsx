import { ArrowUpRight } from 'lucide-react';
import { PaymentFlowAnimation } from './payment-flow-animation';

const SITE = 'https://lyraenterprise.co.in/';

// Figures as published on lyraenterprise.co.in
const STATS = [
  { value: '200+', label: 'Institutions equipped' },
  { value: '99%', label: 'Machine uptime' },
  { value: '13', label: 'Machine models' },
  { value: 'ISO', label: '9001:2015 certified' },
];

export function AboutSection() {
  return (
    <section id="about" className="relative py-24 sm:py-32 bg-[var(--bg)] border-t border-[var(--line)]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 flex flex-wrap items-center gap-12">
        <div style={{ flex: '1 1 420px', minWidth: 280 }}>
          <span className="zl-badge"><span className="zl-badge-dot" />About us</span>
          <h2 className="lyra-display mt-5" style={{ fontSize: 'clamp(34px,5.5vw,64px)' }}>
            About <span className="zl-brand">Lyra</span> Enterprises
          </h2>
          <p className="mt-6 max-w-[560px] text-base sm:text-lg leading-8 text-[var(--muted)]">
            Lyra Enterprises is a Chennai-based manufacturer of sanitary napkin vending machines and
            incinerators, built for institutions rather than homes. Our mission is to expand sanitary
            hygiene infrastructure across India. Schools, colleges, hospitals, offices, hostels, factories,
            IT parks and public restrooms run our machines.
          </p>

          <dl className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-[560px]">
            {STATS.map((s) => (
              <div key={s.label} className="lyra-chamfer px-4 py-4 bg-[var(--surface)] border border-[var(--line)]">
                <dt className="sr-only">{s.label}</dt>
                <dd className="lyra-display text-2xl text-[var(--accent-ink)]">{s.value}</dd>
                <dd className="mt-1 text-xs text-[var(--muted)]">{s.label}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-9 flex flex-wrap gap-3">
            <a href={SITE} target="_blank" rel="noopener noreferrer" className="lyra-cta">
              Explore machines
              <ArrowUpRight className="w-4 h-4" />
            </a>
            <a href={SITE} target="_blank" rel="noopener noreferrer" className="lyra-cta-ghost">
              Rent from ₹999/month
            </a>
          </div>
        </div>

        <div className="relative flex justify-end" style={{ flex: '1 1 360px', minWidth: 260 }}>
          <PaymentFlowAnimation />
        </div>
      </div>
    </section>
  );
}
