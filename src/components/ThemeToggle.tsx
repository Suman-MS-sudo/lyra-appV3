'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

const subscribe = (cb: () => void) => {
  window.addEventListener('lyra-theme-change', cb);
  return () => window.removeEventListener('lyra-theme-change', cb);
};
const isDark = () => document.documentElement.classList.contains('dark');

/** Light/dark switch — flips `.dark` on <html> and remembers the choice. */
export function ThemeToggle({ className = '', floating = false }: { className?: string; floating?: boolean }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('lyra-theme', next ? 'dark' : 'light'); } catch {}
    window.dispatchEvent(new Event('lyra-theme-change'));
  };

  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center w-10 h-10 min-w-10 rounded-full border transition-colors border-[var(--line-strong)] bg-[var(--surface-2)] text-[var(--fg)] hover:border-[var(--accent)] ${
        floating ? 'fixed top-4 right-4 z-50 shadow-lg' : ''
      } ${className}`}
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
