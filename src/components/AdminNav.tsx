'use client';

import {
  LayoutDashboard, Building2, Package, Users, Activity,
  CreditCard, TrendingUp, UserCog, Nfc, Cpu, KeyRound,
} from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';

const navItems = [
  { href: '/admin/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/admin/machines',      label: 'Machines',      icon: Building2       },
  { href: '/admin/transactions',  label: 'Transactions',  icon: Activity        },
  { href: '/admin/analytics',     label: 'Analytics',     icon: TrendingUp      },
  { href: '/admin/organizations', label: 'Organizations', icon: UserCog,    section: 'Customers' },
  { href: '/admin/users',         label: 'Users',         icon: Users,      section: 'Customers' },
  { href: '/admin/rfid-cards',    label: 'RFID Cards',    icon: Nfc,        section: 'Customers' },
  { href: '/admin/rentals',       label: 'Rentals',       icon: KeyRound,   section: 'Customers' },
  { href: '/admin/billing',       label: 'Billing',       icon: CreditCard, section: 'Customers' },
  { href: '/admin/products',      label: 'Products',      icon: Package,    section: 'System' },
  { href: '/admin/firmware',      label: 'Firmware',      icon: Cpu,        section: 'System' },
];

export default function AdminNav({ userEmail, children }: { userEmail?: string; children: React.ReactNode }) {
  return <AppSidebar items={navItems} homeHref="/admin/dashboard" subtitle="ADMIN CONSOLE" userEmail={userEmail}>{children}</AppSidebar>;
}
