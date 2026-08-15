/**
 * @file src/components/AudienceView.tsx
 * @description This component provides the main interface for audience members.
 * It features a form for submitting new questions and a live feed of questions
 * submitted by the audience, with options for filtering and upvoting.
 */

import React, { useState } from 'react';
import { Question, Category, ConferenceEvent } from '../types';
import { Send, User, CheckCircle2, MessageSquare, Clock, AlertCircle, UserCheck } from 'lucide-react';

/**
 * Props for the AudienceView component.
 */
interface AudienceViewProps {
  questions: Question[];
  categories: Category[];
  conferenceEvent: ConferenceEvent;
  onSubmit: (params: { text: string; authorName: string; isAnonymous: boolean; categoryId: string }) => Promise<Question>;
  sessionId: string;
  mySubmittedIds: string[];
}

/**
 * The view for audience members to submit and view questions.
 * @param {AudienceViewProps} props The props for the component.
 * @returns {React.ReactElement} The rendered audience view.
 */
export const AudienceView: React.FC<AudienceViewProps> = ({
  questions,
  categories,
  conferenceEvent,
  onSubmit,
  sessionId,
  mySubmittedIds
}) => {
  // Users can only see their own questions (user isolation)
  const userQuestions = questions.filter(q => q.sessionId === sessionId);
  // State for the question submission form
  const [questionText, setQuestionText] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [filterCatId, setFilterCatId] = useState<string>('all');

  /**
   * Handles the submission of the new question form.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onSubmit({
        text: questionText,
        authorName,
        isAnonymous,
        categoryId: selectedCategoryId || categories[0]?.id || ''
      });
      setQuestionText('');
      setSubmittedSuccess(true);
      setTimeout(() => setSubmittedSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // IMPORTANT: Users can only see their own questions (user isolation via sessionId)
  let filteredQuestions = [...userQuestions];

  // Apply category filter
  if (filterCatId !== 'all') {
    filteredQuestions = filteredQuestions.filter(q => q.categoryId === filterCatId);
  }

  // Sort by creation date (newest first)
  filteredQuestions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  /**
   * Gets the appropriate Tailwind CSS classes for a category badge color.
   * @param {string} colorName The color name from the Category object.
   * @returns {string} Tailwind CSS classes.
   */
  const getBadgeColor = (colorName: string) => {
    switch (colorName) {
      case 'indigo': return 'bg-indigo-500/10 text-indigo-600 border-indigo-200';
      case 'emerald': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      case 'amber': return 'bg-amber-500/10 text-amber-600 border-amber-200';
      case 'rose': return 'bg-rose-500/10 text-rose-600 border-rose-200';
      default: return 'bg-sky-500/10 text-sky-600 border-sky-200';
    }
  };

  /**
   * Renders the appropriate status badge for a question.
   * @param {Question['status']} status The status of the question.
   * @returns {React.ReactElement | null} The status badge component.
   */
  const getStatusBadge = (status: Question['status']) => {
    switch (status) {
      case 'answering':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white animate-pulse">🎙️ ANSWERING LIVE</span>;
      case 'pushed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">✨ Up Next for Panel</span>;
      case 'approved':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">In Queue</span>;
      case 'answered':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Answered</span>;
      case 'pending':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">In Review</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      
      {/* Event Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
            Event Code: <span className="font-mono font-bold ml-1.5 text-white">{conferenceEvent.joinCode}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{conferenceEvent.title}</h2>
          <p className="text-indigo-200/80 text-sm">{conferenceEvent.subtitle}</p>
        </div>
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl"></div>
      </div>

      {/* Question Submission Form */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-lg">Ask a Question</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Real-time Submission</span>
        </div>

        {submittedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center space-x-3 text-emerald-800 text-sm animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-semibold">Question Submitted Successfully!</p>
              <p className="text-xs text-emerald-700">Your question is with our moderators for review.</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center space-x-3 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Question Input */}
          <div>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="What question is on your heart for the panel?"
              maxLength={300}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 text-sm placeholder-slate-400 outline-none transition resize-none"
              required
            />
            <div className="flex justify-between items-center mt-1 text-xs text-slate-400 px-1">
              <span>Please be concise and clear.</span>
              <span>{questionText.length}/300</span>
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Select a Topic
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    selectedCategoryId === cat.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Author Name or Anonymous Option */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-xs font-medium text-slate-700 flex items-center">
                  <UserCheck className="w-3.5 h-3.5 mr-1 text-slate-500" /> Post Anonymously
                </span>
              </label>
            </div>

            {!isAnonymous && (
              <div className="flex-1 sm:max-w-xs">
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Your Name (Optional)"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !questionText.trim() || !conferenceEvent.isAcceptingQuestions}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-500/10 flex items-center justify-center space-x-2 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Question'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Audience Live Questions Feed */}
      <div className="space-y-4">
        
        {/* Feed Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-lg">Live Questions</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-600">
              {filteredQuestions.length}
            </span>
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
            {/* Category Filter Dropdown */}
            <select
              value={filterCatId}
              onChange={(e) => setFilterCatId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 outline-none font-medium"
            >
              <option value="all">All Topics</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Questions List */}
        {filteredQuestions.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200/80 space-y-3">
            <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-slate-700 font-semibold">No questions in the feed yet.</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Be the first to ask a question! It will appear here after being reviewed by our moderators.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((q) => {
              const category = categories.find(c => c.id === q.categoryId);

              return (
                <div
                  key={q.id}
                  className={`bg-white rounded-2xl p-5 border transition-all hover:shadow-md ${
                    q.status === 'answering'
                      ? 'border-rose-300 ring-2 ring-rose-500/20 bg-gradient-to-r from-rose-50/50 via-white to-white'
                      : 'border-slate-200/80 hover:border-indigo-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    
                    {/* Main Content */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${getBadgeColor(category?.color || 'sky')}`}>
                          {q.categoryName}
                        </span>
                        {getStatusBadge(q.status)}
                      </div>

                      <p className="text-slate-900 font-medium text-sm leading-relaxed sm:text-base">
                        {q.text}
                      </p>

                      <div className="flex items-center space-x-3 text-xs text-slate-400 pt-1">
                        <span className="font-semibold text-slate-600 flex items-center">
                          {q.isAnonymous ? (
                            <span className="flex items-center text-slate-500">
                              <UserCheck className="w-3 h-3 mr-1" /> Anonymous
                            </span>
                          ) : (
                            <span className="text-slate-700">{q.authorName}</span>
                          )}
                        </span>
                        <span>•</span>
                        <span>{new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
};
