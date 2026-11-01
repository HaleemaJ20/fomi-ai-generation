'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderOpen, House, ImageIcon, Sparkles, Video, Wand2 } from 'lucide-react';
import AppHeader from './AppHeader';

const tabs = [
  { href: '/', label: 'Home', Icon: House },
  { href: '/image', label: 'Image', Icon: ImageIcon },
  { href: '/video', label: 'Video', Icon: Video },
  { href: '/edit', label: 'Edit', Icon: Wand2 },
  { href: '/library', label: 'Library', Icon: FolderOpen },
  { href: '/studio', label: 'Studio', Icon: Sparkles },
];

const AppShell = ({ children }) => {
  const pathname = usePathname();
  const isStudioRoute = pathname?.startsWith('/studio');

  return (
    <div className="min-h-screen bg-[var(--color-page-bg)] text-[var(--color-ink)]">
      {!isStudioRoute && <AppHeader />}
      <main className="mx-auto w-full max-w-[1480px] px-3 pb-24 pt-4 sm:px-5 lg:px-6">
        {children}
      </main>
      {!isStudioRoute && (
        <nav aria-label="Mobile navigation" className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-6 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-soft md:hidden">
          {tabs.map(({ href, label, Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={isActive ? 'page' : undefined} className={`flex h-11 flex-col items-center justify-center rounded-[16px] text-[10px] font-medium transition focus-ring ${isActive ? 'bg-[var(--color-panel)] text-[var(--color-ink)]' : 'text-[var(--color-muted)] hover:bg-[var(--color-panel)]'}`}>
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
};

export default AppShell;