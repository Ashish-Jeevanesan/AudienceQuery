import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send } from 'lucide-react';
import type { Category, ConferenceEvent } from '../types';
import { getLocalizedText } from '../i18n/localizedContent';

interface AudienceViewProps {
  categories: Category[];
  conferenceEvent: ConferenceEvent;
  onSubmit: (params: { text: string; authorName: string; isAnonymous: boolean; categoryId: string }) => Promise<any>;
  sessionId: string;
  mySubmittedIds: string[];
}

export const AudienceView: React.FC<AudienceViewProps> = ({
  categories,
  conferenceEvent,
  onSubmit
}) => {
  const { t, i18n } = useTranslation();
  const [questionText, setQuestionText] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || '');
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    setErrorMsg('');
    try {
      // The shared GlobalLoader (driven by useRealTimeQnA's isBusy) covers
      // the network wait here, so this view doesn't track its own pending
      // state.
      await onSubmit({
        text: questionText,
        authorName,
        isAnonymous,
        categoryId: selectedCategoryId || categories[0]?.id || ''
      });
      setQuestionText('');
      setAuthorName('');
      setSubmittedSuccess(true);
      setTimeout(() => setSubmittedSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || t('audience.submitErrorFallback'));
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: `rgb(var(--background))` }}>
      {/* HERO SECTION - REFINED PROPORTIONS */}
      <div className="relative overflow-hidden border-b border-divider" style={{ backgroundColor: `rgb(var(--hero-background))` }}>
        <div className="px-4 py-8 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 text-center">
            {/* Event Code Badge */}
            <div className="inline-flex items-center justify-center px-4 py-2.5 rounded-full border" style={{
              backgroundColor: `rgb(var(--surface))`,
              borderColor: `rgb(var(--border-strong))`
            }}>
              <span className="text-sm font-semibold" style={{ color: `rgb(var(--text-secondary))` }}>
                {t('audience.eventCode')} <span className="font-bold ml-2" style={{ color: `rgb(var(--accent))` }}>{conferenceEvent.joinCode}</span>
              </span>
            </div>

            {/* Main Title */}
            <h1 className="text-4xl sm:text-7xl lg:text-8xl font-bold leading-tight" style={{ color: `rgb(var(--hero-text-primary))` }}>
              {getLocalizedText(conferenceEvent.title, conferenceEvent.titleHi, conferenceEvent.titleOr, i18n.resolvedLanguage || 'en')}
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl" style={{ color: `rgb(var(--hero-text-secondary))` }}>
              {getLocalizedText(conferenceEvent.subtitle, conferenceEvent.subtitleHi, conferenceEvent.subtitleOr, i18n.resolvedLanguage || 'en')}
            </p>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="relative max-w-2xl mx-auto px-4 py-14 sm:px-6 lg:px-8">
        {/* FORM CARD */}
        <div className="card overflow-hidden">
          {/* Card Header */}
          <div className="px-6 sm:px-8 py-8" style={{ backgroundColor: `rgb(var(--primary))` }}>
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: `rgba(255, 255, 255, 0.2)` }}>
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <h2 className="text-3xl font-bold text-white">{t('audience.askQuestion')}</h2>
                <p className="text-white/80 text-sm mt-1">{t('audience.askQuestionSubtext')}</p>
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div className="px-6 sm:px-8 py-8 space-y-6" style={{ backgroundColor: `rgb(var(--surface-elevated))` }}>
            {!conferenceEvent.id ? (
              <div className="text-center py-6 space-y-2">
                <p className="font-bold" style={{ color: `rgb(var(--text-primary))` }}>{t('audience.noLiveEvent')}</p>
                <p className="text-sm" style={{ color: `rgb(var(--text-secondary))` }}>
                  {t('audience.noLiveEventSubtext')}
                </p>
              </div>
            ) : (
              <>
            {/* Success Message */}
            {submittedSuccess && (
              <div className="p-4 rounded-xl flex items-center space-x-3 border-l-4" style={{
                backgroundColor: `rgb(var(--success-light))`,
                borderLeftColor: `rgb(var(--success))`
              }}>
                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `rgb(var(--success))` }}>
                  <span className="text-white text-sm font-bold">✓</span>
                </div>
                <span className="font-medium" style={{ color: `rgb(var(--success))` }}>
                  {t('audience.submitSuccess')}
                </span>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-4 rounded-xl flex items-center space-x-3 border-l-4" style={{
                backgroundColor: `rgb(var(--danger-light))`,
                borderLeftColor: `rgb(var(--danger))`
              }}>
                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `rgb(var(--danger))` }}>
                  <span className="text-white text-sm font-bold">!</span>
                </div>
                <span className="font-medium" style={{ color: `rgb(var(--danger))` }}>
                  {errorMsg}
                </span>
              </div>
            )}

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Question Textarea */}
              <div className="space-y-2">
                <label className="block text-sm font-bold" style={{ color: `rgb(var(--text-primary))` }}>
                  {t('audience.yourQuestion')}
                </label>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder={t('audience.questionPlaceholder')}
                  className="input-base w-full h-32 resize-none"
                />
                <p className="text-xs font-medium" style={{ color: `rgb(var(--text-muted))` }}>
                  {t('audience.characterCount', { count: questionText.length })}
                </p>
              </div>

              {/* Anonymous Checkbox */}
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="w-6 h-6 opacity-0 absolute"
                    />
                    <div className="w-6 h-6 rounded border-2 flex items-center justify-center transition-all" style={{
                      borderColor: isAnonymous ? `rgb(var(--primary))` : `rgb(var(--input-border))`,
                      backgroundColor: isAnonymous ? `rgb(var(--primary))` : 'transparent'
                    }}>
                      {isAnonymous && <span className="text-white text-sm font-bold">✓</span>}
                    </div>
                  </div>
                  <span className="ml-3 font-semibold group-hover:opacity-80 transition" style={{ color: `rgb(var(--text-primary))` }}>
                    {t('audience.askAnonymously')}
                  </span>
                </label>
              </div>

              {/* Name Input */}
              {!isAnonymous && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold" style={{ color: `rgb(var(--text-primary))` }}>
                    {t('audience.yourName')}
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder={t('audience.namePlaceholder')}
                    className="input-base w-full"
                  />
                </div>
              )}

              {/* Topic Select */}
              {categories.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold" style={{ color: `rgb(var(--text-primary))` }}>
                    {t('audience.topicOptional')}
                  </label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="input-base w-full appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%234f46e5' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundPosition: 'right 1rem center',
                      backgroundRepeat: 'no-repeat',
                      paddingRight: '2.5rem'
                    }}
                  >
                    <option value="">{t('audience.selectTopic')}</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{getLocalizedText(cat.name, cat.nameHi, cat.nameOr, i18n.resolvedLanguage || 'en')}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!questionText.trim()}
                className="btn-base btn-primary btn-primary-lg w-full mt-8"
              >
                <Send className="w-5 h-5" />
                <span>{t('audience.submitQuestion')}</span>
              </button>
            </form>
              </>
            )}
          </div>
        </div>

        {/* INFO MESSAGE */}
        <div className="mt-10 text-center">
          <div className="inline-block px-6 py-4 rounded-xl border card" style={{
            backgroundColor: `rgb(var(--surface-secondary))`
          }}>
            <p className="text-sm" style={{ color: `rgb(var(--text-secondary))` }}>
              {t('audience.footerNote')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
