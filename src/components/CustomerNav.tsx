'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, CreditCard, Users, LogOut, Nfc } from 'lucide-react';

interface CustomerNavProps {
  userEmail: string;
  isSuperCustomer: boolean;
}

const navItems = [
  { href: '/customer/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/customer/machines',   label: 'Machines',   icon: Building2,  superOnly: true },
  { href: '/customer/rfid-cards', label: 'RFID Cards', icon: Nfc         },
  { href: '/customer/billing',    label: 'Billing',    icon: CreditCard  },
  { href: '/customer/users',      label: 'Users',      icon: Users,      superOnly: true },
];

export default function CustomerNav({ userEmail, isSuperCustomer }: CustomerNavProps) {
  const pathname = usePathname();
  const links = navItems.filter(item => !item.superOnly || isSuperCustomer);

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-[#e5e5e7]">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/customer/dashboard" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#1d1d1f]">
            <span className="text-white text-xs font-bold">L</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#1d1d1f]">
            Lyra Care
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive ? 'bg-[#f5f5f7] text-[#1d1d1f]' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <span className="text-xs hidden lg:block truncate max-w-40 text-[#86868b]">
            {userEmail}
          </span>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-[#fbe9e9] text-[#c8102e]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </form>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden px-4 pb-2 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                isActive ? 'bg-[#f5f5f7] text-[#1d1d1f] border-[#e5e5e7]' : 'text-[#6e6e73] border-[#e5e5e7]'
              }`}
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
