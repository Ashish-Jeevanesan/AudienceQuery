/**
 * @file src/components/VotingManagerDrawer.tsx
 * @description Module 1 of the voting feature: create and manage voting
 * questions + their options. Embedded as an admin-only drawer in the
 * Moderator screen (ModeratorView), same shape as Manage Events/Users/
 * Rules, but self-contained (its own Supabase-session fetch) rather than
 * threaded through the shared useRealTimeQnA hook, since voting data is
 * independent of the Q&A state that hook otherwise manages.
 */

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Voting } from '../types';
import {
  Plus, X, Trash2, Edit3, AlertCircle, Languages, Loader2,
  PlayCircle, PauseCircle, Lock, ImagePlus
} from 'lucide-react';

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', open: 'Open', closed: 'Closed' };
const STATUS_BADGE: Record<string, string> = { draft: 'cat-badge-amber', open: 'cat-badge-emerald', closed: 'cat-badge-rose' };

export function VotingManagerDrawer() {
  const [votings, setVotings] = useState<Voting[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // --- Create form ---
  const [newQuestion, setNewQuestion] = useState('');
  const [newQuestionHi, setNewQuestionHi] = useState('');
  const [newQuestionOr, setNewQuestionOr] = useState('');
  const [newOptions, setNewOptions] = useState<string[]>(['', '']);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState('');

  // --- Per-voting editing ---
  const [editingVotingId, setEditingVotingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ question: '', questionHi: '', questionOr: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null);
  const [newOptionDraft, setNewOptionDraft] = useState<Record<string, string>>({});
  const [addingOptionTo, setAddingOptionTo] = useState<string | null>(null);
  const [optionError, setOptionError] = useState<{ votingId: string; message: string } | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [optionLabelDraft, setOptionLabelDraft] = useState('');
  const [uploadingOptionId, setUploadingOptionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const authFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sign-in is required');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${session.access_token}`);
    return fetch(input, { ...init, headers });
  };

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

  useEffect(() => { fetchVotings(); }, []);

  const handleTranslate = async () => {
    if (!newQuestion.trim()) return;
    setTranslating(true);
    setTranslateError('');
    try {
      const res = await authFetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newQuestion.trim(), targets: ['hi', 'or'] })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to translate');
      const result = await res.json();
      if (result.hi) setNewQuestionHi(result.hi);
      if (result.or) setNewQuestionOr(result.or);
      if (!result.hi && !result.or) setTranslateError('No translation returned. Please type it manually.');
    } catch (err: any) {
      setTranslateError(err.message || 'Translation failed. Please type it manually.');
    } finally {
      setTranslating(false);
    }
  };

  const updateNewOption = (i: number, value: string) => {
    setNewOptions(opts => opts.map((o, idx) => (idx === i ? value : o)));
  };
  const addOptionField = () => setNewOptions(opts => [...opts, '']);
  const removeOptionField = (i: number) => setNewOptions(opts => opts.filter((_, idx) => idx !== i));

  const resetCreateForm = () => {
    setNewQuestion('');
    setNewQuestionHi('');
    setNewQuestionOr('');
    setNewOptions(['', '']);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    const cleanOptions = newOptions.map(o => o.trim()).filter(Boolean);
    if (!newQuestion.trim()) return setCreateError('Question is required');
    if (cleanOptions.length < 2) return setCreateError('Add at least 2 options');

    setCreating(true);
    try {
      const res = await authFetch('/api/votings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: newQuestion.trim(),
          questionHi: newQuestionHi.trim() || undefined,
          questionOr: newQuestionOr.trim() || undefined,
          options: cleanOptions.map(label => ({ label }))
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to create voting');
      resetCreateForm();
      await fetchVotings();
    } catch (err: any) {
      setCreateError(err.message || 'Unable to create voting');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (v: Voting) => {
    setEditingVotingId(v.id);
    setEditDraft({ question: v.question, questionHi: v.questionHi || '', questionOr: v.questionOr || '' });
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editingVotingId) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const res = await authFetch(`/api/votings/${editingVotingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: editDraft.question, questionHi: editDraft.questionHi, questionOr: editDraft.questionOr })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to save');
      setEditingVotingId(null);
      await fetchVotings();
    } catch (err: any) {
      setEditError(err.message || 'Unable to save');
    } finally {
      setSavingEdit(false);
    }
  };

  const changeStatus = async (votingId: string, status: 'draft' | 'open' | 'closed') => {
    setStatusChangingId(votingId);
    setLoadError('');
    try {
      const res = await authFetch(`/api/votings/${votingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to update status');
      await fetchVotings();
    } catch (err: any) {
      setLoadError(err.message || 'Unable to update status');
    } finally {
      setStatusChangingId(null);
    }
  };

  const deleteVoting = async (votingId: string, question: string) => {
    if (!window.confirm(`Delete "${question}"? This cannot be undone -- the voting and all its votes will be permanently removed from view.`)) return;
    try {
      const res = await authFetch(`/api/votings/${votingId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to delete');
      await fetchVotings();
    } catch (err: any) {
      setLoadError(err.message || 'Unable to delete voting');
    }
  };

  const submitNewOption = async (votingId: string) => {
    const label = (newOptionDraft[votingId] || '').trim();
    if (!label) return;
    setAddingOptionTo(votingId);
    setOptionError(null);
    try {
      const res = await authFetch(`/api/votings/${votingId}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to add option');
      setNewOptionDraft(d => ({ ...d, [votingId]: '' }));
      await fetchVotings();
    } catch (err: any) {
      setOptionError({ votingId, message: err.message || 'Unable to add option' });
    } finally {
      setAddingOptionTo(null);
    }
  };

  const saveOptionLabel = async (optionId: string) => {
    try {
      const res = await authFetch(`/api/voting-options/${optionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: optionLabelDraft })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to save');
      setEditingOptionId(null);
      await fetchVotings();
    } catch (err: any) {
      window.alert(err.message || 'Unable to save option');
    }
  };

  const deleteOption = async (optionId: string, label: string) => {
    if (!window.confirm(`Remove option "${label}"?`)) return;
    try {
      const res = await authFetch(`/api/voting-options/${optionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to remove option');
      await fetchVotings();
    } catch (err: any) {
      window.alert(err.message || 'Unable to remove option');
    }
  };

  const triggerPhotoUpload = (optionId: string) => {
    uploadTargetRef.current = optionId;
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const optionId = uploadTargetRef.current;
    e.target.value = '';
    if (!file || !optionId) return;

    setUploadingOptionId(optionId);
    try {
      const signedRes = await authFetch(`/api/voting-options/${optionId}/photo/signed-upload`, { method: 'POST' });
      if (!signedRes.ok) throw new Error((await signedRes.json()).error || 'Unable to start upload');
      const { path, token } = await signedRes.json();

      const { error: uploadError } = await supabase.storage.from('voting-media').uploadToSignedUrl(path, token, file, { contentType: file.type || 'image/jpeg' });
      if (uploadError) throw uploadError;

      const confirmRes = await authFetch(`/api/voting-options/${optionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoPath: path })
      });
      if (!confirmRes.ok) throw new Error((await confirmRes.json()).error || 'Unable to save photo');
      await fetchVotings();
    } catch (err: any) {
      window.alert(err.message || 'Photo upload failed');
    } finally {
      setUploadingOptionId(null);
    }
  };

  return (
    <div className="space-y-5">
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoSelected} />

      {/* Create New Voting */}
      <form onSubmit={submitCreate} className="space-y-3 pb-4 border-b border-divider">
        <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Create New Voting</h4>
        <textarea
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="e.g. Which theme song should we use?"
          className="w-full px-3 py-2 rounded-xl border border-divider text-sm text-primary bg-transparent outline-none focus:border-indigo-500 resize-none"
          rows={2}
        />
        <div className="flex flex-col sm:flex-row gap-2 items-start">
          <input type="text" placeholder="Question (Hindi, optional)" value={newQuestionHi} onChange={(e) => setNewQuestionHi(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500" />
          <input type="text" placeholder="Question (Odia, optional)" value={newQuestionOr} onChange={(e) => setNewQuestionOr(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500" />
          <button type="button" onClick={handleTranslate} disabled={!newQuestion.trim() || translating} title="Translate into Hindi & Odia" className="p-2 rounded-xl bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider transition disabled:opacity-50 shrink-0">
            {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
          </button>
        </div>
        {translateError && <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600"><AlertCircle className="w-3.5 h-3.5" /> {translateError}</p>}

        <div className="space-y-2">
          <p className="text-xs font-bold text-muted uppercase tracking-wider">Options</p>
          {newOptions.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => updateNewOption(i, e.target.value)}
                placeholder={`Option ${i + 1} label`}
                className="flex-1 px-3 py-2 rounded-xl border border-divider text-sm text-primary bg-transparent outline-none focus:border-indigo-500"
              />
              {newOptions.length > 2 && (
                <button type="button" onClick={() => removeOptionField(i)} className="p-2 rounded-lg bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider"><X className="w-3.5 h-3.5" /></button>
              )}
            </div>
          ))}
          <button type="button" onClick={addOptionField} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            <Plus className="w-3.5 h-3.5" /> Add another option
          </button>
        </div>

        {createError && <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600"><AlertCircle className="w-3.5 h-3.5" /> {createError}</p>}
        <button type="submit" disabled={creating} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
          {creating ? 'Creating…' : 'Create Voting'}
        </button>
      </form>

      {/* All Votings */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-muted uppercase tracking-wider">All Votings</h4>
        {loadError && <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600"><AlertCircle className="w-3.5 h-3.5" /> {loadError}</p>}
        {loading ? (
          <p className="text-xs text-muted italic">Loading…</p>
        ) : votings.length === 0 ? (
          <p className="text-xs text-muted italic">No votings yet. Create one above.</p>
        ) : (
          votings.map(v => (
            <div key={v.id} className="rounded-xl border border-divider p-3 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_BADGE[v.status]}`}>{STATUS_LABEL[v.status]}</span>
                    <span className="text-xs text-muted">{v.totalVotes} vote{v.totalVotes === 1 ? '' : 's'}</span>
                  </div>
                  {editingVotingId === v.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea value={editDraft.question} onChange={(e) => setEditDraft(d => ({ ...d, question: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-divider text-sm text-primary bg-transparent outline-none focus:border-indigo-500 resize-none" rows={2} />
                      <input type="text" placeholder="Hindi" value={editDraft.questionHi} onChange={(e) => setEditDraft(d => ({ ...d, questionHi: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500" />
                      <input type="text" placeholder="Odia" value={editDraft.questionOr} onChange={(e) => setEditDraft(d => ({ ...d, questionOr: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500" />
                      {editError && <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600"><AlertCircle className="w-3.5 h-3.5" /> {editError}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => setEditingVotingId(null)} className="px-3 py-1.5 rounded-lg bg-surface-secondary text-secondary text-xs font-semibold hover:bg-surface-hover">Cancel</button>
                        <button onClick={saveEdit} disabled={savingEdit} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-60">{savingEdit ? 'Saving…' : 'Save'}</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-primary mt-1">{v.question}</p>
                  )}
                </div>
                {editingVotingId !== v.id && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => openEdit(v)} className="p-2 rounded-lg bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteVoting(v.id, v.question)} className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>

              {/* Status controls */}
              <div className="flex flex-wrap gap-1.5">
                {v.status === 'draft' && (
                  <button onClick={() => changeStatus(v.id, 'open')} disabled={statusChangingId === v.id || v.options.length < 2} title={v.options.length < 2 ? 'Add at least 2 options first' : undefined} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    <PlayCircle className="w-3.5 h-3.5" /> Open to the public
                  </button>
                )}
                {v.status === 'open' && (
                  <>
                    <button onClick={() => changeStatus(v.id, 'draft')} disabled={statusChangingId === v.id} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider disabled:opacity-60">
                      <PauseCircle className="w-3.5 h-3.5" /> Back to draft
                    </button>
                    <button onClick={() => changeStatus(v.id, 'closed')} disabled={statusChangingId === v.id} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 disabled:opacity-60">
                      <Lock className="w-3.5 h-3.5" /> Close voting
                    </button>
                  </>
                )}
                {v.status === 'closed' && (
                  <span className="text-[11px] text-muted italic">Closed -- final result stays visible on the Stage screen.</span>
                )}
              </div>

              {/* Options */}
              <div className="space-y-1.5 pt-2 border-t border-divider">
                {v.options.map(o => (
                  <div key={o.id} className="flex items-center gap-2 text-xs">
                    {o.photoUrl ? (
                      <img src={o.photoUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-divider shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-surface-secondary border border-divider shrink-0" />
                    )}
                    {editingOptionId === o.id ? (
                      <>
                        <input value={optionLabelDraft} onChange={(e) => setOptionLabelDraft(e.target.value)} className="flex-1 px-2 py-1 rounded-lg border border-divider bg-transparent outline-none focus:border-indigo-500" />
                        <button onClick={() => saveOptionLabel(o.id)} className="px-2 py-1 rounded-lg bg-indigo-600 text-white font-bold">Save</button>
                        <button onClick={() => setEditingOptionId(null)} className="px-2 py-1 rounded-lg bg-surface-secondary text-secondary">Cancel</button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 font-medium text-primary truncate">{o.label}</span>
                        <span className="text-muted">{o.voteCount || 0}</span>
                        <button onClick={() => triggerPhotoUpload(o.id)} disabled={uploadingOptionId === o.id} title="Upload photo" className="p-1.5 rounded-lg bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider disabled:opacity-50">
                          {uploadingOptionId === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
                        </button>
                        <button onClick={() => { setEditingOptionId(o.id); setOptionLabelDraft(o.label); }} className="p-1.5 rounded-lg bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider"><Edit3 className="w-3 h-3" /></button>
                        <button onClick={() => deleteOption(o.id, o.label)} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"><Trash2 className="w-3 h-3" /></button>
                      </>
                    )}
                  </div>
                ))}
                {v.status !== 'closed' && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newOptionDraft[v.id] || ''}
                      onChange={(e) => setNewOptionDraft(d => ({ ...d, [v.id]: e.target.value }))}
                      placeholder="Add another option…"
                      className="flex-1 px-2 py-1.5 rounded-lg border border-divider text-xs bg-transparent outline-none focus:border-indigo-500"
                    />
                    <button onClick={() => submitNewOption(v.id)} disabled={addingOptionTo === v.id || !(newOptionDraft[v.id] || '').trim()} className="p-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-50"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                )}
                {optionError?.votingId === v.id && <p className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600"><AlertCircle className="w-3 h-3" /> {optionError.message}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
