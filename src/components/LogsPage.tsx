/**
 * @file src/components/LogsPage.tsx
 * @description A standalone, admin-only page (routed at /logs, not linked
 * anywhere except the Footer for admins) for viewing the application's
 * server-side logs -- pretty-printed, filterable by level, searchable, with
 * auto-refresh and auto-scroll. Reachable directly by URL, so it carries
 * its own sign-in form rather than assuming the visitor already has a
 * session from the main app.
 *
 * This is an internal admin tool, like Moderator/Panel/Stage -- it stays
 * English-only, out of the audience-facing i18n scope.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Search, RefreshCw, ArrowLeft, ShieldAlert, Pause, Play, ArrowDownToLine } from 'lucide-react';

type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  raw: string;
}

const LOG_LINE_RE = /^\[(.+?)\]\s+(INFO|ERROR|WARN|DEBUG):\s?([\s\S]*)$/;

/** The logger writes UTC timestamps (`toISOString()`); render them in the viewer's own local time zone instead. */
function formatLocalTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (isNaN(date.getTime())) return isoTimestamp;
  const datePart = date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timePart = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${datePart} ${timePart}.${ms}`;
}
const REFRESH_INTERVAL_MS = 5000;

const LEVEL_STYLES: Record<LogLevel, string> = {
  INFO: 'text-secondary',
  DEBUG: 'text-muted',
  WARN: 'text-amber-500',
  ERROR: 'text-rose-500'
};

const LEVEL_BADGE: Record<LogLevel, string> = {
  INFO: 'cat-badge-sky',
  DEBUG: 'bg-surface-secondary border-divider text-muted',
  WARN: 'cat-badge-amber',
  ERROR: 'cat-badge-rose'
};

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-primary p-4">
      <div className="w-full max-w-sm text-center space-y-3">{children}</div>
    </div>
  );
}

export const LogsPage: React.FC = () => {
  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Inline login form (this page can be reached directly by URL with no
  // existing app session, so it can't rely on App.tsx's login modal).
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [rawLog, setRawLog] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState<'all' | LogLevel>('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const resolveAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    if (!session) {
      setIsAdmin(null);
      setCheckingSession(false);
      return;
    }
    try {
      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${session.access_token}` } });
      setIsAdmin(res.ok ? (await res.json()).role === 'admin' : false);
    } catch {
      setIsAdmin(false);
    }
    setCheckingSession(false);
  };

  useEffect(() => {
    resolveAccess();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => resolveAccess());
    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchLogs = async () => {
    if (!session) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/logs', { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Unable to load logs');
      }
      setRawLog(await res.text());
    } catch (err: any) {
      setLoadError(err.message || 'Unable to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !autoRefresh) return;
    const interval = setInterval(fetchLogs, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, autoRefresh]);

  const entries = useMemo<LogEntry[]>(() => {
    return rawLog.split('\n').filter(line => line.trim().length > 0).map(line => {
      const m = line.match(LOG_LINE_RE);
      if (m) return { timestamp: m[1], level: m[2] as LogLevel, message: m[3], raw: line };
      return { timestamp: '', level: 'INFO' as LogLevel, message: line, raw: line };
    });
  }, [rawLog]);

  // On Vercel, file logging is disabled and /api/logs returns a plain
  // sentence instead of structured lines -- detect that and show it as a
  // message rather than an empty, confusingly-filterable table.
  const looksStructured = entries.some(e => e.timestamp);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (levelFilter !== 'all' && e.level !== levelFilter) return false;
      if (search && !e.raw.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [entries, levelFilter, search]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered, autoScroll]);

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
    setIsLoggingIn(false);
    // session/isAdmin update via the onAuthStateChange listener above
  };

  // --- Render states ---

  if (checkingSession) {
    return <CenteredShell><p className="text-secondary text-sm">Loading…</p></CenteredShell>;
  }

  if (!session) {
    return (
      <CenteredShell>
        <form onSubmit={submitLogin} className="w-full rounded-2xl bg-surface p-6 shadow-2xl border border-divider text-left space-y-1">
          <h2 className="text-xl font-bold text-primary">Sign in</h2>
          <p className="text-sm text-secondary">This page is restricted to admins. Sign in to continue.</p>
          <label className="mt-4 block text-sm font-medium text-secondary">Email
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-base mt-1 w-full" autoComplete="email" />
          </label>
          <label className="mt-3 block text-sm font-medium text-secondary">Password
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-base mt-1 w-full" autoComplete="current-password" />
          </label>
          {loginError && <p className="mt-3 text-sm text-rose-600">{loginError}</p>}
          <div className="mt-5 flex justify-between items-center">
            <Link to="/" className="text-sm text-secondary hover:text-primary flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back to app</Link>
            <button disabled={isLoggingIn} type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{isLoggingIn ? 'Signing in…' : 'Sign in'}</button>
          </div>
        </form>
      </CenteredShell>
    );
  }

  if (isAdmin === null) {
    return <CenteredShell><p className="text-secondary text-sm">Checking access…</p></CenteredShell>;
  }

  if (isAdmin === false) {
    return (
      <CenteredShell>
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-primary">Admins only</h2>
        <p className="text-sm text-secondary">Your account doesn't have access to this page.</p>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-indigo-500 hover:underline"><ArrowLeft className="w-4 h-4" /> Back to app</Link>
      </CenteredShell>
    );
  }

  return (
    <div className="min-h-screen text-primary font-sans">
      <header className="sticky top-0 z-10 bg-surface border-b border-divider px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg hover:bg-surface-hover text-secondary" title="Back to app"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="text-base font-bold text-primary">Application Logs</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search logs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500 w-44"
            />
          </div>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-divider text-xs text-secondary bg-surface outline-none"
          >
            <option value="all">All levels</option>
            <option value="ERROR">Error</option>
            <option value="WARN">Warn</option>
            <option value="INFO">Info</option>
            <option value="DEBUG">Debug</option>
          </select>
          <button
            onClick={() => setAutoScroll(v => !v)}
            title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
            className={`p-2 rounded-lg border transition ${autoScroll ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-surface-secondary text-secondary border-divider hover:bg-surface-hover'}`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setAutoRefresh(v => !v)}
            title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
            className="p-2 rounded-lg bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider transition"
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            title="Refresh now"
            className="p-2 rounded-lg bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider transition disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        {loadError && (
          <div className="mb-4 p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-sm">{loadError}</div>
        )}

        {!loadError && !looksStructured && rawLog && (
          <div className="p-4 rounded-xl border border-divider bg-surface-secondary text-secondary text-sm">{rawLog}</div>
        )}

        {!loadError && (looksStructured || !rawLog) && (
          <div
            ref={scrollRef}
            className="rounded-xl border border-divider bg-surface overflow-y-auto"
            style={{ height: 'calc(100vh - 160px)' }}
          >
            {filtered.length === 0 ? (
              <p className="text-sm text-muted p-6 text-center">
                {entries.length === 0 ? 'No logs yet.' : 'No log lines match the current filter/search.'}
              </p>
            ) : (
              <div className="divide-y divide-divider">
                {filtered.map((entry, i) => (
                  <div key={i} className="px-4 py-2 flex items-start gap-3 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    <span className={`px-1.5 py-0.5 rounded border shrink-0 font-bold text-[10px] ${LEVEL_BADGE[entry.level]}`}>{entry.level}</span>
                    {entry.timestamp && (
                      <span className="text-muted shrink-0 whitespace-nowrap" title={`${entry.timestamp} UTC`}>
                        {formatLocalTimestamp(entry.timestamp)}
                      </span>
                    )}
                    <span className={`break-all ${LEVEL_STYLES[entry.level]}`}>{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="mt-3 text-xs text-muted">
          {entries.length > 0 && `${filtered.length} of ${entries.length} lines shown. `}
          {autoRefresh ? `Auto-refreshing every ${REFRESH_INTERVAL_MS / 1000}s. ` : 'Auto-refresh paused. '}
          {looksStructured && 'Times shown in your local time zone (hover a timestamp for UTC).'}
        </p>
      </main>
    </div>
  );
};
