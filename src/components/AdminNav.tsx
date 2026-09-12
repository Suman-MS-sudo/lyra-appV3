'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Package, Users, Activity,
  CreditCard, TrendingUp, UserCog, LogOut, Menu, X, Nfc
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/admin/dashboard',       label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/admin/machines',        label: 'Machines',     icon: Building2       },
  { href: '/admin/products',        label: 'Products',     icon: Package         },
  { href: '/admin/rfid-cards',      label: 'RFID Cards',   icon: Nfc             },
  { href: '/admin/organizations',   label: 'Orgs',         icon: UserCog         },
  { href: '/admin/users',           label: 'Users',        icon: Users           },
  { href: '/admin/transactions',    label: 'Transactions', icon: Activity        },
  { href: '/admin/billing',         label: 'Billing',      icon: CreditCard      },
  { href: '/admin/analytics',       label: 'Analytics',    icon: TrendingUp      },
];

export default function AdminNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-[#e5e5e7]">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/admin/dashboard" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#1d1d1f]">
            <span className="text-white text-xs font-bold">L</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#1d1d1f]">
            Lyra Admin
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-0.5 flex-1 px-4 overflow-x-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive ? 'bg-[#f5f5f7] text-[#1d1d1f]' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 min-w-11 min-h-11 rounded-lg transition-colors border border-[#e5e5e7]"
            onClick={() => setMobileOpen(v => !v)}
          >
            {mobileOpen
              ? <X className="w-4 h-4 text-[#1d1d1f]" />
              : <Menu className="w-4 h-4 text-[#1d1d1f]" />}
          </button>

          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-[#fbe9e9] text-[#c8102e]"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </form>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <div className="lg:hidden px-4 pb-4 pt-2 grid grid-cols-3 gap-2 border-t border-[#e5e5e7]">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl text-xs font-medium transition-colors text-center border ${
                  isActive ? 'bg-[#f5f5f7] text-[#1d1d1f] border-[#e5e5e7]' : 'text-[#6e6e73] border-[#e5e5e7]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
          <form action="/api/auth/logout" method="POST" className="col-span-3">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 min-h-11 rounded-xl text-sm font-medium transition-colors bg-[#fbe9e9] text-[#c8102e]"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
