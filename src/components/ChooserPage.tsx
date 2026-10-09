/**
 * @file src/components/ChooserPage.tsx
 * @description The new landing screen, routed at /root -- bare `/` redirects
 * here (see main.tsx), so this is the first thing anyone visiting the site
 * sees. Offers exactly two choices: Ask a Question (the existing audience
 * Q&A flow, at /ask) or Raise a Complaint (/complain). A direct link to a
 * specific event (/e/:joinCode) still bypasses this and goes straight to
 * that event's Q&A, unchanged.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare, MessageSquareWarning, Sun, Moon, ChevronRight } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';

export const ChooserPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  };

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
              {t('chooser.title')}
            </h1>
            <p className="mt-3 text-lg" style={{ color: `rgb(var(--hero-text-secondary))` }}>
              {t('chooser.subtitle')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => navigate('/ask')}
              className="card text-left p-6 sm:p-8 flex flex-col gap-3 hover:bg-surface-hover transition"
              style={{ backgroundColor: `rgb(var(--surface-elevated))` }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `rgb(var(--primary))` }}>
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold flex items-center gap-1.5" style={{ color: `rgb(var(--text-primary))` }}>
                  {t('chooser.askQuestion')} <ChevronRight className="w-5 h-5 opacity-50" />
                </p>
                <p className="text-sm mt-1" style={{ color: `rgb(var(--text-secondary))` }}>
                  {t('chooser.askQuestionDesc')}
                </p>
              </div>
            </button>

            <button
              onClick={() => navigate('/complain')}
              className="card text-left p-6 sm:p-8 flex flex-col gap-3 hover:bg-surface-hover transition"
              style={{ backgroundColor: `rgb(var(--surface-elevated))` }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `rgb(var(--accent))` }}>
                <MessageSquareWarning className="w-6 h-6" style={{ color: `rgb(var(--accent-text))` }} />
              </div>
              <div>
                <p className="text-xl font-bold flex items-center gap-1.5" style={{ color: `rgb(var(--text-primary))` }}>
                  {t('chooser.raiseComplaint')} <ChevronRight className="w-5 h-5 opacity-50" />
                </p>
                <p className="text-sm mt-1" style={{ color: `rgb(var(--text-secondary))` }}>
                  {t('chooser.raiseComplaintDesc')}
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
