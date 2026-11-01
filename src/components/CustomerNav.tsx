'use client';

import { LayoutDashboard, Building2, CreditCard, Users, Nfc, KeyRound } from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';

interface CustomerNavProps {
  userEmail: string;
  isSuperCustomer: boolean;
  children: React.ReactNode;
}

const navItems = [
  { href: '/customer/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/customer/machines',   label: 'Machines',   icon: Building2,  superOnly: true },
  { href: '/customer/rfid-cards', label: 'RFID Cards', icon: Nfc         },
  { href: '/customer/users',      label: 'Users',      icon: Users,      superOnly: true },
  { href: '/customer/billing',    label: 'Billing',    icon: CreditCard, section: 'Account' },
  { href: '/customer/rental',     label: 'Rental',     icon: KeyRound,   section: 'Account' },
];

export default function CustomerNav({ userEmail, isSuperCustomer, children }: CustomerNavProps) {
  const items = navItems.filter((item) => !item.superOnly || isSuperCustomer);
  return <AppSidebar items={items} homeHref="/customer/dashboard" subtitle="CUSTOMER PORTAL" userEmail={userEmail}>{children}</AppSidebar>;
}
