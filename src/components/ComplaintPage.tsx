/**
 * @file src/components/ComplaintPage.tsx
 * @description A standalone, public complaint submission form routed at
 * /complain -- global (not tied to any event), no login required. Mirrors
 * LogsPage's self-contained-page pattern (its own minimal header, since it's
 * reachable directly by URL rather than through App.tsx's role router), but
 * stays on the audience-facing i18n/theme surface since real, very basic
 * users are the ones using it.
 *
 * Phase 1 of a two-phase feature: this is just the public submission form.
 * A separate management dashboard (its own login, viewing/assigning/noting/
 * resolving complaints) is a deferred follow-up, not built here -- the
 * `complaints` table already has the columns it will need (status,
 * assigned_to, internal_notes) so that phase won't require a schema change
 * to a table full of live data.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MessageSquareWarning, Send, Sun, Moon, Copy, Check, SearchCheck, ArrowLeft, BookOpen } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import type { ComplaintSubmissionResult, ComplaintLookupResult } from '../types';

export const ComplaintPage: React.FC = () => {
  const { t } = useTranslation();
  const [isDark, setIsDark] = useState(false);
  const [mode, setMode] = useState<'submit' | 'status'>('submit');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [complaintText, setComplaintText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<ComplaintSubmissionResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [lookupTicket, setLookupTicket] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResult, setLookupResult] = useState<ComplaintLookupResult | null>(null);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) return setErrorMsg(t('complaint.nameRequired'));
    if (!phone.trim()) return setErrorMsg(t('complaint.phoneRequired'));
    if (!complaintText.trim()) return setErrorMsg(t('complaint.complaintRequired'));

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), complaintText: complaintText.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('complaint.submitErrorFallback'));
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || t('complaint.submitErrorFallback'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setComplaintText('');
    setResult(null);
    setCopied(false);
  };

  const copyTicket = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.ticketNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (older mobile browsers, no HTTPS
      // in some dev setups) -- the ticket number is already shown on screen
      // as plain text, so this is a convenience, not the only way to get it.
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');
    if (!lookupTicket.trim() || !lookupPhone.trim()) return;

    setLookupBusy(true);
    setLookupResult(null);
    try {
      const params = new URLSearchParams({ ticket: lookupTicket.trim(), phone: lookupPhone.trim() });
      const res = await fetch(`/api/complaints/lookup?${params.toString()}`);
      if (!res.ok) throw new Error('not_found');
      setLookupResult(await res.json());
    } catch {
      setLookupError(t('complaint.lookupNotFound'));
    } finally {
      setLookupBusy(false);
    }
  };

  const resetLookup = () => {
    setLookupTicket('');
    setLookupPhone('');
    setLookupResult(null);
    setLookupError('');
  };

  const STATUS_KEY: Record<string, string> = {
    open: 'statusOpen',
    acknowledged: 'statusAcknowledged',
    assigned: 'statusAssigned',
    resolved: 'statusResolved'
  };

  const lookupTimeline = lookupResult ? [
    { key: 'open', at: lookupResult.createdAt },
    { key: 'acknowledged', at: lookupResult.acknowledgedAt },
    { key: 'assigned', at: lookupResult.assignedAt },
    { key: 'resolved', at: lookupResult.resolvedAt }
  ] : [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: `rgb(var(--background))` }}>
      {/* Minimal header -- just branding + language/theme controls, no nav
          tabs or login (this page carries no app session at all). */}
      <header className="sticky top-0 z-40 bg-surface border-b border-divider">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/root" className="p-2 -ml-2 rounded-lg hover:bg-surface-hover flex-shrink-0" style={{ color: `rgb(var(--text-secondary))` }} title="Back" aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div
              style={{ backgroundColor: `rgb(var(--primary))`, color: `rgb(var(--primary-text))` }}
              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm tracking-tighter shadow-md flex-shrink-0"
            >
              AQ
            </div>
            <span className="font-bold text-sm truncate" style={{ color: `rgb(var(--text-primary))` }}>
              {t('complaint.pageTitle')}
            </span>
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
            <Link
              to="/guide"
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-hover transition"
              style={{ color: `rgb(var(--text-secondary))` }}
              aria-label="Guide"
              title="Guide"
            >
              <BookOpen className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10 sm:px-6 sm:py-14">
        {/* Tab switcher: Submit a Complaint / Check Status */}
        <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ backgroundColor: `rgb(var(--surface-secondary))` }}>
          <button
            onClick={() => setMode('submit')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${mode === 'submit' ? 'btn-primary' : ''}`}
            style={mode !== 'submit' ? { color: `rgb(var(--text-secondary))` } : undefined}
          >
            {t('complaint.tabSubmit')}
          </button>
          <button
            onClick={() => setMode('status')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${mode === 'status' ? 'btn-primary' : ''}`}
            style={mode !== 'status' ? { color: `rgb(var(--text-secondary))` } : undefined}
          >
            {t('complaint.tabCheckStatus')}
          </button>
        </div>

        <div className="card overflow-hidden">
          {/* Card Header */}
          <div className="px-6 sm:px-8 py-8" style={{ backgroundColor: `rgb(var(--primary))` }}>
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: `rgba(255, 255, 255, 0.2)` }}>
                {mode === 'submit' ? <MessageSquareWarning className="w-6 h-6 text-white" /> : <SearchCheck className="w-6 h-6 text-white" />}
              </div>
              <div className="text-left">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  {mode === 'submit' ? t('complaint.pageTitle') : t('complaint.tabCheckStatus')}
                </h1>
                <p className="text-white/80 text-sm mt-1">{t('complaint.pageSubtitle')}</p>
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div className="px-6 sm:px-8 py-8 space-y-6" style={{ backgroundColor: `rgb(var(--surface-elevated))` }}>
            {mode === 'status' ? (
              lookupResult ? (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="font-mono text-lg font-bold tracking-wider" style={{ color: `rgb(var(--primary))` }}>
                      {lookupResult.ticketNumber}
                    </span>
                  </div>

                  {/* Timeline */}
                  <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: `rgb(var(--border-strong))`, backgroundColor: `rgb(var(--surface-secondary))` }}>
                    {lookupTimeline.map((step, i) => {
                      const done = i === 0 || !!step.at;
                      return (
                        <div key={step.key} className="flex items-start gap-3">
                          <div
                            className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                            style={{ backgroundColor: done ? `rgb(var(--primary))` : `rgb(var(--text-disabled))`, opacity: done ? 1 : 0.4 }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold" style={{ color: done ? `rgb(var(--text-primary))` : `rgb(var(--text-muted))` }}>
                              {t(`complaint.${STATUS_KEY[step.key]}`)}
                            </p>
                            {done && step.at && (
                              <p className="text-xs" style={{ color: `rgb(var(--text-muted))` }}>
                                {new Date(step.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {lookupResult.category && (
                    <p className="text-sm" style={{ color: `rgb(var(--text-secondary))` }}>
                      {t('complaint.lookupCategory')}: <span className="font-semibold" style={{ color: `rgb(var(--text-primary))` }}>{t(`complaint.categories.${lookupResult.category}`)}</span>
                    </p>
                  )}
                  {lookupResult.assignedTo && (
                    <p className="text-sm" style={{ color: `rgb(var(--text-secondary))` }}>
                      {t('complaint.lookupAssignedTo')}: <span className="font-semibold" style={{ color: `rgb(var(--text-primary))` }}>{lookupResult.assignedTo}</span>
                    </p>
                  )}
                  {lookupResult.resolutionPhotoUrl && (
                    <div>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: `rgb(var(--text-secondary))` }}>{t('complaint.lookupResolutionPhoto')}</p>
                      <img src={lookupResult.resolutionPhotoUrl} alt="" className="rounded-xl border w-full max-h-64 object-cover" style={{ borderColor: `rgb(var(--border-strong))` }} />
                    </div>
                  )}

                  <button onClick={resetLookup} className="btn-base btn-primary btn-primary-lg w-full">
                    {t('complaint.lookupCheckAnother')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLookup} className="space-y-6">
                  {lookupError && (
                    <div className="p-4 rounded-xl flex items-center space-x-3 border-l-4" style={{
                      backgroundColor: `rgb(var(--danger-light))`,
                      borderLeftColor: `rgb(var(--danger))`
                    }}>
                      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `rgb(var(--danger))` }}>
                        <span className="text-white text-sm font-bold">!</span>
                      </div>
                      <span className="font-medium" style={{ color: `rgb(var(--danger))` }}>{lookupError}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="block text-sm font-bold" style={{ color: `rgb(var(--text-primary))` }}>
                      {t('complaint.lookupTicketLabel')}
                    </label>
                    <input
                      type="text"
                      value={lookupTicket}
                      onChange={(e) => setLookupTicket(e.target.value)}
                      placeholder={t('complaint.lookupTicketPlaceholder')}
                      className="input-base w-full font-mono"
                      autoCapitalize="characters"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold" style={{ color: `rgb(var(--text-primary))` }}>
                      {t('complaint.phoneLabel')}
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={lookupPhone}
                      onChange={(e) => setLookupPhone(e.target.value)}
                      placeholder={t('complaint.phonePlaceholder')}
                      className="input-base w-full"
                      autoComplete="tel"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={lookupBusy || !lookupTicket.trim() || !lookupPhone.trim()}
                    className="btn-base btn-primary btn-primary-lg w-full mt-2"
                  >
                    <SearchCheck className="w-5 h-5" />
                    <span>{lookupBusy ? t('complaint.lookupChecking') : t('complaint.lookupButton')}</span>
                  </button>
                </form>
              )
            ) : result ? (
              <div className="text-center py-4 space-y-5">
                <div
                  className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `rgb(var(--success))` }}
                >
                  <Check className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="font-bold text-lg" style={{ color: `rgb(var(--text-primary))` }}>
                    {t('complaint.successTitle')}
                  </p>
                  <p className="text-sm mt-1" style={{ color: `rgb(var(--text-secondary))` }}>
                    {t('complaint.successSubtext')}
                  </p>
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: `rgb(var(--border-strong))`, backgroundColor: `rgb(var(--surface-secondary))` }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--text-muted))` }}>
                    {t('complaint.ticketLabel')}
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <span className="font-mono text-xl font-bold tracking-wider" style={{ color: `rgb(var(--primary))` }}>
                      {result.ticketNumber}
                    </span>
                    <button
                      onClick={copyTicket}
                      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-hover transition"
                      style={{ color: `rgb(var(--text-secondary))` }}
                      aria-label="Copy"
                    >
                      {copied ? <Check className="w-4 h-4" style={{ color: `rgb(var(--success))` }} /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs mt-2" style={{ color: `rgb(var(--text-muted))` }}>
                    {t('complaint.ticketNote')}
                  </p>
                </div>
                <button onClick={resetForm} className="btn-base btn-primary btn-primary-lg w-full">
                  {t('complaint.submitAnother')}
                </button>
              </div>
            ) : (
              <>
                {errorMsg && (
                  <div className="p-4 rounded-xl flex items-center space-x-3 border-l-4" style={{
                    backgroundColor: `rgb(var(--danger-light))`,
                    borderLeftColor: `rgb(var(--danger))`
                  }}>
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `rgb(var(--danger))` }}>
                      <span className="text-white text-sm font-bold">!</span>
                    </div>
                    <span className="font-medium" style={{ color: `rgb(var(--danger))` }}>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold" style={{ color: `rgb(var(--text-primary))` }}>
                      {t('complaint.nameLabel')}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('complaint.namePlaceholder')}
                      maxLength={200}
                      className="input-base w-full"
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold" style={{ color: `rgb(var(--text-primary))` }}>
                      {t('complaint.phoneLabel')}
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={t('complaint.phonePlaceholder')}
                      maxLength={20}
                      className="input-base w-full"
                      autoComplete="tel"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold" style={{ color: `rgb(var(--text-primary))` }}>
                      {t('complaint.complaintLabel')}
                    </label>
                    <textarea
                      value={complaintText}
                      onChange={(e) => setComplaintText(e.target.value)}
                      placeholder={t('complaint.complaintPlaceholder')}
                      maxLength={2000}
                      className="input-base w-full h-36 resize-none"
                    />
                    <p className="text-xs font-medium" style={{ color: `rgb(var(--text-muted))` }}>
                      {t('complaint.characterCount', { count: complaintText.length })}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !name.trim() || !phone.trim() || !complaintText.trim()}
                    className="btn-base btn-primary btn-primary-lg w-full mt-2"
                  >
                    <Send className="w-5 h-5" />
                    <span>{isSubmitting ? t('complaint.submitting') : t('complaint.submitButton')}</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
