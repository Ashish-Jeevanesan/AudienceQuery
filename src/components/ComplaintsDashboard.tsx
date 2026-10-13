/**
 * @file src/components/ComplaintsDashboard.tsx
 * @description The complaints management dashboard, routed at /dashboard --
 * an internal staff tool (English-only, like Moderator/Panel/Stage) for the
 * `admin` and `management` roles. Mirrors LogsPage's self-contained-page
 * pattern (its own inline sign-in, since this is reachable directly by URL
 * rather than through App.tsx's role router) but adds a real workflow on
 * top: each complaint moves through exactly 3 steps --
 * acknowledge/categorize -> assign (free-text name) -> resolve (optional
 * photo) -- enforced both by which action the detail panel shows and by the
 * server rejecting out-of-order transitions.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Fuse from 'fuse.js';
import { supabase } from '../supabaseClient';
import { compressImage } from '../imageCompress';
import type { Complaint, ComplaintStatus } from '../types';
import { COMPLAINT_CATEGORIES } from '../types';
import {
  ArrowLeft, ShieldAlert, RefreshCw, Search, Phone, Clock, Camera,
  CheckCircle2, ClipboardList, UserPlus, X, Image as ImageIcon, BookOpen,
  PauseCircle, PlayCircle
} from 'lucide-react';

const STATUS_LABEL: Record<ComplaintStatus, string> = {
  open: 'New',
  acknowledged: 'Categorized',
  assigned: 'Assigned',
  resolved: 'Resolved'
};

const STATUS_BADGE: Record<ComplaintStatus, string> = {
  open: 'cat-badge-rose',
  acknowledged: 'cat-badge-amber',
  assigned: 'cat-badge-sky',
  resolved: 'cat-badge-emerald'
};

const STATUS_TABS: Array<{ key: 'all' | ComplaintStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'New' },
  { key: 'acknowledged', label: 'Categorized' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'resolved', label: 'Resolved' }
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(COMPLAINT_CATEGORIES.map(c => [c.value, c.label]));

const REFRESH_INTERVAL_MS = 20000;

/** Humanizes a millisecond duration as e.g. "3h 24m", "2d 5h", "45m", "<1m". */
function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-primary p-4" style={{ backgroundColor: `rgb(var(--background))` }}>
      <div className="w-full max-w-sm text-center space-y-3">{children}</div>
    </div>
  );
}

