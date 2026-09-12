import { QrCode, ShoppingBag, CreditCard, PackageCheck } from 'lucide-react';

const steps = [
  {
    icon: QrCode,
    step: '01',
    title: 'Scan the QR code',
    desc: 'Every Lyra machine has a QR code on the front. Scan it with your phone camera — no app download required.',
  },
  {
    icon: ShoppingBag,
    step: '02',
    title: 'Pick your product',
    desc: 'This page shows exactly what that machine has in stock right now, with live pricing.',
  },
  {
    icon: CreditCard,
    step: '03',
    title: 'Pay by UPI or card',
    desc: 'Secure, cashless checkout in a few taps. Your receipt is generated instantly.',
  },
  {
    icon: PackageCheck,
    step: '04',
    title: 'Collect it from the machine',
    desc: 'The machine dispenses the moment payment confirms — no waiting, no attendant needed.',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-32 bg-[#f5f5f7]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3 text-[#6e6e73]">How it works</p>
          <h2 className="text-4xl font-semibold tracking-tight text-[#1d1d1f] sm:text-5xl">
            This is a payment page, not an app
          </h2>
          <p className="mt-5 text-lg text-[#6e6e73]">
            You land here by scanning the QR code printed on a Lyra machine. From there,
            buying a product takes four steps.
          </p>
        </div>

        <div className="mx-auto max-w-6xl grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, step, title, desc }) => (
            <div
              key={step}
              className="relative rounded-2xl px-6 py-8 lyra-card bg-white border border-[#e5e5e7]"
            >
              <span className="text-xs font-semibold tracking-widest text-[#86868b]">{step}</span>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mt-4 mb-5 bg-[#f5f5f7]">
                <Icon className="h-6 w-6 text-[#1d1d1f]" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-[#1d1d1f] mb-2">{title}</h3>
              <p className="text-sm leading-7 text-[#6e6e73]">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto max-w-4xl mt-14 rounded-2xl px-8 py-8 sm:px-10 bg-white border border-[#e5e5e7] flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-[#f5f5f7]">
            <QrCode className="h-8 w-8 text-[#1d1d1f]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#1d1d1f] mb-1">Run a school, office, or public facility?</h3>
            <p className="text-sm text-[#6e6e73]">
              Machine owners and facility managers get a separate dashboard to track stock, revenue, and machine
              status in real time — that&apos;s the Admin / Business Login above, not this page.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
