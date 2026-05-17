'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Package, Users, Activity,
  CreditCard, TrendingUp, UserCog, LogOut, UserCheck, Menu, X
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/admin/dashboard',       label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/admin/machines',        label: 'Machines',     icon: Building2       },
  { href: '/admin/products',        label: 'Products',     icon: Package         },
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
        background: 'rgba(20,6,42,0.92)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderBottom: '1px solid rgba(255,255,255,0.09)',
      }}
    >
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/admin/dashboard" className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 2px 10px rgba(244,63,94,0.45)' }}
          >
            <span className="text-white text-xs font-black">L</span>
          </div>
          <span className="text-sm font-black tracking-wide" style={{ color: 'rgba(255,255,255,0.92)' }}>
            Lyra <span style={{ color: '#F472B6' }}>Admin</span>
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
                  ? { background: 'rgba(244,63,94,0.18)', color: '#F472B6', border: '1px solid rgba(244,63,94,0.28)' }
                  : { color: 'rgba(255,255,255,0.52)', border: '1px solid transparent' }
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
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
            onClick={() => setMobileOpen(v => !v)}
          >
            {mobileOpen
              ? <X className="w-4 h-4 text-white" />
              : <Menu className="w-4 h-4 text-white" />}
          </button>

          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#FCA5A5' }}
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
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
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
                  ? { background: 'rgba(244,63,94,0.18)', color: '#F472B6', border: '1px solid rgba(244,63,94,0.28)' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.08)' }
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
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#FCA5A5' }}
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
