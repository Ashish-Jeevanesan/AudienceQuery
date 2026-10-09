/**
 * @file src/components/ChooserPage.tsx
 * @description The new landing screen, routed at /root -- bare `/` defers
 * to the `prod_release` flag (see RootRedirect), so this will eventually be
 * the first thing anyone visiting the site sees. Offers Ask a Question
 * (/ask) or Raise a Complaint (/complain) to the public, same as always.
 *
 * Also auth-aware: if a `management`/`admin` session already exists (e.g.
 * from a previous sign-in anywhere in the app -- Supabase Auth's session
 * persists across the whole SPA), it additionally offers a "Go to
 * Dashboard" option. A `management`-only account (no admin) sees ONLY that
 * option -- Ask/Raise aren't relevant to their job function. Admin always
 * sees everything, matching the "admin is a superset" pattern used
 * throughout this app. A visitor with no session at all can sign in here
 * via a small "Staff sign in" control, so staff arriving through the same
 * shared QR code/link as everyone else land on their own screen without
 * needing to separately know about /dashboard.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare, MessageSquareWarning, LayoutDashboard, Sun, Moon, ChevronRight, ShieldCheck, LogOut } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { supabase } from '../supabaseClient';

export const ChooserPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);

  const [session, setSession] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const resolveAccess = async () => {
    const { data: { session: current } } = await supabase.auth.getSession();
    setSession(current);
    if (!current) {
      setRoles([]);
      return;
    }
    try {
      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${current.access_token}` } });
      setRoles(res.ok ? (await res.json()).roles || [] : []);
    } catch {
      setRoles([]);
    }
  };

  useEffect(() => {
    resolveAccess();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => resolveAccess());
    return () => authListener.subscription.unsubscribe();
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setLoginError(error?.message || 'Unable to sign in.');
      setIsLoggingIn(false);
      return;
    }
    setPassword('');
    setIsLoginOpen(false);
    setIsLoggingIn(false);
    // roles refresh via the onAuthStateChange listener above
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = roles.includes('admin');
  const isManagement = roles.includes('management');
  const hasDashboardAccess = isAdmin || isManagement;
  // A management account with no admin access has no reason to see the
  // public Ask/Raise options -- route them straight to their one screen.
  const dashboardOnly = hasDashboardAccess && !isAdmin;

  type Card = { key: string; onClick: () => void; icon: React.ReactNode; bg: string; title: string; desc: string };

  const cards: Card[] = dashboardOnly
    ? [{
        key: 'dashboard',
        onClick: () => navigate('/dashboard'),
        icon: <LayoutDashboard className="w-6 h-6 text-white" />,
        bg: `rgb(var(--primary))`,
        title: 'Go to Dashboard',
        desc: 'Review and manage submitted complaints.'
      }]
    : [
        {
          key: 'ask',
          onClick: () => navigate('/ask'),
          icon: <MessageSquare className="w-6 h-6 text-white" />,
          bg: `rgb(var(--primary))`,
          title: t('chooser.askQuestion'),
          desc: t('chooser.askQuestionDesc')
        },
        {
          key: 'complain',
          onClick: () => navigate('/complain'),
          icon: <MessageSquareWarning className="w-6 h-6" style={{ color: `rgb(var(--accent-text))` }} />,
          bg: `rgb(var(--accent))`,
          title: t('chooser.raiseComplaint'),
          desc: t('chooser.raiseComplaintDesc')
        },
        ...(isAdmin ? [{
          key: 'dashboard',
          onClick: () => navigate('/dashboard'),
          icon: <LayoutDashboard className="w-6 h-6 text-white" />,
          bg: `rgb(var(--primary))`,
          title: 'Go to Dashboard',
          desc: 'Review and manage submitted complaints.'
        }] : [])
      ];

  const gridColsClass = cards.length === 1 ? '' : cards.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: `rgb(var(--background))` }}>
      <header className="sticky top-0 z-40 bg-surface border-b border-divider">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{ backgroundColor: `rgb(var(--primary))`, color: `rgb(var(--primary-text))` }}
              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm tracking-tighter shadow-md flex-shrink-0"
            >
              AQ
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <LanguageSwitcher />
            <button
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-hover transition"
              style={{ color: `rgb(var(--text-secondary))` }}
              aria-label={t('header.toggleTheme')}
              title={t('header.toggleTheme')}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {session ? (
              <button
                onClick={handleLogout}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-hover transition"
                style={{ color: `rgb(var(--text-secondary))` }}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-hover transition"
                style={{ color: `rgb(var(--text-secondary))` }}
                aria-label="Staff sign in"
                title="Staff sign in"
              >
                <ShieldCheck className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div
        className="flex-1 flex items-center justify-center px-4 py-10 sm:px-6"
        style={{ backgroundColor: `rgb(var(--hero-background))` }}
      >
        <div className="w-full max-w-2xl space-y-8 text-center">
          <div>
            <h1 className="text-4xl sm:text-6xl font-bold leading-tight" style={{ color: `rgb(var(--hero-text-primary))` }}>
              {dashboardOnly ? 'Welcome back' : t('chooser.title')}
            </h1>
            <p className="mt-3 text-lg" style={{ color: `rgb(var(--hero-text-secondary))` }}>
              {dashboardOnly ? 'Continue to the complaints dashboard.' : t('chooser.subtitle')}
            </p>
          </div>

          <div className={`grid gap-4 ${gridColsClass} ${cards.length === 1 ? 'max-w-sm mx-auto' : ''}`}>
            {cards.map(card => (
              <button
                key={card.key}
                onClick={card.onClick}
                className="card text-left p-6 sm:p-8 flex flex-col gap-3 hover:bg-surface-hover transition"
                style={{ backgroundColor: `rgb(var(--surface-elevated))` }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: card.bg }}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-xl font-bold flex items-center gap-1.5" style={{ color: `rgb(var(--text-primary))` }}>
                    {card.title} <ChevronRight className="w-5 h-5 opacity-50" />
                  </p>
                  <p className="text-sm mt-1" style={{ color: `rgb(var(--text-secondary))` }}>
                    {card.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form onSubmit={submitLogin} className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-primary">Staff sign in</h2>
            <p className="mt-1 text-sm text-secondary">Sign in with your admin or management account.</p>
            <label className="mt-5 block text-sm font-medium text-secondary">Email
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-base mt-1 w-full" autoComplete="email" />
            </label>
            <label className="mt-3 block text-sm font-medium text-secondary">Password
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-base mt-1 w-full" autoComplete="current-password" />
            </label>
            {loginError && <p className="mt-3 text-sm text-rose-600">{loginError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsLoginOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-secondary">Cancel</button>
              <button disabled={isLoggingIn} type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{isLoggingIn ? 'Signing in…' : 'Sign in'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
