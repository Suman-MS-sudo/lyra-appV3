import Link from 'next/link';
import { Activity, BellRing, Receipt, Nfc, WifiOff, Cpu, ArrowUpRight } from 'lucide-react';

const features = [
  { name: 'Live machine status',      description: 'See which machines are online, ready, out of stock or offline — across every campus, from one screen.', icon: Activity },
  { name: 'Low-stock alerts',         description: 'Get alerted before a machine runs empty, so refills happen before anyone finds it out of stock.',     icon: BellRing },
  { name: 'Every payment on record',  description: 'UPI, coin and RFID vends with machine, time and amount. Each UPI payment is verified server-side.',  icon: Receipt },
  { name: 'RFID cards for staff',     description: 'Issue cards to students or employees, with optional monthly tap limits per organization.',          icon: Nfc },
  { name: 'Works through outages',    description: 'Runs on 2.4 GHz WiFi with no SIM. Transactions queue offline and sync when the network is back.',   icon: WifiOff },
  { name: 'Remote firmware updates',  description: 'Machines receive fixes and new features over the air, with no site visit needed.',                     icon: Cpu },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 sm:py-32 bg-[var(--bg)]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <span className="zl-badge"><span className="zl-badge-dot" />For institutions</span>
          <h2 className="lyra-display text-4xl sm:text-6xl mt-5">One console for every machine</h2>
          <p className="mt-5 text-lg text-[var(--muted)]">
            Schools, colleges, hospitals, offices, hostels and factories run their Lyra machines from the operator
            console in this app — payments, stock, cards and billing in one place.
          </p>
        </div>

        <div className="mx-auto max-w-6xl grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.name}
              className="lyra-chamfer px-7 py-8 lyra-card bg-[var(--surface)] border border-[var(--line)]"
            >
              <div className="w-12 h-12 lyra-chamfer flex items-center justify-center mb-5 bg-[var(--accent-soft)]">
                <feature.icon className="h-6 w-6 text-[var(--accent-ink)]" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-[var(--fg)] mb-2">{feature.name}</h3>
              <p className="text-sm leading-7 text-[var(--muted)]">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <a href="https://lyraenterprise.co.in/" target="_blank" rel="noopener noreferrer" className="lyra-cta">
            Get a machine for your campus
            <ArrowUpRight className="w-4 h-4" />
          </a>
          <Link href="/login" className="lyra-cta-ghost">Operator login</Link>
        </div>
      </div>
    </section>
  );
}
