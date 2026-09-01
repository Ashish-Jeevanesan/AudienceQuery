import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Question, Category, ConferenceEvent } from '../types';
import { Sparkles, Monitor, Maximize2, Radio, Clock } from 'lucide-react';
import { getLocalizedText } from '../i18n/localizedContent';

interface StageViewProps {
  questions: Question[];
  categories: Category[];
  conferenceEvent: ConferenceEvent;
}

export const StageView: React.FC<StageViewProps> = ({
  questions,
  categories,
  conferenceEvent
}) => {
  // Stage's own labels stay English (out of the UI-translation scope), but
  // the event name and category names are translatable content -- they
  // follow the global language picker the same way Header/AudienceView do.
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage || 'en';
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);

  // Multi-Event Mode: point straight at this specific event's join link
  // (/e/:joinCode) rather than the bare site root -- a bare visit would
  // otherwise land an attendee on the "pick an event" dropdown instead of
  // straight into this event's question form.
  const joinUrl = conferenceEvent.joinCode
    ? `${window.location.origin}/e/${conferenceEvent.joinCode}`
    : window.location.origin;

  // Active Answering Question
  const currentAnswering = questions.find(q => q.status === 'answering');

  // Upcoming Pushed Questions for Stage Queue Ticker
  const stageQueue = questions.filter(q => q.status === 'pushed');

  // Live Timer
  useEffect(() => {
    if (!currentAnswering || !currentAnswering.answeringStartedAt) {
      setElapsedSecs(0);
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(currentAnswering.answeringStartedAt!).getTime();
      const now = Date.now();
      setElapsedSecs(Math.max(0, Math.floor((now - start) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentAnswering]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getCategoryBadgeColor = (colorName: string) => {
    switch (colorName) {
      case 'indigo': return 'cat-badge-indigo';
      case 'emerald': return 'cat-badge-emerald';
      case 'amber': return 'cat-badge-amber';
      case 'rose': return 'cat-badge-rose';
      default: return 'cat-badge-sky';
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col justify-between p-6 sm:p-10 transition-colors text-primary">

      {/* Top Stage Header */}
      <div className="border-b border-divider pb-6 space-y-4">

        <div className="flex items-center justify-between gap-4">
          {/* Conference Branding */}
          <div className="flex items-center space-x-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/20 shrink-0">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-primary truncate">{getLocalizedText(conferenceEvent.title, conferenceEvent.titleHi, conferenceEvent.titleOr, language)}</h1>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                  <Radio className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
                  LIVE ON STAGE
                </span>
              </div>
              <p className="text-sm mt-0.5 text-muted truncate">{getLocalizedText(conferenceEvent.subtitle, conferenceEvent.subtitleHi, conferenceEvent.subtitleOr, language)}</p>
            </div>
          </div>

          {/* Display Controls */}
          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition shrink-0"
            title="Toggle Fullscreen Presentation"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Audience Join QR Code & Short Code Banner -- always centered on the
            row regardless of how wide the branding/controls above are, and
            never hidden, so it reflows down to phone-width screens too. */}
        <div className="flex justify-center">
          <div className="flex items-center space-x-4 border border-divider rounded-2xl p-3 px-5 shadow-lg bg-surface">
            <div className="bg-white p-2 rounded-xl shadow-inner shrink-0">
              <QRCodeSVG value={joinUrl} size={64} bgColor="#ffffff" fgColor="#020617" level="M" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgb(var(--primary))' }}>Scan or Visit to Submit Questions</p>
              <p className="text-sm font-black tracking-wide text-primary">
                Join Code: <span className="font-mono text-amber-500">{conferenceEvent.joinCode}</span>
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* CENTER STAGE: NOW ANSWERING QUESTION HERO */}
      <div className="my-auto py-8">
        {currentAnswering ? (
          <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">

            {/* Header Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                {(() => {
                  const category = categories.find(c => c.id === currentAnswering.categoryId);
                  return (
                    <span className={`px-4 py-1.5 rounded-xl text-sm font-extrabold border ${getCategoryBadgeColor(category?.color || 'indigo')}`}>
                      {category ? getLocalizedText(category.name, category.nameHi, category.nameOr, language) : currentAnswering.categoryName}
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center space-x-2 px-4 py-2 rounded-2xl border border-divider-strong font-mono text-sm font-bold bg-surface-secondary" style={{ color: 'rgb(var(--primary))' }}>
                <Clock className="w-4 h-4" style={{ color: 'rgb(var(--primary))' }} />
                <span>Time: {formatTimer(elapsedSecs)}</span>
              </div>
            </div>

            {/* MAIN QUESTION DISPLAY */}
            <div className="live-spotlight-card rounded-3xl p-8 sm:p-12 border-2 shadow-2xl space-y-6 relative overflow-hidden">
              <p className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tight drop-shadow-md text-primary">
                "{currentAnswering.text}"
              </p>

              <div className="pt-6 border-t border-divider flex items-center justify-between">
                <div className="text-base text-secondary">
                  Question from: <strong className="font-bold text-primary">{currentAnswering.authorName}</strong>
                </div>
                <div className="text-xs font-mono" style={{ color: 'rgb(var(--primary))', opacity: 0.75 }}>
                  Live Conference Panel
                </div>
              </div>

              <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            </div>

          </div>
        ) : !conferenceEvent.id ? (
          <div className="max-w-3xl mx-auto text-center space-y-4 py-12">
            <Monitor className="w-16 h-16 text-indigo-400/60 mx-auto" />
            <h2 className="text-3xl font-extrabold text-secondary">No Event Is Currently Live</h2>
            <p className="text-sm max-w-lg mx-auto text-muted">
              This screen will populate automatically once a moderator starts the next event.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto text-center space-y-4 py-12">
            <Monitor className="w-16 h-16 text-indigo-400/60 mx-auto animate-bounce" />
            <h2 className="text-3xl font-extrabold text-secondary">Panel Live Q&A in Progress</h2>
            <p className="text-sm max-w-lg mx-auto text-muted">
              Audience members can scan the QR code or enter Join Code <strong className="font-mono text-amber-500">{conferenceEvent.joinCode}</strong> to submit live questions.
            </p>
          </div>
        )}
      </div>

      {/* FOOTER TICKER: UP NEXT ON STAGE */}
      <div className="border-t border-divider pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted">Up Next in Queue</h3>
          </div>
          <span className="text-xs font-medium text-muted">{stageQueue.length} Questions Queued</span>
        </div>

        {stageQueue.length === 0 ? (
          <p className="text-xs italic text-muted">No upcoming questions queued right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stageQueue.slice(0, 3).map((q) => {
              const category = categories.find(c => c.id === q.categoryId);
              return (
                <div key={q.id} className="rounded-xl p-3.5 border border-divider text-xs space-y-1.5 bg-surface shadow-sm">
                  <div className="flex items-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoryBadgeColor(category?.color || 'indigo')}`}>
                      {category ? getLocalizedText(category.name, category.nameHi, category.nameOr, language) : q.categoryName}
                    </span>
                  </div>
                  <p className="font-medium line-clamp-2 text-secondary">
                    "{q.text}"
                  </p>
                  <p className="text-[10px] font-semibold text-muted">
                    By {q.authorName}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
