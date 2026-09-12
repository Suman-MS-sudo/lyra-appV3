'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Package, Users, Activity,
  CreditCard, TrendingUp, UserCog, LogOut, UserCheck, Menu, X, Nfc
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/admin/dashboard',       label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/admin/machines',        label: 'Machines',     icon: Building2       },
  { href: '/admin/products',        label: 'Products',     icon: Package         },
  { href: '/admin/rfid-cards',      label: 'RFID Cards',   icon: Nfc             },
  { href: '/admin/organizations',   label: 'Orgs',         icon: UserCog         },
  { href: '/admin/customers',       label: 'Customers',    icon: UserCheck       },
  { href: '/admin/users',           label: 'Users',        icon: Users           },
  { href: '/admin/transactions',    label: 'Transactions', icon: Activity        },
  { href: '/admin/billing',         label: 'Billing',      icon: CreditCard      },
  { href: '/admin/analytics',       label: 'Analytics',    icon: TrendingUp      },
];

export default function AdminNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: '#f8fafc',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 1px 0 rgba(15,23,42,0.04)',
      }}
    >
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/admin/dashboard" className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)', boxShadow: '0 2px 10px rgba(37,99,235,0.45)' }}
          >
            <span className="text-white text-xs font-black">L</span>
          </div>
          <span className="text-sm font-black tracking-wide" style={{ color: '#0f172a' }}>
            Lyra <span style={{ color: '#2563EB' }}>Admin</span>
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap"
                style={isActive
                  ? { background: 'rgba(37,99,235,0.18)', color: '#2563EB', border: '1px solid rgba(37,99,235,0.28)' }
                  : { color: '#334155', border: '1px solid transparent' }
                }
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
            className="lg:hidden p-2 rounded-xl transition-colors"
            style={{ background: '#ffffff', border: '1px solid #f1f5f9' }}
            onClick={() => setMobileOpen(v => !v)}
          >
            {mobileOpen
              ? <X className="w-4 h-4 text-slate-900" />
              : <Menu className="w-4 h-4 text-slate-900" />}
          </button>

          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#B91C1C' }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </form>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <div
          className="lg:hidden px-4 pb-4 pt-2 grid grid-cols-3 gap-2"
          style={{ borderTop: '1px solid #f1f5f9' }}
        >
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex flex-col items-center gap-1 px-2 py-3 rounded-2xl text-xs font-medium transition-all text-center"
                style={isActive
                  ? { background: 'rgba(37,99,235,0.18)', color: '#2563EB', border: '1px solid rgba(37,99,235,0.28)' }
                  : { background: '#f1f5f9', color: '#334155', border: '1px solid #f1f5f9' }
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
          <form action="/api/auth/logout" method="POST" className="col-span-3">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium transition-all"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#B91C1C' }}
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
