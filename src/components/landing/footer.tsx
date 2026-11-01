import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-[#07060b] border-t border-[rgba(31,107,255,0.3)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {/* Company */}
          <div className="col-span-2 lg:col-span-1">
            <h3 className="text-lg font-semibold tracking-tight text-white mb-3">
              Lyra Enterprises
            </h3>
            <p className="text-xs mb-5 text-white/45">
              Sanitary napkin vending machines &amp; incinerators · Chennai
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-white/45">
                <span className="w-1.5 h-1.5 bg-white/60 rounded-full inline-block" />
                ISO 9001:2015 certified
              </div>
              <div className="flex items-center gap-2 text-xs text-white/45">
                <span className="w-1.5 h-1.5 rounded-full inline-block bg-white/60" />
                200+ institutions equipped
              </div>
              <div className="flex items-center gap-2 text-xs text-white/45">
                <span className="w-1.5 h-1.5 rounded-full inline-block bg-white/60" />
                UPI · Coin · RFID payments
              </div>
            </div>
          </div>

          {/* Solutions */}
          <div>
            <h4 className="text-xs font-semibold text-white mb-4 tracking-widest uppercase">This app</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'How to pay',       href: '#how-it-works' },
                { label: 'For institutions', href: '#features' },
                { label: 'Operator login',   href: '/login' },
                { label: 'Support',          href: '#contact' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className="text-xs text-white/45 hover:text-white transition-colors">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-semibold text-white mb-4 tracking-widest uppercase">Quick Links</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'About',   href: '#about'            },
                { label: 'Buy or rent a machine', href: 'https://lyraenterprise.co.in/' },
                { label: 'Privacy', href: '/privacy-policy'   },
                { label: 'Terms',   href: '/terms-of-service' },
                { label: 'Refund',  href: '/refund-policy'    },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-xs text-white/45 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="col-span-2 lg:col-span-1">
            <h4 className="text-xs font-semibold text-white mb-4 tracking-widest uppercase">Contact Us</h4>
            <ul className="space-y-2.5 text-xs text-white/45">
              <li className="leading-snug">
                10/21, Vasuki Street, Cholapuram,<br />Ambattur, Chennai - 600053
              </li>
              <li>Mon – Sat, 9:30 AM – 6:30 PM IST</li>
              <li>
                <a href="tel:+918122378860" className="hover:text-white transition-colors">+91 81223 78860 (call / WhatsApp)</a>
              </li>
              <li>
                <a href="mailto:sales@lyraenterprise.co.in" className="hover:text-white transition-colors break-all">
                  sales@lyraenterprise.co.in
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-white/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/30">
              © {new Date().getFullYear()} Lyra Enterprises
            </p>
            <div className="flex items-center gap-5 text-xs text-white/30">
              <Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms-of-service" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/refund-policy" className="hover:text-white transition-colors">Refund</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
