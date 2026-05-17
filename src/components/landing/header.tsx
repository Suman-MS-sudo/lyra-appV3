'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, User } from 'lucide-react';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'About', href: '#about' },
    { name: 'Features', href: '#features' },
    { name: 'Contact', href: '#contact' },
  ];

  return (
    <header
      className="fixed inset-x-0 top-0 z-50"
      style={{
        background: 'rgba(26,8,52,0.90)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderBottom: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8" aria-label="Global">
        <div className="flex lg:flex-1">
          <Link href="/" className="-m-1.5 p-1.5">
            <span className="text-xl font-black tracking-wide" style={{ color: 'rgba(255,255,255,0.92)' }}>
              Lyra <span style={{ color: '#F472B6' }}>Enterprises</span>
            </span>
          </Link>
        </div>

        <div className="flex lg:hidden">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full p-2 transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Toggle menu</span>
            {mobileMenuOpen ? (
              <X className="h-5 w-5 text-white" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5 text-white" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="hidden lg:flex lg:gap-x-8">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="text-sm font-medium transition-colors hover:text-pink-400"
              style={{ color: 'rgba(255,255,255,0.62)' }}
            >
              {item.name}
            </a>
          ))}
        </div>

        <div className="hidden lg:flex lg:flex-1 lg:justify-end">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 4px 16px rgba(244,63,94,0.35)' }}
          >
            <User className="h-4 w-4" />
            Login
          </Link>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(6px)' }}
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto px-6 py-6 sm:max-w-sm"
            style={{
              background: 'linear-gradient(160deg, #2D1257 0%, #1E0A3C 100%)',
              borderLeft: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <div className="flex items-center justify-between mb-8">
              <Link href="/" className="-m-1.5 p-1.5" onClick={() => setMobileMenuOpen(false)}>
                <span className="text-xl font-black" style={{ color: 'rgba(255,255,255,0.92)' }}>
                  Lyra <span style={{ color: '#F472B6' }}>Enterprises</span>
                </span>
              </Link>
              <button
                type="button"
                className="rounded-full p-2"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5 text-white" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-2">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block rounded-2xl px-4 py-3 text-base font-medium text-white"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              <div className="pt-4">
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-base font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 4px 20px rgba(244,63,94,0.40)' }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <User className="h-5 w-5" />
                  Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
