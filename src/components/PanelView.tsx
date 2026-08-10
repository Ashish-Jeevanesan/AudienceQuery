/**
 * @file src/components/PanelView.tsx
 * @description The user interface for stage panelists. It provides a clean,
 * dark-themed, high-legibility layout designed for tablets or laptops placed on
 * the panel desk. It displays the currently active question being answered live
 * (with a timer) and a queue of upcoming questions pushed by moderators.
 */

import React, { useState, useEffect } from 'react';
import { Question, Category, QuestionStatus } from '../types';
import { Mic, CheckCircle2, Clock, ThumbsUp, Eye, Sparkles, ChevronRight, MessageSquare } from 'lucide-react';

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
  // State variables for category filtering, contrast mode, and timer
  const [selectedCatId, setSelectedCatId] = useState('all');
  const [highContrastMode, setHighContrastMode] = useState(false);
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
      case 'indigo': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'emerald': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'amber': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'rose': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default: return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
    }
  };

  return (
    <div className={`min-h-[calc(100vh-65px)] transition-colors ${
      highContrastMode ? 'bg-black text-white' : 'bg-slate-950 text-slate-100'
    }`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Panel Screen</h2>
              <p className="text-xs text-slate-400">Moderator-approved questions for the panel.</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setHighContrastMode(!highContrastMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center space-x-1.5 transition ${
                highContrastMode
                  ? 'bg-yellow-400 text-black border-yellow-300'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>{highContrastMode ? 'High Contrast ON' : 'Dark Mode'}</span>
            </button>

            <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-indigo-400 font-bold">
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
            <div className="bg-gradient-to-br from-indigo-950/90 via-slate-900 to-slate-950 rounded-3xl p-6 sm:p-8 border-2 border-indigo-500/60 shadow-2xl shadow-indigo-500/10 space-y-6 relative overflow-hidden">
              
              <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${getBadgeColor(categories.find(c => c.id === currentAnswering.categoryId)?.color || 'indigo')}`}>
                    {currentAnswering.categoryName}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center">
                    <ThumbsUp className="w-3.5 h-3.5 mr-1" /> {currentAnswering.upvotes} Votes
                  </span>
                </div>

                <div className="flex items-center space-x-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-indigo-500/40 text-xs font-mono text-indigo-300 font-bold">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Elapsed: {formatTimer(elapsedSeconds)}</span>
                </div>
              </div>

              {/* Massive Question Typography for Stage Scanning */}
              <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight relative z-10">
                "{currentAnswering.text}"
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-800 relative z-10">
                <div className="text-xs text-slate-400">
                  From: <strong className="text-slate-200 text-sm">{currentAnswering.authorName}</strong>
                  {currentAnswering.moderatorNotes && (
                    <p className="text-indigo-300/80 mt-1 italic">
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
            <div className="bg-slate-900/60 rounded-3xl p-8 border border-slate-800 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-slate-500 mx-auto" />
              <h3 className="text-slate-300 font-bold text-lg">No active question.</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Select a question from the queue below and click <strong>"Answer Live"</strong> to present it on stage.
              </p>
            </div>
          )}
        </div>

        {/* Pushed Questions Queue */}
        <div className="space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-white text-lg">Questions Queue</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                {filteredQueue.length} Ready
              </span>
            </div>

            {/* Topic Filter */}
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 font-medium outline-none"
            >
              <option value="all">All Topics</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="bg-slate-900/40 rounded-2xl p-8 text-center border border-slate-800/80">
              <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-xs font-medium">No questions in the queue.</p>
              <p className="text-slate-500 text-[11px] mt-1">Approved questions will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredQueue.map((q) => {
                const category = categories.find(c => c.id === q.categoryId);

                return (
                  <div
                    key={q.id}
                    className="bg-slate-900 rounded-2xl p-5 border border-slate-800 hover:border-slate-700 transition-all shadow-md space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getBadgeColor(category?.color || 'sky')}`}>
                            {q.categoryName}
                          </span>

                          {q.isPriority && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              ★ Priority
                            </span>
                          )}

                          <span className="text-xs text-slate-400 font-semibold flex items-center">
                            <ThumbsUp className="w-3 h-3 mr-1 text-indigo-400" /> {q.upvotes} Votes
                          </span>
                        </div>

                        <p className="text-white font-bold text-lg sm:text-xl leading-snug">
                          {q.text}
                        </p>

                        <div className="text-xs text-slate-400">
                          From: <strong className="text-slate-200">{q.authorName}</strong>
                          {q.moderatorNotes && (
                            <span className="ml-2 text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800 text-[11px]">
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
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="font-bold text-slate-400 text-xs uppercase tracking-wider">Answered Questions ({completedQuestions.length})</h3>
            <div className="space-y-2 opacity-75">
              {completedQuestions.map((q) => (
                <div key={q.id} className="bg-slate-900/50 rounded-xl p-3 border border-slate-800 text-xs flex items-center justify-between text-slate-300">
                  <div className="flex items-center space-x-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">{q.text}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 shrink-0 ml-2">{q.categoryName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
