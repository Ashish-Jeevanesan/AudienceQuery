/**
 * @file src/components/ModeratorView.tsx
 * @description The moderator dashboard component. It serves as "command central",
 * allowing administrators to review incoming questions from the audience, approve or reject them,
 * edit details (re-categorize, add notes, set priority), and push questions to the
 * panel queue. It also manages event-wide configuration settings and category definitions.
 */

import React, { useState, useEffect } from 'react';
import { Question, Category, ConferenceEvent, QuestionStatus } from '../types';
import { ShieldCheck, Send, CheckCircle, XCircle, Star, Edit3, Trash2, Search, Settings, Plus, MessageSquare, Tag, AlertCircle } from 'lucide-react';

/**
 * Props for the ModeratorView component.
 */
interface ModeratorViewProps {
  questions: Question[];
  categories: Category[];
  conferenceEvent: ConferenceEvent;
  onUpdateStatus: (questionId: string, status: QuestionStatus, notes?: string) => void;
  onEditQuestion: (questionId: string, data: { text?: string; categoryId?: string; isPriority?: boolean; moderatorNotes?: string }) => Promise<void>;
  onDeleteQuestion: (questionId: string) => void;
  onCreateCategory: (data: { name: string; color: string; description?: string }) => void;
  onUpdateEvent: (data: Partial<ConferenceEvent>) => void;
}

/**
 * The Moderator Control Panel component.
 * @param {ModeratorViewProps} props The props for the component.
 * @returns {React.ReactElement} The rendered moderator dashboard.
 */
