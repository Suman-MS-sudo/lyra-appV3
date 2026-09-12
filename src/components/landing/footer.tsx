import Link from 'next/link';

export function Footer() {
  return (
    <footer style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {/* Company */}
          <div className="col-span-2 lg:col-span-1">
            <h3 className="text-lg font-black mb-3" style={{ color: '#0f172a' }}>
              Lyra <span style={{ color: '#2563EB' }}>Enterprises</span>
            </h3>
            <p className="text-xs mb-5" style={{ color: '#64748b' }}>
              IoT Vending Solutions — Smart Vending Reimagined
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs" style={{ color: '#64748b' }}>
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
                24/7 Online
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: '#64748b' }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#2563EB' }} />
                Smart Insights
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: '#64748b' }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#0EA5E9' }} />
                Multi-Modal
              </div>
            </div>
          </div>

          {/* Solutions */}
          <div>
            <h4 className="text-xs font-semibold text-slate-900 mb-4 tracking-widest uppercase">Solutions</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Analytics', href: '#features' },
                { label: 'Support',   href: '#contact'  },
                { label: 'Customer',  href: '/login'    },
                { label: 'Admin',     href: '/login?type=admin' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-xs hover:text-blue-600 transition-colors"
                    style={{ color: '#64748b' }}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-semibold text-slate-900 mb-4 tracking-widest uppercase">Quick Links</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'About',   href: '#about'            },
                { label: 'Privacy', href: '/privacy-policy'   },
                { label: 'Terms',   href: '/terms-of-service' },
                { label: 'Refund',  href: '/refund-policy'    },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-xs hover:text-blue-600 transition-colors"
                    style={{ color: '#64748b' }}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="col-span-2 lg:col-span-1">
            <h4 className="text-xs font-semibold text-slate-900 mb-4 tracking-widest uppercase">Contact Us</h4>
            <ul className="space-y-2.5 text-xs" style={{ color: '#64748b' }}>
              <li className="leading-snug">
                10/21, Vasuki Street, Cholapuram,<br />Ambattur, Chennai - 600053
              </li>
              <li>
                <a href="tel:+918122378860" className="hover:text-blue-600 transition-colors">+91 81223 78860</a>
              </li>
              <li>
                <a href="mailto:lyraenterprisessales@gmail.com" className="hover:text-blue-600 transition-colors break-all">
                  lyraenterprisessales@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6" style={{ borderTop: '1px solid #e2e8f0' }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs" style={{ color: '#94a3b8' }}>
              © {new Date().getFullYear()} Lyra Enterprises
            </p>
            <div className="flex items-center gap-5 text-xs" style={{ color: '#94a3b8' }}>
              <Link href="/privacy-policy" className="hover:text-blue-600 transition-colors">Privacy</Link>
              <Link href="/terms-of-service" className="hover:text-blue-600 transition-colors">Terms</Link>
              <Link href="/refund-policy" className="hover:text-blue-600 transition-colors">Refund</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
