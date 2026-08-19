import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Question, Category, ConferenceEvent } from '../types';
import { Sparkles, Monitor, Maximize2, Radio, MessageSquare, Clock, ShieldCheck } from 'lucide-react';

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [elapsedSecs, setElapsedSecs] = useState(0);

  // The app has no per-role URL routing -- a fresh visit to the site's
  // root always lands on the audience/question-submission view, so that's
  // exactly what the stage QR code should point at.
  const joinUrl = window.location.origin;

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
      case 'indigo': return 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30';
      case 'emerald': return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';
      case 'amber': return 'bg-amber-500/20 text-amber-300 border-amber-400/30';
      case 'rose': return 'bg-rose-500/20 text-rose-300 border-rose-400/30';
      default: return 'bg-sky-500/20 text-sky-300 border-sky-400/30';
    }
  };

  return (
    <div className={`min-h-[calc(100vh-65px)] flex flex-col justify-between p-6 sm:p-10 transition-colors ${
      themeMode === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* Top Stage Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-6">
        
        {/* Conference Branding */}
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/20">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{conferenceEvent.title}</h1>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Radio className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
                LIVE ON STAGE
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">{conferenceEvent.subtitle}</p>
          </div>
        </div>

        {/* Audience Join QR Code & Short Code Banner */}
        <div className="hidden lg:flex items-center space-x-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 px-5 shadow-lg">
          <div className="bg-white p-2 rounded-xl shadow-inner">
            <QRCodeSVG value={joinUrl} size={72} bgColor="#ffffff" fgColor="#020617" level="M" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Scan or Visit to Submit Questions</p>
            <p className="text-sm font-black text-white tracking-wide">
              Join Code: <span className="text-amber-400 font-mono">{conferenceEvent.joinCode}</span>
            </p>
          </div>
        </div>

        {/* Display Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-semibold hover:bg-slate-800 transition"
          >
            {themeMode === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition"
            title="Toggle Fullscreen Presentation"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* CENTER STAGE: NOW ANSWERING QUESTION HERO */}
      <div className="my-auto py-8">
        {currentAnswering ? (
          <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
            
            {/* Header Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <span className={`px-4 py-1.5 rounded-xl text-sm font-extrabold border ${getCategoryBadgeColor(categories.find(c => c.id === currentAnswering.categoryId)?.color || 'indigo')}`}>
                  {currentAnswering.categoryName}
                </span>
              </div>

              <div className="flex items-center space-x-2 bg-slate-900 px-4 py-2 rounded-2xl border border-indigo-500/30 font-mono text-sm text-indigo-300 font-bold">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Time: {formatTimer(elapsedSecs)}</span>
              </div>
            </div>

            {/* MAIN QUESTION DISPLAY */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 rounded-3xl p-8 sm:p-12 border-2 border-indigo-500/50 shadow-2xl space-y-6 relative overflow-hidden">
              <p className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tight text-white drop-shadow-md">
                "{currentAnswering.text}"
              </p>

              <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
                <div className="text-base text-slate-300">
                  Question from: <strong className="text-white font-bold">{currentAnswering.authorName}</strong>
                </div>
                <div className="text-xs text-indigo-300/70 font-mono">
                  Live Conference Panel
                </div>
              </div>

              <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            </div>

          </div>
        ) : (
          <div className="max-w-3xl mx-auto text-center space-y-4 py-12">
            <Monitor className="w-16 h-16 text-indigo-400/60 mx-auto animate-bounce" />
            <h2 className="text-3xl font-extrabold text-slate-200">Panel Live Q&A in Progress</h2>
            <p className="text-slate-400 text-sm max-w-lg mx-auto">
              Audience members can scan the QR code or enter Join Code <strong className="text-amber-400 font-mono">{conferenceEvent.joinCode}</strong> to submit live questions.
            </p>
          </div>
        )}
      </div>

      {/* FOOTER TICKER: UP NEXT ON STAGE */}
      <div className="border-t border-slate-800/80 pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Up Next in Queue</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">{stageQueue.length} Questions Queued</span>
        </div>

        {stageQueue.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No upcoming questions queued right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stageQueue.slice(0, 3).map((q) => (
              <div key={q.id} className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    {q.categoryName}
                  </span>
                </div>
                <p className="text-slate-200 font-medium line-clamp-2">
                  "{q.text}"
                </p>
                <p className="text-[10px] text-slate-400 font-semibold">
                  By {q.authorName}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
