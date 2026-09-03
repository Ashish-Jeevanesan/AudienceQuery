/**
 * @file src/components/ModeratorView.tsx
 * @description The moderator dashboard component. It serves as "command central",
 * allowing administrators to review incoming questions from the audience, approve or reject them,
 * edit details (re-categorize, add notes, set priority), and push questions to the
 * panel queue. It also manages event-wide configuration settings and category definitions.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Question, Category, ConferenceEvent, EventRecord, AppUser, UserRole, QuestionStatus } from '../types';
import { ShieldCheck, Send, CheckCircle, XCircle, Star, Edit3, Trash2, Search, Settings, Plus, MessageSquare, Tag, AlertCircle, CalendarDays, Users2, Radio, Languages, Loader2, Image } from 'lucide-react';
import { ManageArtifactsDrawer } from './ManageArtifactsDrawer';

const ALL_ROLES: UserRole[] = ['admin', 'moderator', 'panelist', 'stage'];

/** Converts an ISO timestamp to the local-time value a `datetime-local` input expects ("YYYY-MM-DDTHH:mm"). */
function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converts a `datetime-local` input's local-time value back to an ISO timestamp, or undefined if empty. */
function fromDatetimeLocalValue(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Props for the ModeratorView component.
 */
interface ModeratorViewProps {
  questions: Question[];
  categories: Category[];
  conferenceEvent: ConferenceEvent;
  events: EventRecord[];
  users: AppUser[];
  isAdmin: boolean;
  onUpdateStatus: (questionId: string, status: QuestionStatus, notes?: string) => void;
  onEditQuestion: (questionId: string, data: { text?: string; categoryId?: string; isPriority?: boolean; moderatorNotes?: string }) => Promise<void>;
  onDeleteQuestion: (questionId: string) => void;
  onCreateCategory: (data: { name: string; nameHi?: string; nameOr?: string; color: string; description?: string }) => void;
  onFetchEvents: () => void;
  onCreateEvent: (data: { title: string; titleHi?: string; titleOr?: string; subtitle?: string; subtitleHi?: string; subtitleOr?: string; allowAnonymous?: boolean; isAcceptingQuestions?: boolean; expiresAt?: string | null }) => Promise<void>;
  onUpdateEvent: (id: string, data: { title?: string; titleHi?: string; titleOr?: string; subtitle?: string; subtitleHi?: string; subtitleOr?: string; allowAnonymous?: boolean; isAcceptingQuestions?: boolean; expiresAt?: string | null }) => Promise<void>;
  onUploadEventMedia: (eventId: string, kind: 'logo' | 'banner', file: File, slot?: 1 | 2 | 3) => Promise<void>;
  onDeleteEventMedia: (eventId: string, kind: 'logo' | 'banner', slot?: 1 | 2 | 3) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onFetchUsers: () => void;
  onUpdateUser: (id: string, data: { role?: string; username?: string }) => Promise<void>;
  onTranslateText: (text: string, targets: ('hi' | 'or')[]) => Promise<Partial<Record<'hi' | 'or', string>>>;
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
  events,
  users,
  isAdmin,
  onUpdateStatus,
  onEditQuestion,
  onDeleteQuestion,
  onCreateCategory,
  onFetchEvents,
  onCreateEvent,
  onUpdateEvent,
  onUploadEventMedia,
  onDeleteEventMedia,
  onDeleteEvent,
  onFetchUsers,
  onUpdateUser,
  onTranslateText
}) => {
  // State variables for filter tabs, search, and sorting
  const [activeTab, setActiveTab] = useState<'pending' | 'pushed' | 'approved' | 'answering_answered' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  // 'all' = every event's questions, or a specific event id to review one
  // event in isolation. Multi-Event Mode: any number of events can be
  // concurrently open, so there's no more special "live" shorthand -- just
  // pick the one you want by name.
  const [eventFilter, setEventFilter] = useState<'all' | string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'priority'>('recent');

  // Edit Modal State for editing a specific question
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editText, setEditText] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIsPriority, setEditIsPriority] = useState(false);
  const [editError, setEditError] = useState('');

  // Manage Events/Categories/Users drawers are mutually exclusive (accordion) --
  // opening one closes whichever was already open, so there's never more than
  // one to lose track of. Opening a drawer also smooth-scrolls it into view.
  const [openDrawer, setOpenDrawer] = useState<'events' | 'categories' | 'users' | 'artifacts' | null>(null);
  const showEvents = openDrawer === 'events';
  const showCategories = openDrawer === 'categories';
  const showUsers = openDrawer === 'users';
  const showArtifacts = openDrawer === 'artifacts';
  const toggleDrawer = (drawer: 'events' | 'categories' | 'users' | 'artifacts') => {
    setOpenDrawer(prev => (prev === drawer ? null : drawer));
  };
  const closeDrawer = () => setOpenDrawer(null);

  const eventsDrawerRef = useRef<HTMLDivElement>(null);
  const categoriesDrawerRef = useRef<HTMLDivElement>(null);
  const usersDrawerRef = useRef<HTMLDivElement>(null);
  const artifactsDrawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ref = openDrawer === 'events' ? eventsDrawerRef : openDrawer === 'categories' ? categoriesDrawerRef : openDrawer === 'users' ? usersDrawerRef : openDrawer === 'artifacts' ? artifactsDrawerRef : null;
    ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [openDrawer]);

  const [newCatName, setNewCatName] = useState('');
  const [newCatNameHi, setNewCatNameHi] = useState('');
  const [newCatNameOr, setNewCatNameOr] = useState('');
  const [newCatColor, setNewCatColor] = useState('indigo');

  // Events drawer state
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTitleHi, setNewEventTitleHi] = useState('');
  const [newEventTitleOr, setNewEventTitleOr] = useState('');
  const [newEventSubtitle, setNewEventSubtitle] = useState('');
  const [newEventSubtitleHi, setNewEventSubtitleHi] = useState('');
  const [newEventSubtitleOr, setNewEventSubtitleOr] = useState('');
  const [newEventAllowAnonymous, setNewEventAllowAnonymous] = useState(true);
  // Optional end date/time, as a `datetime-local` input value ('' = never expires).
  const [newEventExpiresAt, setNewEventExpiresAt] = useState('');
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [createEventError, setCreateEventError] = useState('');
  // Multi-Event Mode: any number of events can accept questions at once, so
  // this toggles just the one row's own is_accepting_questions -- no more
  // singleton "activate" concept.
  const [togglingEventId, setTogglingEventId] = useState<string | null>(null);
  const [toggleEventError, setToggleEventError] = useState('');

  // Per-event inline edit (title/subtitle/allowAnonymous/isAcceptingQuestions)
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventEditDraft, setEventEditDraft] = useState<{ title: string; titleHi: string; titleOr: string; subtitle: string; subtitleHi: string; subtitleOr: string; allowAnonymous: boolean; isAcceptingQuestions: boolean; expiresAt: string }>({ title: '', titleHi: '', titleOr: '', subtitle: '', subtitleHi: '', subtitleOr: '', allowAnonymous: true, isAcceptingQuestions: true, expiresAt: '' });
  const [eventEditError, setEventEditError] = useState('');
  const [savingEventEdit, setSavingEventEdit] = useState(false);

  // Shared "Translate" button state -- one in-flight translation at a time,
  // identified by a field key (e.g. 'newCatName', 'eventEdit.title'), plus
  // any error scoped to that same key so it only shows next to the field
  // that actually failed.
  const [translatingField, setTranslatingField] = useState<string | null>(null);
  const [translateError, setTranslateError] = useState<{ field: string; message: string } | null>(null);

  const handleTranslate = async (fieldKey: string, text: string, setHi: (v: string) => void, setOr: (v: string) => void) => {
    if (!text.trim()) return;
    setTranslatingField(fieldKey);
    setTranslateError(null);
    try {
      const result = await onTranslateText(text.trim(), ['hi', 'or']);
      if (result.hi) setHi(result.hi);
      if (result.or) setOr(result.or);
      if (!result.hi && !result.or) {
        setTranslateError({ field: fieldKey, message: 'No translation returned. Please type it manually.' });
      }
    } catch (err: any) {
      setTranslateError({ field: fieldKey, message: err?.message || 'Translation failed. Please type it manually.' });
    } finally {
      setTranslatingField(null);
    }
  };

  /** A small inline "Translate" icon button, reused everywhere a name/title field has Hindi/Odia companions. */
  const TranslateButton: React.FC<{ fieldKey: string; sourceText: string; setHi: (v: string) => void; setOr: (v: string) => void }> = ({ fieldKey, sourceText, setHi, setOr }) => (
    <button
      type="button"
      onClick={() => handleTranslate(fieldKey, sourceText, setHi, setOr)}
      disabled={!sourceText.trim() || translatingField === fieldKey}
      title="Translate into Hindi & Odia"
      className="p-2 rounded-xl bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
    >
      {translatingField === fieldKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
    </button>
  );

  // Users drawer state (admin only)
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userEditDraft, setUserEditDraft] = useState<{ role: UserRole; username: string }>({ role: 'panelist', username: '' });
  const [userEditError, setUserEditError] = useState('');
  const [savingUserEdit, setSavingUserEdit] = useState(false);

  // The events/users lists aren't part of the public state snapshot, so this
  // already-admin/moderator-gated view fetches them itself. Users list is
  // admin-only server-side, so plain moderators skip that call entirely.
  useEffect(() => {
    onFetchEvents();
    if (isAdmin) onFetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

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

  if (eventFilter !== 'all') {
    filtered = filtered.filter(q => q.eventId === eventFilter);
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
    onCreateCategory({
      name: newCatName.trim(),
      nameHi: newCatNameHi.trim() || undefined,
      nameOr: newCatNameOr.trim() || undefined,
      color: newCatColor
    });
    setNewCatName('');
    setNewCatNameHi('');
    setNewCatNameOr('');
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

  /**
   * Handles creating a new event. Stays on the form (and surfaces the
   * error) if the create fails, instead of clearing it as if it worked.
   */
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    setCreatingEvent(true);
    setCreateEventError('');
    try {
      await onCreateEvent({
        title: newEventTitle.trim(),
        titleHi: newEventTitleHi.trim() || undefined,
        titleOr: newEventTitleOr.trim() || undefined,
        subtitle: newEventSubtitle.trim(),
        subtitleHi: newEventSubtitleHi.trim() || undefined,
        subtitleOr: newEventSubtitleOr.trim() || undefined,
        allowAnonymous: newEventAllowAnonymous,
        isAcceptingQuestions: true,
        expiresAt: fromDatetimeLocalValue(newEventExpiresAt) || null
      });
      setNewEventTitle('');
      setNewEventTitleHi('');
      setNewEventTitleOr('');
      setNewEventSubtitle('');
      setNewEventSubtitleHi('');
      setNewEventSubtitleOr('');
      setNewEventAllowAnonymous(true);
      setNewEventExpiresAt('');
    } catch (err: any) {
      setCreateEventError(err?.message || 'Unable to create event. Please try again.');
    } finally {
      setCreatingEvent(false);
    }
  };

  /**
   * Flips one event's own accepting-questions flag -- independent of every
   * other event, since any number can be open at once.
   */
  const handleToggleAcceptingQuestions = async (evt: EventRecord) => {
    setTogglingEventId(evt.id);
    setToggleEventError('');
    try {
      await onUpdateEvent(evt.id, { isAcceptingQuestions: !evt.isAcceptingQuestions });
    } catch (err: any) {
      setToggleEventError(err?.message || 'Unable to update event. Please try again.');
    } finally {
      setTogglingEventId(null);
    }
  };

  const openEventEdit = (evt: EventRecord) => {
    setEditingEventId(evt.id);
    setEventEditDraft({
      title: evt.title,
      titleHi: evt.titleHi || '',
      titleOr: evt.titleOr || '',
      subtitle: evt.subtitle,
      subtitleHi: evt.subtitleHi || '',
      subtitleOr: evt.subtitleOr || '',
      allowAnonymous: evt.allowAnonymous,
      isAcceptingQuestions: evt.isAcceptingQuestions,
      expiresAt: toDatetimeLocalValue(evt.expiresAt)
    });
    setEventEditError('');
  };

  const saveEventEdit = async () => {
    if (!editingEventId) return;
    setSavingEventEdit(true);
    setEventEditError('');
    try {
      // An empty field explicitly clears the expiry (null), not "leave alone" --
      // onUpdateEvent's expiresAt !== undefined check means null still updates.
      await onUpdateEvent(editingEventId, { ...eventEditDraft, expiresAt: fromDatetimeLocalValue(eventEditDraft.expiresAt) || null });
      setEditingEventId(null);
    } catch (err: any) {
      setEventEditError(err?.message || 'Unable to save event. Please try again.');
    } finally {
      setSavingEventEdit(false);
    }
  };

  const openUserEdit = (u: AppUser) => {
    setEditingUserId(u.id);
    setUserEditDraft({ role: u.role, username: u.username || '' });
    setUserEditError('');
  };

  const saveUserEdit = async () => {
    if (!editingUserId) return;
    setSavingUserEdit(true);
    setUserEditError('');
    try {
      await onUpdateUser(editingUserId, userEditDraft);
      setEditingUserId(null);
    } catch (err: any) {
      setUserEditError(err?.message || 'Unable to save user. Please try again.');
    } finally {
      setSavingUserEdit(false);
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Multi-Event Mode: any number of events can be open at once, so
              there's no single "submissions open/paused" toggle anymore --
              each event's own row in "Manage Events" has that control. This
              is just an at-a-glance count. */}
          <span className="px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center space-x-2 cat-badge-indigo">
            <Radio className="w-3.5 h-3.5" />
            <span>{events.filter(e => e.isAcceptingQuestions && !e.isExpired).length} event{events.filter(e => e.isAcceptingQuestions && !e.isExpired).length === 1 ? '' : 's'} open</span>
          </span>

          <button
            onClick={() => toggleDrawer('events')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface-secondary hover:bg-surface-hover text-secondary border border-divider flex items-center space-x-1.5 transition"
          >
            <CalendarDays className="w-4 h-4" />
            <span>Manage Events</span>
          </button>

          <button
            onClick={() => toggleDrawer('categories')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface-secondary hover:bg-surface-hover text-secondary border border-divider flex items-center space-x-1.5 transition"
          >
            <Settings className="w-4 h-4" />
            <span>Manage Categories</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => toggleDrawer('users')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface-secondary hover:bg-surface-hover text-secondary border border-divider flex items-center space-x-1.5 transition"
            >
              <Users2 className="w-4 h-4" />
              <span>Manage Users</span>
            </button>
          )}

          <button
            onClick={() => toggleDrawer('artifacts')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface-secondary hover:bg-surface-hover text-secondary border border-divider flex items-center space-x-1.5 transition"
          >
            <Image className="w-4 h-4" />
            <span>Manage Artifacts</span>
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

      {/* Manage Events Drawer */}
      {showEvents && (
        <div ref={eventsDrawerRef} className="bg-surface rounded-2xl p-6 border border-divider-strong shadow-xl space-y-5 animate-fadeIn scroll-mt-24">
          <div className="flex items-center justify-between border-b border-divider pb-3">
            <h3 className="font-bold text-primary text-base flex items-center space-x-2">
              <CalendarDays className="w-5 h-5 text-indigo-600" />
              <span>Manage Events</span>
            </h3>
            <button onClick={closeDrawer} className="text-muted hover:text-secondary font-bold">✕</button>
          </div>

          {/* Create Event */}
          <form onSubmit={handleCreateEvent} className="space-y-2 border-b border-divider pb-5">
            <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Create New Event</h4>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Event Title"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="Subtitle (optional)"
                value={newEventSubtitle}
                onChange={(e) => setNewEventSubtitle(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
              />
              <label className="flex items-center gap-1.5 px-2 whitespace-nowrap text-xs text-secondary">
                <input
                  type="checkbox"
                  checked={newEventAllowAnonymous}
                  onChange={(e) => setNewEventAllowAnonymous(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Allow anonymous</span>
              </label>
              <button
                type="submit"
                disabled={creatingEvent}
                className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-60"
              >
                {creatingEvent ? 'Creating…' : <Plus className="w-4 h-4" />}
              </button>
            </div>

            <label className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-xs text-secondary">
              <span className="whitespace-nowrap font-semibold">Expires (optional)</span>
              <input
                type="datetime-local"
                value={newEventExpiresAt}
                onChange={(e) => setNewEventExpiresAt(e.target.value)}
                className="px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-muted">After this, the event drops off the join dropdown and stops accepting questions.</span>
            </label>

            {/* Optional per-language title/subtitle -- shown to the audience
                when they've picked that language; falls back to the fields
                above when left blank. Translate fetches a draft from the
                English title/subtitle that can be corrected before saving. */}
            <div className="flex flex-col sm:flex-row gap-2 items-start">
              <input
                type="text"
                placeholder="Title (Hindi, optional)"
                value={newEventTitleHi}
                onChange={(e) => setNewEventTitleHi(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="Title (Odia, optional)"
                value={newEventTitleOr}
                onChange={(e) => setNewEventTitleOr(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
              />
              <TranslateButton fieldKey="newEventTitle" sourceText={newEventTitle} setHi={setNewEventTitleHi} setOr={setNewEventTitleOr} />
            </div>
            {translateError?.field === 'newEventTitle' && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                <AlertCircle className="w-3.5 h-3.5" /> {translateError.message}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2 items-start">
              <input
                type="text"
                placeholder="Subtitle (Hindi, optional)"
                value={newEventSubtitleHi}
                onChange={(e) => setNewEventSubtitleHi(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="Subtitle (Odia, optional)"
                value={newEventSubtitleOr}
                onChange={(e) => setNewEventSubtitleOr(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
              />
              <TranslateButton fieldKey="newEventSubtitle" sourceText={newEventSubtitle} setHi={setNewEventSubtitleHi} setOr={setNewEventSubtitleOr} />
            </div>
            {translateError?.field === 'newEventSubtitle' && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                <AlertCircle className="w-3.5 h-3.5" /> {translateError.message}
              </p>
            )}

            {createEventError && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                <AlertCircle className="w-3.5 h-3.5" /> {createEventError}
              </p>
            )}
          </form>

          {/* Event List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-muted uppercase tracking-wider">All Events</h4>
            {toggleEventError && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                <AlertCircle className="w-3.5 h-3.5" /> {toggleEventError}
              </p>
            )}
            {events.length === 0 ? (
              <p className="text-xs text-muted italic">No events yet. Create one above.</p>
            ) : (
              events.map(evt => (
                <div key={evt.id} className="rounded-xl border border-divider p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {evt.isExpired ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-secondary text-muted border border-divider">
                          EXPIRED
                        </span>
                      ) : evt.isAcceptingQuestions && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cat-badge-emerald">
                          <Radio className="w-3 h-3" /> OPEN
                        </span>
                      )}
                      <span className="text-sm font-semibold text-primary truncate">{evt.title}</span>
                      <span className="text-xs text-muted truncate">{evt.subtitle}</span>
                      <span className="text-[11px] font-mono text-muted">Code: {evt.joinCode}</span>
                      {evt.expiresAt && (
                        <span className="text-[11px] text-muted whitespace-nowrap">
                          {evt.isExpired ? 'Expired' : 'Expires'} {new Date(evt.expiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Multi-Event Mode: each event's own accepting-questions
                          flag, independent of every other event -- any number
                          can be open at once. */}
                      <button
                        onClick={() => handleToggleAcceptingQuestions(evt)}
                        disabled={togglingEventId === evt.id}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition disabled:opacity-60 ${
                          evt.isAcceptingQuestions
                            ? 'bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {togglingEventId === evt.id ? 'Saving…' : evt.isAcceptingQuestions ? 'Pause questions' : 'Open questions'}
                      </button>
                      <button
                        onClick={() => openEventEdit(evt)}
                        className="p-3 rounded-lg bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider transition"
                        title="Edit event"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Delete "${evt.title}"? This cannot be undone — the event, its questions, and its images will be permanently removed.`)) onDeleteEvent(evt.id); }}
                        className="p-3 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition"
                        title="Delete event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {editingEventId === evt.id && (
                    <div className="space-y-2 pt-2 border-t border-divider">
                      <input
                        type="text"
                        value={eventEditDraft.title}
                        onChange={(e) => setEventEditDraft(d => ({ ...d, title: e.target.value }))}
                        placeholder="Title"
                        className="w-full px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                      />
                      <div className="flex flex-col sm:flex-row gap-2 items-start">
                        <input
                          type="text"
                          value={eventEditDraft.titleHi}
                          onChange={(e) => setEventEditDraft(d => ({ ...d, titleHi: e.target.value }))}
                          placeholder="Title (Hindi, optional)"
                          className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          value={eventEditDraft.titleOr}
                          onChange={(e) => setEventEditDraft(d => ({ ...d, titleOr: e.target.value }))}
                          placeholder="Title (Odia, optional)"
                          className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                        />
                        <TranslateButton
                          fieldKey={`eventEdit.${evt.id}.title`}
                          sourceText={eventEditDraft.title}
                          setHi={(v) => setEventEditDraft(d => ({ ...d, titleHi: v }))}
                          setOr={(v) => setEventEditDraft(d => ({ ...d, titleOr: v }))}
                        />
                      </div>
                      {translateError?.field === `eventEdit.${evt.id}.title` && (
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                          <AlertCircle className="w-3.5 h-3.5" /> {translateError.message}
                        </p>
                      )}
                      <input
                        type="text"
                        value={eventEditDraft.subtitle}
                        onChange={(e) => setEventEditDraft(d => ({ ...d, subtitle: e.target.value }))}
                        placeholder="Subtitle"
                        className="w-full px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                      />
                      <div className="flex flex-col sm:flex-row gap-2 items-start">
                        <input
                          type="text"
                          value={eventEditDraft.subtitleHi}
                          onChange={(e) => setEventEditDraft(d => ({ ...d, subtitleHi: e.target.value }))}
                          placeholder="Subtitle (Hindi, optional)"
                          className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          value={eventEditDraft.subtitleOr}
                          onChange={(e) => setEventEditDraft(d => ({ ...d, subtitleOr: e.target.value }))}
                          placeholder="Subtitle (Odia, optional)"
                          className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                        />
                        <TranslateButton
                          fieldKey={`eventEdit.${evt.id}.subtitle`}
                          sourceText={eventEditDraft.subtitle}
                          setHi={(v) => setEventEditDraft(d => ({ ...d, subtitleHi: v }))}
                          setOr={(v) => setEventEditDraft(d => ({ ...d, subtitleOr: v }))}
                        />
                      </div>
                      {translateError?.field === `eventEdit.${evt.id}.subtitle` && (
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                          <AlertCircle className="w-3.5 h-3.5" /> {translateError.message}
                        </p>
                      )}
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 text-xs text-secondary">
                          <input
                            type="checkbox"
                            checked={eventEditDraft.allowAnonymous}
                            onChange={(e) => setEventEditDraft(d => ({ ...d, allowAnonymous: e.target.checked }))}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          <span>Allow anonymous</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-secondary">
                          <input
                            type="checkbox"
                            checked={eventEditDraft.isAcceptingQuestions}
                            onChange={(e) => setEventEditDraft(d => ({ ...d, isAcceptingQuestions: e.target.checked }))}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          <span>Accepting questions</span>
                        </label>
                      </div>
                      <label className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-xs text-secondary">
                        <span className="whitespace-nowrap font-semibold">Expires (optional)</span>
                        <input
                          type="datetime-local"
                          value={eventEditDraft.expiresAt}
                          onChange={(e) => setEventEditDraft(d => ({ ...d, expiresAt: e.target.value }))}
                          className="px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                        />
                        {eventEditDraft.expiresAt && (
                          <button
                            type="button"
                            onClick={() => setEventEditDraft(d => ({ ...d, expiresAt: '' }))}
                            className="text-[11px] font-semibold text-secondary hover:text-primary underline underline-offset-2 text-left"
                          >
                            Clear (never expires)
                          </button>
                        )}
                      </label>
                      {eventEditError && (
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                          <AlertCircle className="w-3.5 h-3.5" /> {eventEditError}
                        </p>
                      )}
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingEventId(null)} className="px-3 py-1.5 rounded-lg bg-surface-secondary text-secondary text-xs font-semibold hover:bg-surface-hover">Cancel</button>
                        <button onClick={saveEventEdit} disabled={savingEventEdit} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-60">
                          {savingEventEdit ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Manage Categories Drawer */}
      {showCategories && (
        <div ref={categoriesDrawerRef} className="bg-surface rounded-2xl p-6 border border-divider-strong shadow-xl space-y-5 animate-fadeIn scroll-mt-24">
          <div className="flex items-center justify-between border-b border-divider pb-3">
            <h3 className="font-bold text-primary text-base flex items-center space-x-2">
              <Settings className="w-5 h-5 text-indigo-600" />
              <span>Manage Categories</span>
            </h3>
            <button onClick={closeDrawer} className="text-muted hover:text-secondary font-bold">✕</button>
          </div>

          {/* Add Custom Category */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Add New Topic</h4>
            <form onSubmit={handleAddCategory} className="space-y-2">
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
              {/* Optional per-language names -- shown to the audience's topic
                  dropdown when they've picked that language; falls back to
                  the name above when left blank. Translate fetches a draft
                  from the English name above, which can be corrected before
                  saving. */}
              <div className="flex flex-col sm:flex-row gap-2 items-start">
                <input
                  type="text"
                  placeholder="Hindi name (optional)"
                  value={newCatNameHi}
                  onChange={(e) => setNewCatNameHi(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Odia name (optional)"
                  value={newCatNameOr}
                  onChange={(e) => setNewCatNameOr(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                />
                <TranslateButton fieldKey="newCatName" sourceText={newCatName} setHi={setNewCatNameHi} setOr={setNewCatNameOr} />
              </div>
              {translateError?.field === 'newCatName' && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                  <AlertCircle className="w-3.5 h-3.5" /> {translateError.message}
                </p>
              )}
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
      )}

      {/* Manage Users Drawer (admin only) */}
      {isAdmin && showUsers && (
        <div ref={usersDrawerRef} className="bg-surface rounded-2xl p-6 border border-divider-strong shadow-xl space-y-4 animate-fadeIn scroll-mt-24">
          <div className="flex items-center justify-between border-b border-divider pb-3">
            <h3 className="font-bold text-primary text-base flex items-center space-x-2">
              <Users2 className="w-5 h-5 text-indigo-600" />
              <span>Manage Users</span>
            </h3>
            <button onClick={closeDrawer} className="text-muted hover:text-secondary font-bold">✕</button>
          </div>

          {users.length === 0 ? (
            <p className="text-xs text-muted italic">No users found. New accounts created in Supabase Auth appear here automatically.</p>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="rounded-xl border border-divider p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">{u.username || u.email}</p>
                      <p className="text-xs text-muted truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold cat-badge-indigo capitalize">{u.role}</span>
                      <button
                        onClick={() => openUserEdit(u)}
                        className="p-3 rounded-lg bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider transition"
                        title="Edit user"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {editingUserId === u.id && (
                    <div className="space-y-2 pt-2 border-t border-divider">
                      <input
                        type="text"
                        value={userEditDraft.username}
                        onChange={(e) => setUserEditDraft(d => ({ ...d, username: e.target.value }))}
                        placeholder="Username"
                        className="w-full px-3 py-2 rounded-xl border border-divider text-xs text-primary bg-transparent outline-none focus:border-indigo-500"
                      />
                      <select
                        value={userEditDraft.role}
                        onChange={(e) => setUserEditDraft(d => ({ ...d, role: e.target.value as UserRole }))}
                        className="w-full px-3 py-2 rounded-xl border border-divider text-xs text-secondary bg-surface"
                      >
                        {ALL_ROLES.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {userEditError && (
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                          <AlertCircle className="w-3.5 h-3.5" /> {userEditError}
                        </p>
                      )}
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingUserId(null)} className="px-3 py-1.5 rounded-lg bg-surface-secondary text-secondary text-xs font-semibold hover:bg-surface-hover">Cancel</button>
                        <button onClick={saveUserEdit} disabled={savingUserEdit} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-60">
                          {savingUserEdit ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showArtifacts && (
        <div ref={artifactsDrawerRef} className="bg-surface rounded-2xl p-6 border border-divider-strong shadow-xl space-y-4 animate-fadeIn scroll-mt-24">
          <ManageArtifactsDrawer
            events={events}
            onUploadEventMedia={onUploadEventMedia}
            onDeleteEventMedia={onDeleteEventMedia}
          />
        </div>
      )}

      {/* Filter and Tab Bar */}
      <div className="bg-surface rounded-2xl p-4 border border-divider shadow-sm space-y-4">

        {/* Primary Status Tabs -- the row itself scrolls horizontally when it
            doesn't fit (deliberate), but nothing else hints that on a phone,
            so a soft fade on the trailing edge (mobile only) signals there's
            more to swipe to. */}
        <div className="relative">
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
          <div className="sm:hidden pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-surface to-transparent" />
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

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-divider text-xs text-secondary bg-surface outline-none"
            >
              <option value="all">All Events</option>
              {events.map(e => (
                <option key={e.id} value={e.id}>{e.title}{e.isExpired ? ' (expired)' : e.isAcceptingQuestions ? ' (open)' : ''}</option>
              ))}
            </select>

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

                      {/* Multi-Event Mode: Moderator sees every event's
                          questions together, so always label which event
                          each one belongs to -- including expired ones,
                          since their questions stay fully visible here. */}
                      <span className="text-[11px] text-muted bg-surface-secondary px-2 py-0.5 rounded border border-divider">
                        {events.find(e => e.id === q.eventId)?.title || 'Unknown Event'}
                        {events.find(e => e.id === q.eventId)?.isExpired ? ' · Expired' : ''}
                      </span>

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
                    
                    {/* Primary Action: PUSH TO PANEL -- only for questions
                        whose own event is currently accepting questions
                        (Multi-Event Mode: not tied to "the live event",
                        there is no such singular thing); the server
                        enforces this too, this is just the UX reflection. */}
                    {q.status !== 'pushed' && q.status !== 'answering' && (() => {
                      const qEvent = events.find(e => e.id === q.eventId);
                      return qEvent?.isAcceptingQuestions && !qEvent?.isExpired ? (
                        <button
                          onClick={() => onUpdateStatus(q.id, 'pushed')}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition"
                          title="Push to Panel Member interface"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send to Panel</span>
                        </button>
                      ) : (
                        <span
                          className="px-3 py-1.5 rounded-xl bg-surface-secondary text-disabled font-bold text-xs flex items-center space-x-1.5 border border-divider cursor-not-allowed"
                          title={qEvent?.isExpired ? "This question's event has expired" : "This question's event isn't accepting questions right now"}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{qEvent?.isExpired ? 'Event Expired' : 'Event Closed'}</span>
                        </span>
                      );
                    })()}

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
                      className={`p-3 rounded-xl border text-xs font-semibold transition ${
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
                      className="p-3 rounded-xl bg-surface-secondary text-secondary hover:bg-surface-hover border border-divider transition"
                      title="Edit text / category / notes"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Approve / Reject Actions */}
                    {q.status === 'pending' && (
                      <button
                        onClick={() => onUpdateStatus(q.id, 'approved')}
                        className="p-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                        title="Approve for public feed"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}

                    {q.status !== 'rejected' ? (
                      <button
                        onClick={() => onUpdateStatus(q.id, 'rejected')}
                        className="p-3 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition"
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
                      className="p-3 rounded-xl bg-surface-secondary text-muted hover:text-rose-600 hover:bg-rose-50 border border-divider transition"
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