export const ModeratorView: React.FC<ModeratorViewProps> = ({
  questions,
  categories,
  conferenceEvent,
  onUpdateStatus,
  onEditQuestion,
  onDeleteQuestion,
  onCreateCategory,
  onUpdateEvent
}) => {
  // State variables for filter tabs, search, and sorting
  const [activeTab, setActiveTab] = useState<'pending' | 'pushed' | 'approved' | 'answering_answered' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'priority'>('recent');

  // Edit Modal State for editing a specific question
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editText, setEditText] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIsPriority, setEditIsPriority] = useState(false);
  const [editError, setEditError] = useState('');

  // Settings Panel State (toggles visibility of the configuration card)
  const [showSettings, setShowSettings] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('indigo');

  // Event title/subtitle are edited locally and only saved on blur --
  // saving on every keystroke would fire a request (and the shared
  // loading overlay) per character typed.
  const [titleDraft, setTitleDraft] = useState(conferenceEvent.title);
  const [subtitleDraft, setSubtitleDraft] = useState(conferenceEvent.subtitle);

  useEffect(() => {
    setTitleDraft(conferenceEvent.title);
  }, [conferenceEvent.title]);

  useEffect(() => {
    setSubtitleDraft(conferenceEvent.subtitle);
  }, [conferenceEvent.subtitle]);

  // Metrics for the dashboard counters
  const pendingCount = questions.filter(q => q.status === 'pending').length;
  const pushedCount = questions.filter(q => q.status === 'pushed').length;
  const answeringCount = questions.filter(q => q.status === 'answering').length;
  const answeredCount = questions.filter(q => q.status === 'answered').length;
  const approvedCount = questions.filter(q => q.status === 'approved').length;

  // Filter questions based on the active tab, category, and search query
  let filtered = questions.filter(q => {
    if (activeTab === 'pending') return q.status === 'pending';
    if (activeTab === 'pushed') return q.status === 'pushed';
    if (activeTab === 'approved') return q.status === 'approved';
    if (activeTab === 'answering_answered') return q.status === 'answering' || q.status === 'answered';
    if (activeTab === 'rejected') return q.status === 'rejected';
    return true;
  });

  if (categoryFilter !== 'all') {
    filtered = filtered.filter(q => q.categoryId === categoryFilter);
  }

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(item => 
      item.text.toLowerCase().includes(query) ||
      item.authorName.toLowerCase().includes(query) ||
      item.categoryName.toLowerCase().includes(query) ||
      (item.moderatorNotes && item.moderatorNotes.toLowerCase().includes(query))
    );
  }

  // Sort the filtered questions based on user selection
  filtered.sort((a, b) => {
    if (sortBy === 'priority' && a.isPriority !== b.isPriority) {
      return a.isPriority ? -1 : 1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  /**
   * Opens the edit modal for a selected question.
   */
  const openEditModal = (q: Question) => {
    setEditingQuestion(q);
    setEditText(q.text);
    setEditCategoryId(q.categoryId);
    setEditNotes(q.moderatorNotes || '');
    setEditIsPriority(q.isPriority);
    setEditError('');
  };

  /**
   * Saves the changes made in the edit modal. Stays open (showing the
   * shared loader) until the save actually resolves, and surfaces the
   * error in-place on failure instead of closing as if it had succeeded.
   */
  const saveEdit = async () => {
    if (!editingQuestion) return;
    setEditError('');
    try {
      await onEditQuestion(editingQuestion.id, {
        text: editText,
        categoryId: editCategoryId,
        moderatorNotes: editNotes,
        isPriority: editIsPriority
      });
      setEditingQuestion(null);
    } catch (err: any) {
      setEditError(err?.message || 'Unable to save changes. Please try again.');
    }
  };

  /**
   * Handles the creation of a new topic category.
   */
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    onCreateCategory({ name: newCatName.trim(), color: newCatColor });
    setNewCatName('');
  };

  /**
   * Helper function to get styling based on category color.
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Banner & Control Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface text-primary rounded-2xl p-6 shadow-xl border border-divider">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6" style={{ color: 'rgb(var(--primary))' }} />
            <h2 className="text-xl font-bold tracking-tight text-primary">Moderator Control Panel</h2>
          </div>
          <p className="text-muted text-xs mt-1">
            Review incoming questions, curate the feed, and push approved questions to the panel queue.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => onUpdateEvent({ isAcceptingQuestions: !conferenceEvent.isAcceptingQuestions })}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center space-x-2 transition ${
              conferenceEvent.isAcceptingQuestions ? 'cat-badge-emerald' : 'cat-badge-amber'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${conferenceEvent.isAcceptingQuestions ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span>{conferenceEvent.isAcceptingQuestions ? 'Submissions OPEN' : 'Submissions PAUSED'}</span>
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface-secondary hover:bg-surface-hover text-secondary border border-divider flex items-center space-x-1.5 transition"
          >
            <Settings className="w-4 h-4" />
            <span>Conference Settings</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-surface rounded-2xl p-4 border border-divider shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Review Inbox</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-primary">{pendingCount}</span>
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-bold">Pending</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-4 border border-indigo-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Panel Queue</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-indigo-600">{pushedCount}</span>
            <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">Pushed</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-4 border border-rose-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Live on Stage</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-rose-600">{answeringCount}</span>
            <span className="text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-bold animate-pulse">Active</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-4 border border-divider shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">In Public Feed</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-primary">{approvedCount}</span>
            <span className="text-xs text-muted bg-surface-secondary px-2 py-0.5 rounded-full font-medium">Visible</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-4 border border-divider shadow-sm col-span-2 sm:col-span-1 flex flex-col justify-between">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Answered</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-primary">{answeredCount}</span>
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">Completed</span>
          </div>
        </div>
      </div>

      {/* Settings Modal Drawer */}
      {showSettings && (
        <div className="bg-surface rounded-2xl p-6 border border-divider-strong shadow-xl space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-divider pb-3">
            <h3 className="font-bold text-primary text-base flex items-center space-x-2">
              <Settings className="w-5 h-5 text-indigo-600" />
              <span>Conference Settings & Topics</span>
            </h3>
            <button onClick={() => setShowSettings(false)} className="text-muted hover:text-secondary font-bold">✕</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Event Branding */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Conference Info</h4>
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">Event Title</label>
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => {
                    if (titleDraft !== conferenceEvent.title) onUpdateEvent({ title: titleDraft });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">Subtitle / Session Name</label>
                <input
                  type="text"
                  value={subtitleDraft}
                  onChange={(e) => setSubtitleDraft(e.target.value)}
                  onBlur={() => {
                    if (subtitleDraft !== conferenceEvent.subtitle) onUpdateEvent({ subtitle: subtitleDraft });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Add Custom Category */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Add New Topic</h4>
              <form onSubmit={handleAddCategory} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Topic Name (e.g., Parenting)"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                  />
                  <select
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="px-2 py-2 rounded-xl border border-divider text-xs text-secondary bg-surface"
                  >
                    <option value="indigo">Indigo</option>
                    <option value="emerald">Emerald</option>
                    <option value="amber">Amber</option>
                    <option value="rose">Rose</option>
                    <option value="sky">Sky</option>
                  </select>
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {categories.map(c => (
                    <span key={c.id} className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getBadgeColor(c.color)}`}>
                      {c.name}
                    </span>
                  ))}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Tab Bar */}
      <div className="bg-surface rounded-2xl p-4 border border-divider shadow-sm space-y-4">

        {/* Primary Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-divider">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-secondary hover:bg-surface-secondary'
            }`}
          >
            <span>Review Inbox</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/20 font-extrabold">{pendingCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('pushed')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'pushed'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-secondary hover:bg-surface-secondary'
            }`}
          >
            <span>Panel Queue</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-extrabold">{pushedCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'approved'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-secondary hover:bg-surface-secondary'
            }`}
          >
            <span>Public Feed</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-extrabold">{approvedCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('answering_answered')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'answering_answered'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-secondary hover:bg-surface-secondary'
            }`}
          >
            <span>Live / Answered</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-extrabold">{answeringCount + answeredCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'rejected'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-secondary hover:bg-surface-secondary'
            }`}
          >
            <span>Rejected</span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-secondary hover:bg-surface-secondary'
            }`}
          >
            <span>All ({questions.length})</span>
          </button>
        </div>

        {/* Search, Category & Sorting Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search questions, authors, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-divider text-xs text-secondary bg-surface outline-none"
            >
              <option value="all">All Topics</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-divider text-xs text-secondary bg-surface outline-none"
            >
              <option value="priority">Sort by Priority</option>
              <option value="recent">Sort by Newest</option>
            </select>
          </div>

        </div>

      </div>

      {/* Question Cards Feed */}
      {filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl p-12 text-center border border-divider space-y-3">
          <MessageSquare className="w-10 h-10 text-disabled mx-auto" />
          <h4 className="text-secondary font-semibold">No questions in this view.</h4>
          <p className="text-xs text-muted">Questions from the audience will appear in the 'Review Inbox' tab.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => {
            const category = categories.find(c => c.id === q.categoryId);

            return (
              <div
                key={q.id}
                className={`bg-surface rounded-2xl p-5 border transition-all ${
                  q.isPriority
                    ? 'border-amber-300 ring-2 ring-amber-500/20 bg-amber-50/20'
                    : q.status === 'pushed'
                    ? 'border-indigo-300 ring-2 ring-indigo-500/10 bg-indigo-50/10'
                    : q.status === 'answering'
                    ? 'border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/20'
                    : 'border-divider hover:border-divider-strong'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  
                  {/* Left Info & Content */}
                  <div className="space-y-2 flex-1">
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${getBadgeColor(category?.color || 'sky')}`}>
                        {q.categoryName}
                      </span>

                      {q.isPriority && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950">
                          <Star className="w-3 h-3 mr-1 fill-slate-950" /> High Priority
                        </span>
                      )}

                      <span className="text-xs text-muted">
                        {new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-primary font-semibold text-base leading-snug">
                      {q.text}
                    </p>

                    <div className="flex items-center space-x-3 text-xs text-muted">
                      <span>From: <strong className="text-primary">{q.authorName}</strong></span>
                      {q.moderatorNotes && (
                        <span className="bg-surface-secondary px-2 py-0.5 rounded text-secondary font-mono text-[11px]">
                          Moderator Note: {q.moderatorNotes}
                        </span>
                      )}
                    </div>

                  </div>

                  {/* Right Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-divider">
                    
                    {/* Primary Action: PUSH TO PANEL */}
                    {q.status !== 'pushed' && q.status !== 'answering' && (
                      <button
                        onClick={() => onUpdateStatus(q.id, 'pushed')}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition"
                        title="Push to Panel Member interface"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send to Panel</span>
                      </button>
                    )}

                    {q.status === 'pushed' && (
                      <span className="px-3 py-1.5 rounded-xl bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center space-x-1 border border-indigo-200">
                        <CheckCircle className="w-3.5 h-3.5 text-indigo-600" />
                        <span>In Panel's Queue</span>
                      </span>
                    )}

                    {q.status === 'answering' && (
                      <span className="px-3 py-1.5 rounded-xl bg-rose-500 text-white font-bold text-xs flex items-center space-x-1 animate-pulse">
                        <span>🎙️ Live</span>
                      </span>
                    )}

                    {/* Toggle Priority Star */}
                    <button
                      onClick={() => onEditQuestion(q.id, { isPriority: !q.isPriority }).catch(() => {})}
                      className={`p-2 rounded-xl border text-xs font-semibold transition ${
                        q.isPriority
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-surface-secondary text-secondary border-divider hover:bg-surface-hover'
                      }`}
                      title="Toggle Priority Star"
                    >
                      <Star className={`w-4 h-4 ${q.isPriority ? 'fill-amber-500 text-amber-600' : ''}`} />
                    </button>

                    {/* Edit Details Button */}
                    <button
                      onClick={() => openEditModal(q)}
                      className="p-2 rounded-xl bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider transition"
                      title="Edit text / category / notes"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Approve / Reject Actions */}
                    {q.status === 'pending' && (
                      <button
                        onClick={() => onUpdateStatus(q.id, 'approved')}
                        className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                        title="Approve for public feed"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}

                    {q.status !== 'rejected' ? (
                      <button
                        onClick={() => onUpdateStatus(q.id, 'rejected')}
                        className="p-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition"
                        title="Reject question"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onUpdateStatus(q.id, 'pending')}
                        className="px-2.5 py-1.5 rounded-xl bg-surface-secondary text-secondary font-medium text-xs hover:bg-surface-hover"
                      >
                        Restore
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => onDeleteQuestion(q.id)}
                      className="p-2 rounded-xl bg-surface-secondary text-muted hover:text-rose-600 hover:bg-rose-50 border border-divider transition"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Question Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-divider animate-fadeIn">
            <div className="flex items-center justify-between border-b border-divider pb-3">
              <h3 className="font-bold text-primary text-base">Edit Question</h3>
              <button onClick={() => setEditingQuestion(null)} className="text-muted hover:text-secondary font-bold">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">Question Text</label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">Change Topic</label>
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-divider text-xs text-secondary bg-surface"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">Internal Moderator Note</label>
                <input
                  type="text"
                  placeholder="e.g., Direct to panelist David, or merge with q-104"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                />
              </div>

              <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsPriority}
                  onChange={(e) => setEditIsPriority(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-secondary">Mark as High Priority</span>
              </label>

              {editError && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                  <AlertCircle className="w-3.5 h-3.5" /> {editError}
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-divider">
              <button
                onClick={() => setEditingQuestion(null)}
                className="px-4 py-2 rounded-xl bg-surface-secondary text-secondary text-xs font-semibold hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-500/10"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
