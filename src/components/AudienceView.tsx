import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import type { Category, ConferenceEvent } from '../types';

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
  const [questionText, setQuestionText] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

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
      setAuthorName('');
      setSubmittedSuccess(true);
      setTimeout(() => setSubmittedSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/40">
        <div className="space-y-2">
          <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
            Event Code: <span className="font-mono font-bold ml-1.5 text-white">{conferenceEvent.joinCode}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{conferenceEvent.title}</h2>
          <p className="text-indigo-200/80 text-sm">{conferenceEvent.subtitle}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-5">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-lg">Ask a Question</h3>
        </div>

        {submittedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center space-x-3 text-emerald-800 text-sm">
            <span>✓</span>
            <span>Your question has been submitted successfully!</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center space-x-3 text-rose-800 text-sm">
            <span>✕</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Your Question
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Type your question here..."
              className="w-full h-24 px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              disabled={isSubmitting}
            />
            <p className="text-xs text-slate-500 mt-1">{questionText.length} characters</p>
          </div>

          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              <span className="text-sm font-medium text-slate-700">Ask anonymously</span>
            </label>
          </div>

          {!isAnonymous && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
          )}

          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Category (Optional)
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={isSubmitting}
              >
                <option value="">Select a category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !questionText.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Question'}
          </button>
        </form>
      </div>

      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <p className="text-sm text-slate-700">
          Submit your question above and it will be reviewed by the moderators. The best questions will be featured during the live session.
        </p>
      </div>
    </div>
  );
};
