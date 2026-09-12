import { MapPin, Mail, Phone } from 'lucide-react';

export function ContactSection() {
  return (
    <section id="contact" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#2563EB' }}>Get in Touch</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Contact Lyra Enterprises</h2>
          <p className="mt-5 text-lg" style={{ color: '#64748b' }}>
            Ready to bring our innovative vending solutions to your location? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div
              className="flex flex-col items-center rounded-3xl px-6 py-10 text-center lyra-card"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(14,165,233,0.14)', border: '1px solid rgba(14,165,233,0.28)' }}
              >
                <MapPin className="h-7 w-7" style={{ color: '#0EA5E9' }} />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-3">Visit Us</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
                10/21, Vasuki Street,<br />
                Cholapuram, Ambattur,<br />
                Chennai - 600053<br />
                <span className="text-xs" style={{ color: '#94a3b8' }}>(Near Municipal School)</span>
              </p>
            </div>

            <div
              className="flex flex-col items-center rounded-3xl px-6 py-10 text-center lyra-card"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(96,165,250,0.16)', border: '1px solid rgba(96,165,250,0.30)' }}
              >
                <Mail className="h-7 w-7" style={{ color: '#2563EB' }} />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-3">Email Us</h3>
              <a
                href="mailto:lyraenterprisessales@gmail.com"
                className="text-sm font-medium break-all hover:text-blue-800 transition-colors"
                style={{ color: '#2563EB' }}
              >
                lyraenterprisessales@gmail.com
              </a>
            </div>

            <div
              className="flex flex-col items-center rounded-3xl px-6 py-10 text-center lyra-card"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(37,99,235,0.22)' }}
              >
                <Phone className="h-7 w-7" style={{ color: '#1D4ED8' }} />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-3">Call Us</h3>
              <a
                href="tel:+918122378860"
                className="text-sm font-medium hover:text-blue-800 transition-colors"
                style={{ color: '#1D4ED8' }}
              >
                +91 81223 78860
              </a>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-14 text-center">
            <p className="text-base mb-6" style={{ color: '#64748b' }}>
              Interested in partnering with us or installing a vending machine at your facility?
            </p>
            <a
              href="mailto:lyraenterprisessales@gmail.com"
              className="inline-flex items-center rounded-full px-8 py-3.5 text-base font-semibold text-white transition-all active:scale-[0.97] btn-glow"
              style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }}
            >
              Get Started Today
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
