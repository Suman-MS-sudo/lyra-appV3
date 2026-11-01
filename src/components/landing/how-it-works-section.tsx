import Link from 'next/link';
import { QrCode, Smartphone, ShieldCheck, PackageCheck, LifeBuoy, LayoutDashboard, ArrowRight } from 'lucide-react';

const steps = [
  {
    icon: QrCode,
    step: '01',
    title: 'Find the QR on the machine',
    desc: 'When a Lyra machine is ready, its display shows a payment QR. If the screen says out of stock or offline, it can’t take a payment right now.',
  },
  {
    icon: Smartphone,
    step: '02',
    title: 'Scan it with your phone',
    desc: 'Use your phone camera or any UPI app. This page opens for that exact machine, with its item and price.',
  },
  {
    icon: ShieldCheck,
    step: '03',
    title: 'Pay with any UPI app',
    desc: 'Approve in Google Pay, PhonePe, Paytm, BHIM or your bank app. We verify every payment on our server before the machine is told to dispense.',
  },
  {
    icon: PackageCheck,
    step: '04',
    title: 'Collect your napkin',
    desc: 'The machine dispenses within seconds of confirmation. Keep the payment page open until it does.',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-32 bg-[var(--surface-2)]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <span className="zl-badge"><span className="zl-badge-dot" />How to pay</span>
          <h2 className="lyra-display text-4xl sm:text-6xl mt-5">
            Pay at the machine in four steps
          </h2>
          <p className="mt-5 text-lg text-[var(--muted)]">
            This isn&apos;t a shop and there&apos;s nothing to install. It&apos;s the payment page your phone opens when you
            scan the QR shown on a Lyra machine.
          </p>
        </div>

        <div className="mx-auto max-w-6xl grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, step, title, desc }) => (
            <div
              key={step}
              className="relative lyra-chamfer px-6 py-8 lyra-card bg-[var(--surface)] border border-[var(--line)]"
            >
              <span className="lyra-display text-3xl text-[var(--accent)]">{step}</span>
              <div className="w-12 h-12 lyra-chamfer flex items-center justify-center mt-4 mb-5 bg-[var(--accent-soft)]">
                <Icon className="h-6 w-6 text-[var(--accent-ink)]" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-[var(--fg)] mb-2">{title}</h3>
              <p className="text-sm leading-7 text-[var(--muted)]">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto max-w-6xl mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="lyra-chamfer px-7 py-7 bg-[var(--surface)] border border-[var(--line)] flex flex-col sm:flex-row gap-5">
            <div className="w-14 h-14 lyra-chamfer flex items-center justify-center shrink-0 bg-[var(--warning-bg)]">
              <LifeBuoy className="h-7 w-7 text-[var(--warning)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--fg)] mb-1">Paid, but nothing came out?</h3>
              <p className="text-sm leading-7 text-[var(--muted)]">
                Note the machine shown on the payment page and the time you paid, then call or WhatsApp us. Payments
                for failed vends are refunded under our{' '}
                <Link href="/refund-policy" className="font-medium text-[var(--accent-ink)] hover:underline">refund policy</Link>.
              </p>
              <a href="#contact" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-ink)] hover:underline">
                Contact support <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="lyra-chamfer px-7 py-7 bg-[var(--surface)] border border-[var(--line)] flex flex-col sm:flex-row gap-5">
            <div className="w-14 h-14 lyra-chamfer flex items-center justify-center shrink-0 bg-[var(--accent-soft)]">
              <LayoutDashboard className="h-7 w-7 text-[var(--accent-ink)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--fg)] mb-1">Run a school, office or hospital?</h3>
              <p className="text-sm leading-7 text-[var(--muted)]">
                Machine owners and facility managers sign in to a separate console to see every payment, stock
                level and machine status in real time.
              </p>
              <Link href="/login" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-ink)] hover:underline">
                Operator login <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
