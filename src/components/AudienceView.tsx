import React, { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
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
    <div className="min-h-screen bg-primary transition-colors duration-300">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-secondary border-b border-divider">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary to-brand-primary-dark opacity-10"></div>
        
        <div className="relative px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-3xl mx-auto space-y-6 text-center">
            <div className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-tertiary border border-divider-strong">
              <span className="text-sm font-semibold text-secondary">
                Event Code: <span className="font-bold text-brand-accent ml-2">{conferenceEvent.joinCode}</span>
              </span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-primary leading-tight">
              {conferenceEvent.title}
            </h1>
            
            <p className="text-xl sm:text-2xl text-secondary">
              {conferenceEvent.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative max-w-2xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-secondary rounded-2xl shadow-md border border-divider overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary to-brand-primary-dark px-6 sm:px-8 py-8">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Ask a Question</h2>
                <p className="text-white/70 text-sm mt-1">Share your thoughts with the panel</p>
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-8 py-8 space-y-6">
            {submittedSuccess && (
              <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl flex items-center space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">✓</span>
                </div>
                <span className="font-medium text-green-800 dark:text-green-200">Question submitted successfully!</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center space-x-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">!</span>
                </div>
                <span className="font-medium text-red-800 dark:text-red-200">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-primary mb-3">Your Question</label>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Type your question here..."
                  className="w-full h-32 px-4 py-3 rounded-xl border-2 border-divider bg-primary text-primary placeholder-tertiary focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition resize-none"
                  disabled={isSubmitting}
                />
                <p className="mt-2 text-xs font-medium text-tertiary">{questionText.length} characters</p>
              </div>

              <div className="flex items-center">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="w-5 h-5 rounded border-divider"
                    disabled={isSubmitting}
                  />
                  <span className="ml-3 font-semibold text-primary group-hover:text-brand-primary transition">Ask anonymously</span>
                </label>
              </div>

              {!isAnonymous && (
                <div>
                  <label className="block text-sm font-bold text-primary mb-3">Your Name</label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 rounded-xl border-2 border-divider bg-primary text-primary placeholder-tertiary focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {categories.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-primary mb-3">Topic (Optional)</label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-divider bg-primary text-primary focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition"
                    disabled={isSubmitting}
                  >
                    <option value="">Select a topic...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !questionText.trim()}
                className="w-full bg-brand-primary hover:bg-brand-primary-dark disabled:opacity-60 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
              >
                <Send className="w-5 h-5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Question'}</span>
              </button>
            </form>
          </div>
        </div>

        <div className="mt-12 text-center">
          <div className="inline-block bg-secondary rounded-xl shadow-md border border-divider px-6 py-4">
            <p className="text-sm text-secondary">Your question will be reviewed by moderators and featured during the live session</p>
          </div>
        </div>
      </div>
    </div>
  );
};
