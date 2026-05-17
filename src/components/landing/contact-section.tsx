import { MapPin, Mail, Phone } from 'lucide-react';

export function ContactSection() {
  return (
    <section id="contact" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#F472B6' }}>Get in Touch</p>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Contact Lyra Enterprises</h2>
          <p className="mt-5 text-lg" style={{ color: 'rgba(255,255,255,0.50)' }}>
            Ready to bring our innovative vending solutions to your location? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div
              className="flex flex-col items-center rounded-3xl px-6 py-10 text-center lyra-card"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(167,139,250,0.18)', border: '1px solid rgba(167,139,250,0.30)' }}
              >
                <MapPin className="h-7 w-7" style={{ color: '#A78BFA' }} />
              </div>
              <h3 className="text-base font-semibold text-white mb-3">Visit Us</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.58)' }}>
                10/21, Vasuki Street,<br />
                Cholapuram, Ambattur,<br />
                Chennai - 600053<br />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.32)' }}>(Near Municipal School)</span>
              </p>
            </div>

            <div
              className="flex flex-col items-center rounded-3xl px-6 py-10 text-center lyra-card"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(96,165,250,0.18)', border: '1px solid rgba(96,165,250,0.30)' }}
              >
                <Mail className="h-7 w-7" style={{ color: '#60A5FA' }} />
              </div>
              <h3 className="text-base font-semibold text-white mb-3">Email Us</h3>
              <a
                href="mailto:lyraenterprisessales@gmail.com"
                className="text-sm font-medium break-all hover:text-white transition-colors"
                style={{ color: '#60A5FA' }}
              >
                lyraenterprisessales@gmail.com
              </a>
            </div>

            <div
              className="flex flex-col items-center rounded-3xl px-6 py-10 text-center lyra-card"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(244,63,94,0.18)', border: '1px solid rgba(244,63,94,0.28)' }}
              >
                <Phone className="h-7 w-7" style={{ color: '#F472B6' }} />
              </div>
              <h3 className="text-base font-semibold text-white mb-3">Call Us</h3>
              <a
                href="tel:+918122378860"
                className="text-sm font-medium hover:text-white transition-colors"
                style={{ color: '#F472B6' }}
              >
                +91 81223 78860
              </a>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-14 text-center">
            <p className="text-base mb-6" style={{ color: 'rgba(255,255,255,0.48)' }}>
              Interested in partnering with us or installing a vending machine at your facility?
            </p>
            <a
              href="mailto:lyraenterprisessales@gmail.com"
              className="inline-flex items-center rounded-full px-8 py-3.5 text-base font-semibold text-white transition-all active:scale-[0.97] btn-glow"
              style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)' }}
            >
              Get Started Today
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
