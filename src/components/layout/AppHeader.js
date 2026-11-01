'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderOpen, House, ImageIcon, Menu, MessageSquareMore, MoonStar, Sparkles, SunMedium, Trash2, Video, Wand2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import useTheme from '../../hooks/useTheme';
import useModalScrollLock from '../../hooks/useModalScrollLock';

const navItems = [
  { href: '/', label: 'Home', icon: House },
  { href: '/image', label: 'Image', icon: ImageIcon },
  { href: '/video', label: 'Video', icon: Video },
  { href: '/edit', label: 'Edit', icon: Wand2 },
  { href: '/library', label: 'Library', icon: FolderOpen },
  { href: '/studio', label: 'Studio', icon: Sparkles },
];

const initialSettings = {
  emailNotifications: true,
  weeklySummary: false,
};

const AppHeader = () => {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isClearHistoryOpen, setIsClearHistoryOpen] = useState(false);
  const clearDialogRef = useRef(null);
  const [isSignedIn, setIsSignedIn] = useState(true);
  const [settings, setSettings] = useState(initialSettings);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef(null);
  useModalScrollLock(isSupportOpen || isClearHistoryOpen);

  useEffect(() => {
    const storedUser = window.localStorage.getItem('fomi-session');
    const storedSettings = window.localStorage.getItem('fomi-settings');
    if (storedUser === 'signed-out') {
      setIsSignedIn(false);
    }
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings);
        if (parsed?.version === 2 && parsed.settings && typeof parsed.settings === 'object') {
          setSettings({
            emailNotifications: typeof parsed.settings.emailNotifications === 'boolean' ? parsed.settings.emailNotifications : initialSettings.emailNotifications,
            weeklySummary: typeof parsed.settings.weeklySummary === 'boolean' ? parsed.settings.weeklySummary : initialSettings.weeklySummary,
          });
        } else {
          window.localStorage.removeItem('fomi-settings');
        }
      } catch {
        window.localStorage.removeItem('fomi-settings');
      }
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem('fomi-settings', JSON.stringify({ version: 2, settings }));
  }, [mounted, settings]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem('fomi-session', isSignedIn ? 'signed-in' : 'signed-out');
  }, [mounted, isSignedIn]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const activeIndex = useMemo(() => {
    const matches = navItems.findIndex((item) => {
      if (item.href === '/') return pathname === '/';
      return pathname.startsWith(item.href);
    });
    return matches >= 0 ? matches : 0;
  }, [pathname]);

  const openGallery = () => {
    window.location.href = '/gallery';
  };

  const toggleSetting = (key) => {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleSession = () => {
    setIsSignedIn((current) => !current);
    setIsUserMenuOpen(false);
  };

  const confirmClearHistory = () => {
    window.dispatchEvent(new Event('fomi:clear-history-confirmed'));
    setIsClearHistoryOpen(false);
    setIsUserMenuOpen(false);
  };

  useEffect(() => {
    if (!isClearHistoryOpen) return;
    clearDialogRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsClearHistoryOpen(false);
      if (event.key === 'Tab' && clearDialogRef.current) {
        const focusable = Array.from(clearDialogRef.current.querySelectorAll('button:not([disabled])'));
        if (!focusable.length) return;
        if (event.shiftKey && document.activeElement === focusable[0]) {
          event.preventDefault();
          focusable[focusable.length - 1].focus();
        } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isClearHistoryOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[color:rgba(248,241,237,0.92)] backdrop-blur-sm dark:bg-[color:rgba(20,20,20,0.86)]">
        <div className="mx-auto flex min-w-0 max-w-[1480px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl font-bold text-[var(--color-ink)] transition hover:scale-[1.02] focus-ring" aria-label="Go to Fomi home page">
            F
          </Link>

          <nav aria-label="Primary navigation" className="hidden items-center rounded-full bg-[var(--color-surface)] px-2 py-1 shadow-sm md:flex">
            <div className="relative flex items-center gap-2 px-1 pt-1">
              <span
                className="pointer-events-none absolute left-[3px] top-[-3px] h-1 w-10 rounded-full bg-[var(--color-accent)] shadow-sm transition-transform duration-200"
                style={{ transform: `translateX(${activeIndex * 48}px)` }}
                aria-hidden="true"
              />
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeIndex === navItems.indexOf(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring"
                    title={item.label}
                    aria-label={item.label}
                  >
                    <Icon size={16} strokeWidth={2.2} aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <button type="button" onClick={openGallery} className="hidden items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring sm:inline-flex" aria-label="Open gallery">
              <FolderOpen size={14} aria-hidden="true" />
              Gallery
            </button>
            <button type="button" onClick={() => setIsSupportOpen(true)} className="hidden items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring sm:inline-flex" aria-label="Open support dialog">
              <MessageSquareMore size={14} aria-hidden="true" />
              Support
            </button>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] focus-ring sm:hidden"
              aria-expanded={isMobileMenuOpen}
              aria-label="Open header menu"
            >
              {isMobileMenuOpen ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] transition hover:bg-[var(--color-panel)] focus-ring"
              aria-label="Toggle between light and dark mode"
              title="Toggle theme"
            >
              {theme === 'dark' ? <SunMedium size={15} aria-hidden="true" /> : <MoonStar size={15} aria-hidden="true" />}
            </button>

            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((open) => !open)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-bold text-[var(--color-ink)] shadow-sm transition hover:opacity-90 focus-ring"
                aria-expanded={isUserMenuOpen}
                aria-haspopup="menu"
                aria-label="Open user menu"
              >
                {isSignedIn ? 'J' : 'G'}
              </button>

              {isUserMenuOpen ? (
                <div className="absolute right-0 top-12 w-56 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-soft" role="menu" aria-label="User menu">
                  <button type="button" onClick={() => setIsProfileOpen((open) => !open)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-panel)] focus-ring" role="menuitem" aria-expanded={isProfileOpen}>
                    <span>Profile</span>
                    <Sparkles size={14} aria-hidden="true" />
                  </button>
                  {isProfileOpen ? (
                    <div className="mx-1 mb-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-muted)]">
                      <p className="font-medium text-[var(--color-ink)]">HJ</p>
                      <p>FOMI Studio Account</p>
                    </div>
                  ) : null}
                  <div className="my-2 rounded-xl bg-[var(--color-panel)] p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-ink)]">Email notifications</span>
                      <button type="button" onClick={() => toggleSetting('emailNotifications')} aria-label="Toggle email notifications" className={`relative h-6 w-11 rounded-full transition ${settings.emailNotifications ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}>
                        <span className={`absolute top-1 h-4 w-4 rounded-full bg-[var(--color-control)] transition ${settings.emailNotifications ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-[var(--color-ink)]">Weekly summary</span>
                      <button type="button" onClick={() => toggleSetting('weeklySummary')} aria-label="Toggle weekly summary" className={`relative h-6 w-11 rounded-full transition ${settings.weeklySummary ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}>
                        <span className={`absolute top-1 h-4 w-4 rounded-full bg-[var(--color-control)] transition ${settings.weeklySummary ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                  <button type="button" onClick={() => setIsClearHistoryOpen(true)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-[var(--color-panel)] focus-ring" role="menuitem" aria-label="Clear generation history">
                    <span>Clear history</span>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={toggleSession} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-panel)] focus-ring" role="menuitem">
                    <span>{isSignedIn ? 'Sign out' : 'Sign in'}</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {isMobileMenuOpen ? (
          <div className="absolute right-3 top-[58px] flex w-44 flex-col gap-2 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-soft sm:hidden">
            <button type="button" onClick={() => { setIsMobileMenuOpen(false); openGallery(); }} className="rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--color-panel)] focus-ring">Gallery</button>
            <button type="button" onClick={() => { setIsMobileMenuOpen(false); setIsSupportOpen(true); }} className="rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--color-panel)] focus-ring">Support</button>
          </div>
        ) : null}
      </header>

      {isClearHistoryOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && setIsClearHistoryOpen(false)}>
          <div ref={clearDialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="header-clear-history-title" className="w-full max-w-sm rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-soft">
            <h2 id="header-clear-history-title" className="text-lg font-semibold text-[var(--color-ink)]">Clear generation history?</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">This removes every generation from this device. You can undo for 6 seconds.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setIsClearHistoryOpen(false)} className="rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-4 py-2 text-sm text-[var(--color-ink)] transition hover:bg-[var(--color-control-hover)] focus-ring">Cancel</button>
              <button type="button" onClick={confirmClearHistory} className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white focus-ring">Clear history</button>
            </div>
          </div>
        </div>
      ) : null}
      {isSupportOpen ? (
        <SupportDialog onClose={() => setIsSupportOpen(false)} />
      ) : null}
    </>
  );
};

function SupportDialog({ onClose }) {
  const [openFaq, setOpenFaq] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll('button:not([disabled]), input, textarea, a[href]'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const faqs = [
    { q: 'How do I generate an image?', a: 'Select a mode, add a prompt, choose a style and model, then click Generate.' },
    { q: 'Can I turn a video prompt into a clip?', a: 'Yes. Switch to Video mode, choose a compatible model, and generate.' },
    { q: 'What kinds of exports are supported?', a: 'The mock API supports still images and short video concepts for previewing.' },
  ];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Please enter your name.';
    if (!/\S+@\S+\.\S+/.test(form.email)) nextErrors.email = 'Please enter a valid email.';
    if (!form.message.trim()) nextErrors.message = 'Please tell us what you need help with.';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setStatus('sending');
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Support request failed');
      setStatus('success');
      setForm({ name: '', email: '', message: '' });
      setTimeout(() => onClose(), 1200);
    } catch (error) {
      setStatus('error');
      setErrors({ submit: error.message || 'Unable to send support request.' });
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-3" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="support-title" className="max-h-[100dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] p-5 shadow-soft sm:max-h-[90dvh]">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="support-title" className="text-xl font-semibold text-[var(--color-ink)]">Support</h2>
          <button type="button" onClick={onClose} className="rounded-full border border-[var(--color-border)] bg-[var(--color-control)] px-2 py-1 text-sm text-[var(--color-ink)] transition hover:bg-[var(--color-control-hover)] focus-ring" aria-label="Close support dialog">✕</button>
        </div>

        <div className="grid gap-5 md:grid-cols-[1.05fr_1.2fr]">
          <div>
            <div className="space-y-2">
              {faqs.map((faq, index) => (
                <div key={faq.q} className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <button type="button" onClick={() => setOpenFaq((current) => (current === index ? -1 : index))} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-[var(--color-ink)] focus-ring" aria-expanded={openFaq === index}>
                    <span>{faq.q}</span>
                    <span>{openFaq === index ? '−' : '+'}</span>
                  </button>
                  {openFaq === index ? <p className="px-3 pb-3 text-sm text-[var(--color-muted)]">{faq.a}</p> : null}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div>
              <label htmlFor="support-name" className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Name</label>
              <input id="support-name" name="name" value={form.name} onChange={handleChange} className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-control)] px-3 py-2 text-sm outline-none ring-0 focus:border-[var(--color-accent)]" aria-invalid={Boolean(errors.name)} />
              {errors.name ? <p className="mt-1 text-xs text-red-500">{errors.name}</p> : null}
            </div>
            <div>
              <label htmlFor="support-email" className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Email</label>
              <input id="support-email" name="email" type="email" value={form.email} onChange={handleChange} className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-control)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" aria-invalid={Boolean(errors.email)} />
              {errors.email ? <p className="mt-1 text-xs text-red-500">{errors.email}</p> : null}
            </div>
            <div>
              <label htmlFor="support-message" className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Message</label>
              <textarea id="support-message" name="message" value={form.message} onChange={handleChange} rows={5} className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-control)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" aria-invalid={Boolean(errors.message)} />
              {errors.message ? <p className="mt-1 text-xs text-red-500">{errors.message}</p> : null}
            </div>
            {errors.submit ? <p className="text-xs text-red-500">{errors.submit}</p> : null}
            {status === 'success' ? <p className="text-xs font-medium text-emerald-600">Support request sent successfully.</p> : null}
            <button type="submit" disabled={status === 'sending'} className="w-full rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70 focus-ring">
              {status === 'sending' ? 'Sending…' : 'Send message'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AppHeader;