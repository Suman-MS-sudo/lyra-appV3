'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LifeBuoy, LogOut, Menu, Search, X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Items sharing a section are grouped under a small caps heading */
  section?: string;
}

interface ShellProps {
  items: NavItem[];
  homeHref: string;
  subtitle: string;
  userEmail?: string;
  children: React.ReactNode;
}

function Brand({ homeHref, subtitle }: { homeHref: string; subtitle: string }) {
  return (
    <Link href={homeHref} className="adm-brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/lyra-care-logo.svg" alt="" width={34} height={34} className="w-[34px] h-[34px] rounded-[10px]" />
      <span className="leading-tight">
        <span className="block text-[14px] font-bold tracking-[0.12em] uppercase text-[var(--fg)]">Lyra Care</span>
        <span className="block text-[10px] font-semibold tracking-[0.16em] text-[var(--subtle)]">{subtitle}</span>
      </span>
    </Link>
  );
}

function activeItem(items: NavItem[], pathname: string) {
  return [...items].sort((a, b) => b.href.length - a.href.length).find((i) => pathname === i.href || pathname.startsWith(i.href + '/'));
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = activeItem(items, pathname);
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {items.map(({ href, label, icon: Icon, section }, i) => {
        const heading = section && section !== items[i - 1]?.section ? section : null;
        const isActive = active?.href === href;
        return (
          <div key={href}>
            {heading && <p className="adm-nav-section">{heading}</p>}
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={`adm-nav-item ${isActive ? 'is-active' : ''}`}
            >
              <span className="adm-nav-icon"><Icon className="w-[15px] h-[15px]" /></span>
              <span className="adm-nav-label">{label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

function HelpCard() {
  return (
    <div className="adm-help">
      <span className="adm-help-icon"><LifeBuoy className="w-4 h-4" /></span>
      <p className="adm-help-title">Need help?</p>
      <p className="adm-help-sub">Machine issue or billing question?</p>
      <a href="mailto:sales@lyraenterprise.co.in?subject=Lyra%20console%20support" className="adm-help-btn">Contact support</a>
    </div>
  );
}

// Pages render their own <h1> via PageHeader; the top bar mirrors it (the h1 stays for screen readers)
function subscribeTitle(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  return () => obs.disconnect();
}
const readTitle = () => document.querySelector('.app-main .ui-pagehead .ui-title')?.textContent?.trim() || '';
function usePageTitle() {
  return useSyncExternalStore(subscribeTitle, readTitle, () => '');
}

/** Breadcrumb + page title + quick search + account controls, above every console page. */
function Topbar({ items, userEmail }: { items: NavItem[]; userEmail?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = activeItem(items, pathname);
  const title = usePageTitle();
  const [q, setQ] = useState('');

  const jump = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim().toLowerCase();
    if (!term) return;
    const hit = items.find((i) => i.label.toLowerCase().startsWith(term)) || items.find((i) => i.label.toLowerCase().includes(term));
    if (hit) { router.push(hit.href); setQ(''); }
  };

  const initial = (userEmail || '?').charAt(0).toUpperCase();
  const pageTitle = title || (pathname.endsWith('/dashboard') ? 'Dashboard' : '');

  return (
    <header className="adm-topbar">
      <div className="min-w-0">
        <p className="adm-crumbs">
          <span>Pages</span> / <span className="text-[var(--fg)]">{current?.label || 'Console'}</span>
        </p>
        {pageTitle && <p className="adm-topbar-title">{pageTitle}</p>}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <form onSubmit={jump} className="adm-search" role="search">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to page…"
            aria-label="Jump to page"
            list="adm-pages"
          />
          <datalist id="adm-pages">{items.map((i) => <option key={i.href} value={i.label} />)}</datalist>
        </form>
        {userEmail && <span className="adm-user" title={userEmail}><span className="adm-user-dot">{initial}</span><span className="hidden xl:inline truncate max-w-40">{userEmail}</span></span>}
        <ThemeToggle />
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="adm-iconbtn" aria-label="Sign out" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </form>
      </div>
    </header>
  );
}

/** Console shell: floating sidebar (desktop) / drawer (mobile) + top bar + page content. */
export default function AppSidebar({ items, homeHref, subtitle, userEmail, children }: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Escape closes the mobile drawer (links close it themselves via onNavigate)
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="adm-sidebar hidden lg:flex">
        <Brand homeHref={homeHref} subtitle={subtitle} />
        <div className="adm-sep" />
        <div className="flex-1 overflow-y-auto -mx-1 px-1 pb-4">
          <NavList items={items} />
        </div>
        <HelpCard />
      </aside>

      {/* Mobile header */}
      <header className="adm-mobilebar lg:hidden">
        <Brand homeHref={homeHref} subtitle={subtitle} />
        <button
          type="button"
          className="adm-iconbtn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
        >
          <Menu className="w-4 h-4" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="adm-drawer">
            <div className="flex items-center justify-between">
              <Brand homeHref={homeHref} subtitle={subtitle} />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="adm-iconbtn">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="adm-sep" />
            <div className="flex-1 overflow-y-auto">
              <NavList items={items} onNavigate={() => setMobileOpen(false)} />
            </div>
            <HelpCard />
          </aside>
        </div>
      )}

      <div className="app-main">
        <Topbar items={items} userEmail={userEmail} />
        {children}
      </div>
    </>
  );
}
