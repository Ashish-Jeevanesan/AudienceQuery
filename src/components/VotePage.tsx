/**
 * @file src/components/VotePage.tsx
 * @description Module 2 of the voting feature: a standalone, public, no-login
 * page routed at /vote -- mirrors ComplaintPage's standalone-page pattern
 * (its own minimal header, full EN/HI/OR support, light/dark theming).
 * More than one voting can be open at once (an explicit design decision --
 * see the approved design artifact), so this always fetches an array and
 * shows a short picker when there's more than one, auto-selecting straight
 * through when there's exactly one.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Vote as VoteIcon, Sun, Moon, Check, ArrowLeft, BookOpen, ChevronRight } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { getLocalizedText } from '../i18n/localizedContent';
import { computeDeviceFingerprint } from '../deviceFingerprint';
import type { PublicVoting } from '../types';

export const VotePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || 'en';
  const [isDark, setIsDark] = useState(false);

  const [loading, setLoading] = useState(true);
  const [votings, setVotings] = useState<PublicVoting[]>([]);
  const [selectedVotingId, setSelectedVotingId] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch('/api/votings/open')
      .then(res => res.json())
      .then((data: PublicVoting[]) => {
        setVotings(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length === 1) setSelectedVotingId(data[0].id);
      })
      .catch(() => setVotings([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  };

  const selectedVoting = votings.find(v => v.id === selectedVotingId) || null;
  const selectedOption = selectedVoting?.options.find(o => o.id === selectedOptionId) || null;

  const resetSelection = () => {
    setSelectedOptionId(null);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!selectedVoting || !selectedOption) return;
    if (!name.trim()) return setErrorMsg(t('vote.nameRequired'));
    if (!phone.trim()) return setErrorMsg(t('vote.phoneRequired'));
    if (phone.length !== 10) return setErrorMsg(t('vote.phoneInvalid'));
    if (!dob) return setErrorMsg(t('vote.dobRequired'));

    setIsSubmitting(true);
    try {
      const deviceFingerprint = await computeDeviceFingerprint();
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          votingId: selectedVoting.id,
          optionId: selectedOption.id,
          voterName: name.trim(),
          voterPhone: phone.trim(),
          voterDob: dob,
          deviceFingerprint
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('vote.submitErrorFallback'));
      setSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.message || t('vote.submitErrorFallback'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: `rgb(var(--background))` }}>
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
              {t('vote.pageTitle')}
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
        <div className="card overflow-hidden">
          <div className="px-6 sm:px-8 py-8" style={{ backgroundColor: `rgb(var(--primary))` }}>
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: `rgba(255, 255, 255, 0.2)` }}>
                <VoteIcon className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{t('vote.pageTitle')}</h1>
                <p className="text-white/80 text-sm mt-1">{t('vote.pageSubtitle')}</p>
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-8 py-8 space-y-6" style={{ backgroundColor: `rgb(var(--surface-elevated))` }}>
            {loading ? (
              <p className="text-sm text-center py-6" style={{ color: `rgb(var(--text-secondary))` }}>{t('vote.loading')}</p>
            ) : submitted ? (
              <div className="text-center py-4 space-y-5">
                <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: `rgb(var(--success))` }}>
                  <Check className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="font-bold text-lg" style={{ color: `rgb(var(--text-primary))` }}>{t('vote.successTitle')}</p>
                  <p className="text-sm mt-1" style={{ color: `rgb(var(--text-secondary))` }}>{t('vote.successSubtext')}</p>
                </div>
              </div>
            ) : votings.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="font-bold" style={{ color: `rgb(var(--text-primary))` }}>{t('vote.noneOpenTitle')}</p>
                <p className="text-sm" style={{ color: `rgb(var(--text-secondary))` }}>{t('vote.noneOpenSubtext')}</p>
              </div>
            ) : !selectedVoting ? (
              <div className="space-y-3">
                <p className="text-sm font-bold" style={{ color: `rgb(var(--text-primary))` }}>{t('vote.choosePoll')}</p>
                {votings.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVotingId(v.id)}
                    className="card w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-surface-hover transition"
                    style={{ backgroundColor: `rgb(var(--surface-secondary))` }}
                  >
                    <span className="font-semibold text-sm" style={{ color: `rgb(var(--text-primary))` }}>
                      {getLocalizedText(v.question, v.questionHi, v.questionOr, language)}
                    </span>
                    <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
                  </button>
                ))}
              </div>
            ) : !selectedOption ? (
              <div className="space-y-4">
                {votings.length > 1 && (
                  <button onClick={() => setSelectedVotingId(null)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: `rgb(var(--text-secondary))` }}>
                    <ArrowLeft className="w-3.5 h-3.5" /> {t('vote.backToPolls')}
                  </button>
                )}
                <p className="text-lg font-bold" style={{ color: `rgb(var(--text-primary))` }}>
                  {getLocalizedText(selectedVoting.question, selectedVoting.questionHi, selectedVoting.questionOr, language)}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedVoting.options.map(o => (
                    <button
                      key={o.id}
                      onClick={() => setSelectedOptionId(o.id)}
                      className="card text-left p-4 flex flex-col gap-2 hover:bg-surface-hover transition"
                      style={{ backgroundColor: `rgb(var(--surface-secondary))` }}
                    >
                      {o.photoUrl && (
                        <img src={o.photoUrl} alt="" className="w-full h-32 object-cover rounded-lg" />
                      )}
                      <span className="font-semibold text-sm" style={{ color: `rgb(var(--text-primary))` }}>{o.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <button onClick={resetSelection} className="flex items-center gap-1 text-xs font-semibold" style={{ color: `rgb(var(--text-secondary))` }}>
                  <ArrowLeft className="w-3.5 h-3.5" /> {t('vote.changeOption')}
                </button>

                <div className="rounded-xl border p-4" style={{ borderColor: `rgb(var(--border-strong))`, backgroundColor: `rgb(var(--surface-secondary))` }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: `rgb(var(--text-muted))` }}>{t('vote.yourChoice')}</p>
                  <p className="font-bold mt-1" style={{ color: `rgb(var(--primary))` }}>{selectedOption.label}</p>
                </div>

                {errorMsg && (
                  <div className="p-4 rounded-xl flex items-center space-x-3 border-l-4" style={{ backgroundColor: `rgb(var(--danger-light))`, borderLeftColor: `rgb(var(--danger))` }}>
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `rgb(var(--danger))` }}>
                      <span className="text-white text-sm font-bold">!</span>
                    </div>
                    <span className="font-medium" style={{ color: `rgb(var(--danger))` }}>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold" style={{ color: `rgb(var(--text-primary))` }}>{t('vote.nameLabel')}</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('vote.namePlaceholder')} maxLength={200} className="input-base w-full" autoComplete="name" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold" style={{ color: `rgb(var(--text-primary))` }}>{t('vote.phoneLabel')}</label>
                    <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder={t('vote.phonePlaceholder')} maxLength={10} className="input-base w-full" autoComplete="tel" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold" style={{ color: `rgb(var(--text-primary))` }}>{t('vote.dobLabel')}</label>
                    <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="input-base w-full" autoComplete="bday" />
                  </div>
                  <button type="submit" disabled={isSubmitting || !name.trim() || !phone.trim() || !dob} className="btn-base btn-primary btn-primary-lg w-full mt-2">
                    <VoteIcon className="w-5 h-5" />
                    <span>{isSubmitting ? t('vote.submitting') : t('vote.submitButton')}</span>
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
