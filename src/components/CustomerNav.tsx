'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, CreditCard, Users, LogOut } from 'lucide-react';

interface CustomerNavProps {
  userEmail: string;
  isSuperCustomer: boolean;
}

const navItems = [
  { href: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customer/machines',  label: 'Machines',  icon: Building2,  superOnly: true },
  { href: '/customer/billing',   label: 'Billing',   icon: CreditCard  },
  { href: '/customer/users',     label: 'Users',     icon: Users,      superOnly: true },
];

export default function CustomerNav({ userEmail, isSuperCustomer }: CustomerNavProps) {
  const pathname = usePathname();
  const links = navItems.filter(item => !item.superOnly || isSuperCustomer);

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
        <Link href="/customer/dashboard" className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 2px 10px rgba(244,63,94,0.45)' }}
          >
            <span className="text-white text-xs font-black">L</span>
          </div>
          <span className="text-sm font-black tracking-wide" style={{ color: 'rgba(255,255,255,0.92)' }}>
            Lyra <span style={{ color: '#F472B6' }}>Care</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 px-4">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
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

        {/* Right side */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs hidden lg:block truncate max-w-40"
            style={{ color: 'rgba(255,255,255,0.32)' }}
          >
            {userEmail}
          </span>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)', color: '#FCA5A5' }}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </form>
        </div>
      </div>

      {/* Mobile nav */}
      <div
        className="md:hidden px-4 pb-2 flex gap-1.5 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all"
              style={isActive
                ? { background: 'rgba(244,63,94,0.18)', color: '#F472B6', border: '1px solid rgba(244,63,94,0.28)' }
                : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              <Icon className="w-3 h-3" />
              {label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
