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
    <header className="fixed inset-x-0 top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-[#e5e5e7]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8" aria-label="Global">
        <div className="flex lg:flex-1">
          <Link href="/" className="-m-1.5 p-1.5">
            <span className="text-xl font-semibold tracking-tight text-[#1d1d1f]">
              Lyra Enterprises
            </span>
          </Link>
        </div>

        <div className="flex lg:hidden">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full p-2 min-w-11 min-h-11 transition-colors border border-[#e5e5e7]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Toggle menu</span>
            {mobileMenuOpen ? (
              <X className="h-5 w-5 text-[#1d1d1f]" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5 text-[#1d1d1f]" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="hidden lg:flex lg:gap-x-8">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="text-sm font-medium text-[#6e6e73] transition-colors hover:text-[#1d1d1f]"
            >
              {item.name}
            </a>
          ))}
        </div>

        <div className="hidden lg:flex lg:flex-1 lg:justify-end">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 min-h-11 text-sm font-semibold text-white bg-[#1d1d1f] transition-transform active:scale-[0.97]"
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
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto px-6 py-6 sm:max-w-sm bg-white border-l border-[#e5e5e7]">
            <div className="flex items-center justify-between mb-8">
              <Link href="/" className="-m-1.5 p-1.5" onClick={() => setMobileMenuOpen(false)}>
                <span className="text-xl font-semibold tracking-tight text-[#1d1d1f]">
                  Lyra Enterprises
                </span>
              </Link>
              <button
                type="button"
                className="rounded-full p-2 min-w-11 min-h-11 border border-[#e5e5e7]"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5 text-[#1d1d1f]" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-2">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block rounded-xl px-4 py-3 text-base font-medium text-[#1d1d1f] border border-[#e5e5e7]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              <div className="pt-4">
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 min-h-11 text-base font-semibold text-white bg-[#1d1d1f]"
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
