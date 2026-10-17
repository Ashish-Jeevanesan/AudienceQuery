/**
 * @file src/components/VoteMonitorDrawer.tsx
 * @description Module 3 of the voting feature: review every vote cast for a
 * voting and flag fakes. Embedded in the Moderator screen, open to admin OR
 * moderator (unlike Module 1's admin-only Manage Votings) -- see the
 * approved design's Open Question 1. Self-contained, same reasoning as
 * VotingManagerDrawer.
 *
 * `suspicion_flags` are auto-computed by the server (shared device, IP
 * burst, implausible DOB) and shown here as badges -- informational only,
 * never a block. `isInvalidated` is the one thing that actually removes a
 * vote from every tally, and only a human sets it, from the button here.
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Voting, VoteRecord } from '../types';
import { AlertCircle, Ban, Undo2, ShieldAlert, RefreshCw } from 'lucide-react';

const FLAG_LABEL: Record<string, string> = {
  implausible_dob: 'Implausible age',
  shared_device: 'Shared device',
  ip_burst: 'IP burst'
};

export function VoteMonitorDrawer() {
  const [votings, setVotings] = useState<Voting[]>([]);
  const [selectedVotingId, setSelectedVotingId] = useState<string>('');
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<'all' | 'flagged' | 'invalidated'>('all');
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  const authFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sign-in is required');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${session.access_token}`);
    return fetch(input, { ...init, headers });
  };

  const fetchVotings = async () => {
    try {
      const res = await authFetch('/api/votings');
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to load votings');
      const data: Voting[] = await res.json();
      setVotings(data);
      if (!selectedVotingId && data.length > 0) setSelectedVotingId(data[0].id);
    } catch (err: any) {
      setLoadError(err.message || 'Unable to load votings');
    }
  };

  useEffect(() => { fetchVotings(); }, []);

  const fetchVotes = async () => {
    if (!selectedVotingId) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await authFetch(`/api/votings/${selectedVotingId}/votes`);
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to load votes');
      setVotes(await res.json());
    } catch (err: any) {
      setLoadError(err.message || 'Unable to load votes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVotes(); }, [selectedVotingId]);

  const toggleInvalidate = async (vote: VoteRecord) => {
    setActingOnId(vote.id);
    try {
      const invalidated = !vote.isInvalidated;
      const reason = invalidated ? (window.prompt('Reason (optional):') || undefined) : undefined;
      const res = await authFetch(`/api/votes/${vote.id}/flag`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalidated, reason })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to update');
      await fetchVotes();
    } catch (err: any) {
      window.alert(err.message || 'Unable to update vote');
    } finally {
      setActingOnId(null);
    }
  };

  const filtered = votes.filter(v => {
    if (filter === 'flagged') return v.suspicionFlags.length > 0;
    if (filter === 'invalidated') return v.isInvalidated;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={selectedVotingId} onChange={(e) => setSelectedVotingId(e.target.value)} className="input-base flex-1 min-w-[200px]">
          {votings.length === 0 && <option value="">No votings yet</option>}
          {votings.map(v => <option key={v.id} value={v.id}>{v.question} ({v.status})</option>)}
        </select>
        <button onClick={fetchVotes} disabled={loading} title="Refresh" className="p-2.5 rounded-lg bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-1.5">
        {(['all', 'flagged', 'invalidated'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition ${filter === f ? 'bg-indigo-600 text-white' : 'bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider'}`}
          >
            {f} {f === 'flagged' && `(${votes.filter(v => v.suspicionFlags.length > 0).length})`}
            {f === 'invalidated' && `(${votes.filter(v => v.isInvalidated).length})`}
          </button>
        ))}
      </div>

      {loadError && <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600"><AlertCircle className="w-3.5 h-3.5" /> {loadError}</p>}

      {!selectedVotingId ? (
        <p className="text-xs text-muted italic">Create a voting in Manage Votings first.</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted italic text-center py-8">{votes.length === 0 ? 'No votes yet.' : 'Nothing matches this filter.'}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(v => (
            <div key={v.id} className={`rounded-xl border p-3 space-y-1.5 ${v.isInvalidated ? 'border-rose-200 bg-rose-50/50' : 'border-divider'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary truncate">{v.voterName} &middot; {v.voterPhone}</p>
                  <p className="text-xs text-muted">Voted: <span className="font-semibold text-secondary">{v.optionLabel}</span> &middot; DOB {v.voterDob} &middot; {new Date(v.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <button
                  onClick={() => toggleInvalidate(v)}
                  disabled={actingOnId === v.id}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 disabled:opacity-60 ${
                    v.isInvalidated ? 'bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider' : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  {v.isInvalidated ? <><Undo2 className="w-3.5 h-3.5" /> Reinstate</> : <><Ban className="w-3.5 h-3.5" /> Invalidate</>}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                <span>IP: {v.ipAddress || 'unknown'}</span>
                <span>&middot; Device: {v.deviceFingerprint.slice(0, 10)}…</span>
              </div>
              {(v.suspicionFlags.length > 0 || v.isInvalidated) && (
                <div className="flex flex-wrap gap-1.5">
                  {v.suspicionFlags.map(f => (
                    <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold cat-badge-amber">
                      <ShieldAlert className="w-3 h-3" /> {FLAG_LABEL[f] || f}
                    </span>
                  ))}
                  {v.isInvalidated && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold cat-badge-rose">
                      Invalidated{v.invalidatedReason ? `: ${v.invalidatedReason}` : ''}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
