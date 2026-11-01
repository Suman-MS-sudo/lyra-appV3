import { MapPin, Mail, Phone, Clock, MessageCircle } from 'lucide-react';

const PHONE_DISPLAY = '+91 81223 78860';
const PHONE_TEL = 'tel:+918122378860';
const WHATSAPP = 'https://wa.me/918122378860';
const EMAIL = 'sales@lyraenterprise.co.in';

const cardClass =
  'flex flex-col items-center lyra-chamfer px-6 py-9 text-center lyra-card bg-[var(--surface)] border border-[var(--line)]';
const iconClass = 'w-14 h-14 lyra-chamfer flex items-center justify-center mb-5 bg-[var(--accent-soft)]';

export function ContactSection() {
  return (
    <section id="contact" className="relative py-24 sm:py-32 bg-[var(--surface-2)]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <span className="zl-badge"><span className="zl-badge-dot" />Support</span>
          <h2 className="lyra-display text-4xl sm:text-6xl mt-5">Need help with a machine?</h2>
          <p className="mt-5 text-lg text-[var(--muted)]">
            Payment issue, machine not dispensing, or want a machine at your institution — reach Lyra Enterprises
            directly.
          </p>
        </div>

        <div className="mx-auto max-w-6xl grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className={cardClass}>
            <div className={iconClass}><Phone className="h-6 w-6 text-[var(--accent-ink)]" /></div>
            <h3 className="text-base font-semibold text-[var(--fg)] mb-3">Call or WhatsApp</h3>
            <a href={PHONE_TEL} className="text-sm font-medium text-[var(--accent-ink)] hover:underline">{PHONE_DISPLAY}</a>
          </div>

          <div className={cardClass}>
            <div className={iconClass}><Mail className="h-6 w-6 text-[var(--accent-ink)]" /></div>
            <h3 className="text-base font-semibold text-[var(--fg)] mb-3">Email</h3>
            <a href={`mailto:${EMAIL}`} className="text-sm font-medium break-all text-[var(--accent-ink)] hover:underline">{EMAIL}</a>
          </div>

          <div className={cardClass}>
            <div className={iconClass}><Clock className="h-6 w-6 text-[var(--accent-ink)]" /></div>
            <h3 className="text-base font-semibold text-[var(--fg)] mb-3">Support hours</h3>
            <p className="text-sm leading-relaxed text-[var(--fg-2)]">Mon – Sat<br />9:30 AM – 6:30 PM IST</p>
          </div>

          <div className={cardClass}>
            <div className={iconClass}><MapPin className="h-6 w-6 text-[var(--accent-ink)]" /></div>
            <h3 className="text-base font-semibold text-[var(--fg)] mb-3">Office</h3>
            <p className="text-sm leading-relaxed text-[var(--fg-2)]">
              10/21, Vasuki Street, Cholapuram,<br />
              Ambattur, Chennai 600053,<br />
              Tamil Nadu
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="lyra-cta">
            <MessageCircle className="w-4 h-4" />
            WhatsApp support
          </a>
          <a href="https://lyraenterprise.co.in/" target="_blank" rel="noopener noreferrer" className="lyra-cta-ghost">
            Get a free quote
          </a>
        </div>
      </div>
    </section>
  );
}