export const ComplaintsDashboard: React.FC = () => {
  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  // Inline sign-in (this page can be opened directly by URL with no
  // existing session -- it carries its own form rather than assuming the
  // visitor already signed in through the main app).
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | ComplaintStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Global intake kill switch (see GET/PATCH /api/rules/complaints-open in
  // server.ts) -- lets admin/management stop new submissions on demand, e.g.
  // an overflow of tickets at an event. null while still loading so the
  // button doesn't briefly render the wrong state.
  const [complaintsOpen, setComplaintsOpen] = useState<boolean | null>(null);
  const [togglingIntake, setTogglingIntake] = useState(false);

  useEffect(() => {
    document.title = 'Complaints Dashboard';
  }, []);

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
      setHasAccess(roles.includes('admin') || roles.includes('management'));
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

  const fetchComplaints = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authFetch('/api/complaints');
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to load complaints');
      setComplaints(await res.json());
    } catch (err: any) {
      setLoadError(err.message || 'Unable to load complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) fetchComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess]);

  const fetchIntakeStatus = async () => {
    try {
      const res = await fetch('/api/rules/complaints-open');
      const data = await res.json();
      setComplaintsOpen(data.open !== false);
    } catch {
      setComplaintsOpen(true);
    }
  };

  useEffect(() => {
    if (hasAccess) fetchIntakeStatus();
  }, [hasAccess]);

  const toggleIntake = async () => {
    if (complaintsOpen === null || togglingIntake) return;
    const next = !complaintsOpen;
    setTogglingIntake(true);
    try {
      const res = await authFetch('/api/rules/complaints-open', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open: next })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update');
      setComplaintsOpen(next);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to update complaint intake setting');
    } finally {
      setTogglingIntake(false);
    }
  };

  useEffect(() => {
    if (!hasAccess) return;
    const interval = setInterval(fetchComplaints, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
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

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: complaints.length };
    for (const status of ['open', 'acknowledged', 'assigned', 'resolved'] as ComplaintStatus[]) {
      c[status] = complaints.filter(x => x.status === status).length;
    }
    return c;
  }, [complaints]);

  // Fuzzy, not exact-substring: tolerates typos/partial matches against
  // exactly the 3 fields a staff member would actually search by (ticket
  // number, who raised it, their phone number) -- not the complaint body
  // text, which is free-form and would make matches too noisy.
  const searchIndex = useMemo(
    () => new Fuse(complaints, { keys: ['ticketNumber', 'name', 'phone'], threshold: 0.35, ignoreLocation: true }),
    [complaints]
  );

  const filtered = useMemo(() => {
    const query = search.trim();
    const base = query ? searchIndex.search(query).map(r => r.item) : complaints;
    return base.filter(c => statusFilter === 'all' || c.status === statusFilter);
  }, [complaints, searchIndex, statusFilter, search]);

  const selected = complaints.find(c => c.id === selectedId) || null;

  const applyUpdate = (updated: Complaint) => {
    setComplaints(list => list.map(c => (c.id === updated.id ? updated : c)));
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
          <p className="text-sm text-secondary">This dashboard is restricted. Sign in to continue.</p>
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
        <p className="text-sm text-secondary">Your account doesn't have access to this dashboard.</p>
        <Link to="/root" className="inline-flex items-center gap-1 text-sm text-indigo-500 hover:underline"><ArrowLeft className="w-4 h-4" /> Back to app</Link>
      </CenteredShell>
    );
  }

  return (
    <div className="min-h-screen text-primary font-sans" style={{ backgroundColor: `rgb(var(--background))` }}>
      <header className="sticky top-0 z-10 bg-surface border-b border-divider px-4 sm:px-6 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/root" className="p-2.5 rounded-lg hover:bg-surface-hover text-secondary flex-shrink-0" title="Back to app"><ArrowLeft className="w-4 h-4" /></Link>
            <h1 className="text-base font-bold text-primary truncate">Complaints Dashboard</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              to="/guide"
              title="Guide"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider transition"
            >
              <BookOpen className="w-4 h-4" />
            </Link>
            <button
              onClick={toggleIntake}
              disabled={complaintsOpen === null || togglingIntake}
              title={complaintsOpen === false ? 'Not accepting new complaints -- click to reopen' : 'Accepting new complaints -- click to stop intake'}
              className={`h-10 px-3 flex items-center gap-1.5 rounded-lg border transition disabled:opacity-60 text-xs font-bold ${
                complaintsOpen === false
                  ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                  : 'bg-surface-secondary text-secondary hover:bg-surface-hover border-divider'
              }`}
            >
              {complaintsOpen === false ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
              <span className="hidden sm:inline">{complaintsOpen === false ? 'Intake paused' : 'Intake open'}</span>
            </button>
            <button
              onClick={fetchComplaints}
              disabled={loading}
              title="Refresh"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider transition disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, phone, or ticket number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base w-full"
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`shrink-0 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                statusFilter === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider'
              }`}
            >
              {tab.label} <span className="opacity-70">({counts[tab.key] ?? 0})</span>
            </button>
          ))}
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-3xl mx-auto">
        {loadError && (
          <div className="mb-4 p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-sm">{loadError}</div>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-muted text-center py-12">
            {complaints.length === 0 ? 'No complaints yet.' : 'No complaints match the current filter/search.'}
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="card w-full text-left p-4 flex flex-col gap-2 hover:bg-surface-hover transition"
                style={{ backgroundColor: `rgb(var(--surface-elevated))` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold tracking-wide" style={{ color: `rgb(var(--primary))` }}>{c.ticketNumber}</span>
                  <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold shrink-0 ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                </div>
                <p className="text-sm font-semibold text-primary truncate">{c.name} · {c.phone}</p>
                <p className="text-sm text-secondary line-clamp-2">{c.complaintText}</p>
                <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatTimestamp(c.createdAt)}</span>
                  {c.category && <span className="px-2 py-0.5 rounded-full cat-badge-indigo border text-[10px] font-bold">{CATEGORY_LABEL[c.category] || c.category}</span>}
                  {c.assignedTo && <span>Assigned: <strong className="text-secondary">{c.assignedTo}</strong></span>}
                  {c.status === 'resolved' && c.resolvedAt && (
                    <span className="flex items-center gap-1 font-semibold" style={{ color: `rgb(var(--success))` }}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolved in {formatDuration(new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime())}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {selected && (
        <ComplaintDetailModal
          complaint={selected}
          onClose={() => setSelectedId(null)}
          onUpdated={applyUpdate}
          authFetch={authFetch}
        />
      )}
    </div>
  );
};

// --- Detail / action modal ---

interface ComplaintDetailModalProps {
  complaint: Complaint;
  onClose: () => void;
  onUpdated: (c: Complaint) => void;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const ComplaintDetailModal: React.FC<ComplaintDetailModalProps> = ({ complaint, onClose, onUpdated, authFetch }) => {
  const [category, setCategory] = useState(complaint.category || '');
  const [assignedTo, setAssignedTo] = useState(complaint.assignedTo || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPhotoFile(file);
    setPhotoPreviewUrl(file ? URL.createObjectURL(file) : '');
  };

  const handleAcknowledge = async () => {
    if (!category) return setError('Select a category.');
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(`/api/complaints/${complaint.id}/acknowledge`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to categorize complaint');
      onUpdated(await res.json());
    } catch (err: any) {
      setError(err.message || 'Failed to categorize complaint');
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = async () => {
    if (!assignedTo.trim()) return setError('Enter who this is assigned to.');
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(`/api/complaints/${complaint.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: assignedTo.trim() })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to assign complaint');
      onUpdated(await res.json());
    } catch (err: any) {
      setError(err.message || 'Failed to assign complaint');
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async () => {
    setBusy(true);
    setError('');
    try {
      let photoPath: string | undefined;
      if (photoFile) {
        const compressed = await compressImage(photoFile, { maxSizeMB: 5, maxDimensions: 1920, targetSizeKB: 400 });
        const uploadRes = await authFetch(`/api/complaints/${complaint.id}/photo/signed-upload`, { method: 'POST' });
        if (!uploadRes.ok) throw new Error((await uploadRes.json()).error || 'Failed to get upload URL');
        const { path, token } = await uploadRes.json();
        const { error: uploadError } = await supabase.storage
          .from('complaint-media')
          .uploadToSignedUrl(path, token, compressed, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        photoPath = path;
      }

      const res = await authFetch(`/api/complaints/${complaint.id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoPath })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to resolve complaint');
      onUpdated(await res.json());
    } catch (err: any) {
      setError(err.message || 'Failed to resolve complaint');
    } finally {
      setBusy(false);
    }
  };

  const timeline = [
    { label: 'Submitted', at: complaint.createdAt, done: true },
    { label: 'Categorized', at: complaint.acknowledgedAt, done: !!complaint.acknowledgedAt },
    { label: 'Assigned', at: complaint.assignedAt, done: !!complaint.assignedAt },
    { label: 'Resolved', at: complaint.resolvedAt, done: !!complaint.resolvedAt }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-950/70 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto rounded-none sm:rounded-2xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface border-b border-divider px-5 py-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold" style={{ color: `rgb(var(--primary))` }}>{complaint.ticketNumber}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${STATUS_BADGE[complaint.status]}`}>
              {STATUS_LABEL[complaint.status]}
            </span>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-hover text-secondary flex-shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <p className="text-sm font-bold text-primary">{complaint.name}</p>
            <a href={`tel:${complaint.phone}`} className="text-sm flex items-center gap-1.5 mt-0.5" style={{ color: `rgb(var(--primary))` }}>
              <Phone className="w-3.5 h-3.5" /> {complaint.phone}
            </a>
            <p className="text-sm text-secondary mt-3 whitespace-pre-wrap">{complaint.complaintText}</p>
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-divider p-4 space-y-3" style={{ backgroundColor: `rgb(var(--surface-secondary))` }}>
            {timeline.map((step, i) => {
              const prevAt = i === 0 ? complaint.createdAt : timeline[i - 1].at;
              const duration = step.done && step.at && prevAt && i > 0
                ? formatDuration(new Date(step.at).getTime() - new Date(prevAt).getTime())
                : null;
              return (
                <div key={step.label} className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${step.done ? '' : 'opacity-30'}`} style={{ backgroundColor: step.done ? `rgb(var(--primary))` : `rgb(var(--text-disabled))` }} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${step.done ? 'text-primary' : 'text-muted'}`}>{step.label}</p>
                    {step.done && step.at && (
                      <p className="text-xs text-muted">{formatTimestamp(step.at)}{duration ? ` · +${duration}` : ''}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {complaint.category && (
            <p className="text-xs text-secondary">Category: <span className="font-semibold text-primary">{CATEGORY_LABEL[complaint.category] || complaint.category}</span></p>
          )}
          {complaint.assignedTo && (
            <p className="text-xs text-secondary">Assigned to: <span className="font-semibold text-primary">{complaint.assignedTo}</span></p>
          )}
          {complaint.resolutionPhotoUrl && (
            <div>
              <p className="text-xs font-semibold text-secondary mb-1.5">Resolution photo</p>
              <img src={complaint.resolutionPhotoUrl} alt="Resolution proof" className="rounded-xl border border-divider w-full max-h-64 object-cover" />
            </div>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}

          {/* Stage-appropriate action */}
          {complaint.status === 'open' && (
            <div className="space-y-3 pt-2 border-t border-divider">
              <label className="block text-sm font-bold text-primary flex items-center gap-1.5"><ClipboardList className="w-4 h-4" /> Categorize</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-base w-full">
                <option value="" disabled>Select a category…</option>
                {COMPLAINT_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <button onClick={handleAcknowledge} disabled={busy} className="btn-base btn-primary btn-primary-lg w-full">
                {busy ? 'Saving…' : 'Acknowledge & Categorize'}
              </button>
            </div>
          )}

          {complaint.status === 'acknowledged' && (
            <div className="space-y-3 pt-2 border-t border-divider">
              <label className="block text-sm font-bold text-primary flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Assign to</label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="e.g. Raju - Electrician, Security Desk…"
                className="input-base w-full"
              />
              <button onClick={handleAssign} disabled={busy} className="btn-base btn-primary btn-primary-lg w-full">
                {busy ? 'Saving…' : 'Assign'}
              </button>
            </div>
          )}

          {complaint.status === 'assigned' && (
            <div className="space-y-3 pt-2 border-t border-divider">
              <label className="block text-sm font-bold text-primary flex items-center gap-1.5"><Camera className="w-4 h-4" /> Mark Resolved</label>
              <p className="text-xs text-muted">Photo is optional, but helps confirm the fix.</p>
              {photoPreviewUrl && <img src={photoPreviewUrl} alt="Preview" className="rounded-xl border border-divider w-full max-h-48 object-cover" />}

              {/* Two explicit triggers instead of one `capture` input --
                  on most mobile browsers, `capture` on a single file input
                  jumps straight to the camera with no way to pick from the
                  gallery instead. Two separate hidden inputs (one with
                  `capture`, one without) give both options reliably. */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-divider bg-surface-secondary text-secondary text-sm font-semibold hover:bg-surface-hover transition"
                >
                  <Camera className="w-4 h-4" /> Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-divider bg-surface-secondary text-secondary text-sm font-semibold hover:bg-surface-hover transition"
                >
                  <ImageIcon className="w-4 h-4" /> Choose from Gallery
                </button>
              </div>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />

              <button onClick={handleResolve} disabled={busy} className="btn-base btn-primary btn-primary-lg w-full">
                {busy ? 'Saving…' : 'Mark Resolved'}
              </button>
            </div>
          )}

          {complaint.status === 'resolved' && (
            <div className="pt-2 border-t border-divider flex items-center gap-2 text-sm font-semibold" style={{ color: `rgb(var(--success))` }}>
              <CheckCircle2 className="w-4 h-4" /> Resolved
              {complaint.resolvedAt && ` in ${formatDuration(new Date(complaint.resolvedAt).getTime() - new Date(complaint.createdAt).getTime())}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
