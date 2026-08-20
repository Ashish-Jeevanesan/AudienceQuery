/**
 * @file src/components/PanelView.tsx
 * @description The user interface for stage panelists. It provides a clean,
 * dark-themed, high-legibility layout designed for tablets or laptops placed on
 * the panel desk. It displays the currently active question being answered live
 * (with a timer) and a queue of upcoming questions pushed by moderators.
 */

import React, { useState, useEffect } from 'react';
import { Question, Category, QuestionStatus } from '../types';
import { Mic, CheckCircle2, Clock, Sparkles, ChevronRight, MessageSquare } from 'lucide-react';

/**
 * Props for the PanelView component.
 */
interface PanelViewProps {
  questions: Question[];
  categories: Category[];
  onUpdateStatus: (questionId: string, status: QuestionStatus) => void;
}

/**
 * The Panelist View component.
 * @param {PanelViewProps} props The props for the component.
 * @returns {React.ReactElement} The rendered panelist screen.
 */
export const PanelView: React.FC<PanelViewProps> = ({
  questions,
  categories,
  onUpdateStatus
}) => {
  // State variables for category filtering and the timer
  const [selectedCatId, setSelectedCatId] = useState('all');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Find the single question currently being answered live on stage
  const currentAnswering = questions.find(q => q.status === 'answering');

  // Filter questions that are in the pushed queue waiting for the panel
  const pushedQuestions = questions.filter(q => q.status === 'pushed');

  // Filter the panel queue based on the selected topic
  const filteredQueue = selectedCatId === 'all'
    ? pushedQuestions
    : pushedQuestions.filter(q => q.categoryId === selectedCatId);

  // Filter completed/answered questions for the history log
  const completedQuestions = questions.filter(q => q.status === 'answered');

  // Effect to manage the live timer for the active question on stage
  useEffect(() => {
    if (!currentAnswering || !currentAnswering.answeringStartedAt) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(currentAnswering.answeringStartedAt!).getTime();
      const now = new Date().getTime();
      setElapsedSeconds(Math.max(0, Math.floor((now - start) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentAnswering]);

  /**
   * Helper function to format seconds into MM:SS format.
   * @param {number} totalSec Total seconds elapsed.
   * @returns {string} Formatted MM:SS string.
   */
  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Helper function to get styling classes for topic badges.
   */
  const getBadgeColor = (colorName: string) => {
    switch (colorName) {
      case 'indigo': return 'cat-badge-indigo';
      case 'emerald': return 'cat-badge-emerald';
      case 'amber': return 'cat-badge-amber';
      case 'rose': return 'cat-badge-rose';
      default: return 'cat-badge-sky';
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] transition-colors text-primary">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-divider pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-primary">Panel Screen</h2>
              <p className="text-xs text-muted">Moderator-approved questions for the panel.</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="px-3 py-1.5 rounded-xl border text-xs font-bold cat-badge-indigo">
              {pushedQuestions.length} Questions in Queue
            </span>
          </div>
        </div>

        {/* HERO SPOTLIGHT: CURRENTLY ANSWERING LIVE */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
            <span>Now Answering Live</span>
          </div>

          {currentAnswering ? (
            <div className="live-spotlight-card rounded-3xl p-6 sm:p-8 border-2 shadow-2xl shadow-indigo-500/10 space-y-6 relative overflow-hidden">

              <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${getBadgeColor(categories.find(c => c.id === currentAnswering.categoryId)?.color || 'indigo')}`}>
                    {currentAnswering.categoryName}
                  </span>
                </div>

                <div className="flex items-center space-x-2 bg-surface-secondary px-3 py-1.5 rounded-xl border border-divider-strong text-xs font-mono font-bold" style={{ color: 'rgb(var(--primary))' }}>
                  <Clock className="w-4 h-4" style={{ color: 'rgb(var(--primary))' }} />
                  <span>Elapsed: {formatTimer(elapsedSeconds)}</span>
                </div>
              </div>

              {/* Massive Question Typography for Stage Scanning */}
              <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-primary leading-tight tracking-tight relative z-10">
                "{currentAnswering.text}"
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-divider relative z-10">
                <div className="text-xs text-muted">
                  From: <strong className="text-primary text-sm">{currentAnswering.authorName}</strong>
                  {currentAnswering.moderatorNotes && (
                    <p className="mt-1 italic" style={{ color: 'rgb(var(--primary))', opacity: 0.8 }}>
                      Moderator Note: {currentAnswering.moderatorNotes}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => onUpdateStatus(currentAnswering.id, 'answered')}
                  className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Mark as Answered</span>
                </button>
              </div>

            </div>
          ) : (
            <div className="bg-surface-secondary rounded-3xl p-8 border border-divider text-center space-y-3">
              <Sparkles className="w-8 h-8 text-muted mx-auto" />
              <h3 className="text-secondary font-bold text-lg">No active question.</h3>
              <p className="text-xs text-muted max-w-md mx-auto">
                Select a question from the queue below and click <strong>"Answer Live"</strong> to present it on stage.
              </p>
            </div>
          )}
        </div>

        {/* Pushed Questions Queue */}
        <div className="space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-divider pb-3">
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-primary text-lg">Questions Queue</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border cat-badge-indigo">
                {filteredQueue.length} Ready
              </span>
            </div>

            {/* Topic Filter */}
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-surface border border-divider text-xs text-secondary font-medium outline-none"
            >
              <option value="all">All Topics</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="bg-surface-secondary rounded-2xl p-8 text-center border border-divider">
              <MessageSquare className="w-8 h-8 text-muted mx-auto mb-2" />
              <p className="text-muted text-xs font-medium">No questions in the queue.</p>
              <p className="text-muted text-[11px] mt-1">Approved questions will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredQueue.map((q) => {
                const category = categories.find(c => c.id === q.categoryId);

                return (
                  <div
                    key={q.id}
                    className="bg-surface rounded-2xl p-5 border border-divider hover:border-divider-strong transition-all shadow-md space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getBadgeColor(category?.color || 'sky')}`}>
                            {q.categoryName}
                          </span>

                          {q.isPriority && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold border cat-badge-amber">
                              ★ Priority
                            </span>
                          )}
                        </div>

                        <p className="text-primary font-bold text-lg sm:text-xl leading-snug">
                          {q.text}
                        </p>

                        <div className="text-xs text-muted">
                          From: <strong className="text-primary">{q.authorName}</strong>
                          {q.moderatorNotes && (
                            <span className="ml-2 px-2 py-0.5 rounded border text-[11px] cat-badge-indigo">
                              Moderator Note: {q.moderatorNotes}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* START ANSWERING BUTTON */}
                      <button
                        onClick={() => onUpdateStatus(q.id, 'answering')}
                        className="w-full sm:w-auto px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2 transition shrink-0 cursor-pointer"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Answer Live</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Answered Questions History */}
        {completedQuestions.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-divider">
            <h3 className="font-bold text-muted text-xs uppercase tracking-wider">Answered Questions ({completedQuestions.length})</h3>
            <div className="space-y-2 opacity-75">
              {completedQuestions.map((q) => (
                <div key={q.id} className="bg-surface-secondary rounded-xl p-3 border border-divider text-xs flex items-center justify-between text-secondary">
                  <div className="flex items-center space-x-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">{q.text}</span>
                  </div>
                  <span className="text-[11px] text-muted shrink-0 ml-2">{q.categoryName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
