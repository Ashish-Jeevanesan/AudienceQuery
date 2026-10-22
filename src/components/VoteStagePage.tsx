/**
 * @file src/components/VoteStagePage.tsx
 * @description Module 4 of the voting feature: a projected, full-screen live
 * results display, routed at /vote/stage. Its own standalone page with an
 * inline sign-in (same self-contained pattern as ComplaintsDashboard/
 * LogsPage), gated to admin/moderator/stage -- the same access level as the
 * existing Q&A Stage view. Staff pick which voting to project (open OR
 * already-closed, so a final result can stay up after a poll ends); counts
 * update live over the app's existing SSE stream, no polling.
 *
 * Deliberately shows only the live per-option bars and totals -- suspicion
 * flags and invalidated-vote detail stay in the Monitor screen and never
 * reach this audience-facing display (see the approved design's Open
 * Question 5).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, RefreshCw, Trophy, ExternalLink, LogOut } from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { Voting, VotingOption } from '../types';

const BAR_COLORS = ['#4F46E5', '#D97706', '#059669', '#DB2777', '#0891B2', '#7C3AED'];

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-primary p-4" style={{ backgroundColor: `rgb(var(--background))` }}>
      <div className="w-full max-w-sm text-center space-y-3">{children}</div>
    </div>
  );
}

export const VoteStagePage: React.FC = () => {
  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [votings, setVotings] = useState<Voting[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [projectedId, setProjectedId] = useState<string | null>(null);

  const authFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const { data: { session: current } } = await supabase.auth.getSession();
    if (!current) throw new Error('Sign-in is required');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${current.access_token}`);
    return fetch(input, { ...init, headers });
  };

  const resolveAccess = async () => {
    const { data: { session: current } } = await supabase.auth.getSession();
    setSession(current);
    if (!current) {
      setHasAccess(null);
      setCheckingSession(false);
      return;
    }
    try {
      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${current.access_token}` } });
      const roles: string[] = res.ok ? (await res.json()).roles || [] : [];
      setHasAccess(roles.includes('admin') || roles.includes('moderator') || roles.includes('stage'));
    } catch {
      setHasAccess(false);
    }
    setCheckingSession(false);
  };

  useEffect(() => {
    resolveAccess();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => resolveAccess());
    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchVotings = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authFetch('/api/votings');
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to load votings');
      setVotings(await res.json());
    } catch (err: any) {
      setLoadError(err.message || 'Unable to load votings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) fetchVotings();
  }, [hasAccess]);

  // Live updates over the app's existing SSE channel -- the same one Q&A
  // uses -- filtered to just the voting currently projected on screen.
  const projectedIdRef = useRef(projectedId);
  useEffect(() => { projectedIdRef.current = projectedId; }, [projectedId]);

  useEffect(() => {
    if (!hasAccess) return;
    const source = new EventSource('/api/stream');
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'voting:tally' && payload.data?.votingId === projectedIdRef.current) {
          setVotings(list => list.map(v => v.id === payload.data.votingId
            ? { ...v, options: payload.data.options, totalVotes: payload.data.totalVotes }
            : v));
        } else if (payload.type === 'voting:updated' || payload.type === 'voting:deleted') {
          fetchVotings();
        }
      } catch {
        // Non-JSON or unrelated SSE frame -- ignore.
      }
    };
    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess]);

  // Safety-net poll, independent of SSE health -- same reasoning as the
  // one in useRealTimeQnA.ts: on Vercel, a vote cast against one serverless
  // instance can't reach an SSE connection held open by a different one,
  // so this screen could otherwise go stale indefinitely with no visible
  // error. A projected results screen above all must self-heal without
  // anyone having to refresh it.
  useEffect(() => {
    if (!hasAccess) return;
    const pollInterval = setInterval(fetchVotings, 8000);
    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess]);

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
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const projected = votings.find(v => v.id === projectedId) || null;
  const maxVotes = projected ? Math.max(1, ...projected.options.map(o => o.voteCount || 0)) : 1;

  if (checkingSession) {
    return <CenteredShell><p className="text-secondary text-sm">Loading…</p></CenteredShell>;
  }

  if (!session) {
    return (
      <CenteredShell>
        <form onSubmit={submitLogin} className="w-full rounded-2xl bg-surface p-6 shadow-2xl border border-divider text-left space-y-1">
          <h2 className="text-xl font-bold text-primary">Sign in</h2>
          <p className="text-sm text-secondary">The voting Stage display is restricted. Sign in to continue.</p>
          <label className="mt-4 block text-sm font-medium text-secondary">Email
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-base mt-1 w-full" autoComplete="email" />
          </label>
          <label className="mt-3 block text-sm font-medium text-secondary">Password
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-base mt-1 w-full" autoComplete="current-password" />
          </label>
          {loginError && <p className="mt-3 text-sm text-rose-600">{loginError}</p>}
          <div className="mt-5 flex justify-between items-center">
            <Link to="/root" className="text-sm text-secondary hover:text-primary flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back to app</Link>
            <button disabled={isLoggingIn} type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{isLoggingIn ? 'Signing in…' : 'Sign in'}</button>
          </div>
        </form>
      </CenteredShell>
    );
  }

  if (hasAccess === null) {
    return <CenteredShell><p className="text-secondary text-sm">Checking access…</p></CenteredShell>;
  }

  if (hasAccess === false) {
    return (
      <CenteredShell>
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-primary">Restricted</h2>
        <p className="text-sm text-secondary">Your account doesn't have access to this screen.</p>
        <Link to="/root" className="inline-flex items-center gap-1 text-sm text-indigo-500 hover:underline"><ArrowLeft className="w-4 h-4" /> Back to app</Link>
      </CenteredShell>
    );
  }

  // Full-screen projected results -- picked a voting to show.
  if (projected) {
    return (
      <div className="min-h-screen flex flex-col text-primary" style={{ backgroundColor: `rgb(var(--background))` }}>
        <header className="flex items-center justify-between px-6 py-4 border-b border-divider">
          <button onClick={() => setProjectedId(null)} className="flex items-center gap-1.5 text-sm font-semibold text-secondary hover:text-primary">
            <ArrowLeft className="w-4 h-4" /> Change poll
          </button>
          <span className="text-xs font-mono text-muted uppercase tracking-wider">{projected.status === 'closed' ? 'Final Result' : 'Live'}</span>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-8 py-8 sm:px-16 lg:px-24">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-center mb-12 lg:mb-16" style={{ fontFamily: 'Fraunces, serif' }}>{projected.question}</h1>
          <div className="w-full max-w-7xl space-y-8 lg:space-y-10">
            {[...projected.options].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0)).map((o: VotingOption, i) => {
              const pct = Math.round(((o.voteCount || 0) / maxVotes) * 100);
              return (
                <div key={o.id} className="space-y-2.5">
                  <div className="flex items-start justify-between text-xl sm:text-2xl lg:text-3xl font-bold gap-4">
                    <span className="flex items-center gap-4 lg:gap-5 min-w-0">
                      {o.photoUrl && (
                        <img src={o.photoUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full object-cover border-4 shrink-0" style={{ borderColor: `rgb(var(--border-strong))` }} />
                      )}
                      <span className="flex items-start gap-3 min-w-0">
                        {i === 0 && (o.voteCount || 0) > 0 && <Trophy className="w-7 h-7 lg:w-8 lg:h-8 text-amber-500 shrink-0 mt-1" />}
                        <span>{o.label}</span>
                      </span>
                    </span>
                    <span className="font-mono shrink-0">{o.voteCount || 0}</span>
                  </div>
                  <div className="h-10 sm:h-14 lg:h-16 rounded-xl bg-surface-secondary overflow-hidden">
                    <div
                      className="h-full rounded-xl transition-all duration-700 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-12 lg:mt-16 text-lg sm:text-xl text-muted">{projected.totalVotes} total vote{projected.totalVotes === 1 ? '' : 's'}</p>
        </main>
      </div>
    );
  }

  // Picker: choose which voting to project.
  return (
    <div className="min-h-screen text-primary" style={{ backgroundColor: `rgb(var(--background))` }}>
      <header className="sticky top-0 z-10 bg-surface border-b border-divider px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/root" className="p-2.5 rounded-lg hover:bg-surface-hover text-secondary flex-shrink-0" title="Back to app"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="text-base font-bold text-primary truncate">Vote Results Stage</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link to="/ask" title="Switch to Q&A Stage" className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider transition">
            <ExternalLink className="w-4 h-4" />
          </Link>
          <button onClick={fetchVotings} disabled={loading} title="Refresh" className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider transition disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleLogout} title="Sign out" className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
      <main className="p-4 sm:p-6 max-w-2xl mx-auto space-y-3">
        {loadError && <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-sm">{loadError}</div>}
        {votings.length === 0 ? (
          <p className="text-sm text-muted text-center py-12">No votings yet. Create one from Manage Votings in the Moderator screen.</p>
        ) : (
          votings.map(v => (
            <button
              key={v.id}
              onClick={() => setProjectedId(v.id)}
              className="card w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-surface-hover transition"
              style={{ backgroundColor: `rgb(var(--surface-elevated))` }}
            >
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{v.question}</p>
                <p className="text-xs text-muted mt-0.5">{v.totalVotes} vote{v.totalVotes === 1 ? '' : 's'} · {v.options.length} options</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold shrink-0 ${
                v.status === 'open' ? 'cat-badge-emerald' : v.status === 'closed' ? 'cat-badge-rose' : 'cat-badge-amber'
              }`}>{v.status}</span>
            </button>
          ))
        )}
      </main>
    </div>
  );
};
