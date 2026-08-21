/**
 * @file src/App.tsx
 * @description The root component of the application. It acts as a controller,
 * fetching all real-time data via the `useRealTimeQnA` hook and routing to the
 * appropriate view (`AudienceView`, `ModeratorView`, etc.) based on the
 * current `activeRole`.
 */

import React, { useEffect, useState } from 'react';
import { useRealTimeQnA } from './useRealTimeQnA';
import { Header } from './components/Header';
import { AudienceView } from './components/AudienceView';
import { Footer } from './components/Footer';
import { ModeratorView } from './components/ModeratorView';
import { PanelView } from './components/PanelView';
import { StageView } from './components/StageView';
import { GlobalLoader } from './components/GlobalLoader';
import type { AppUser } from './types';
import { supabase } from './supabaseClient';

/**
 * The main application component.
 * It orchestrates the entire UI, fetching data and passing it down to the
 * active view component. Uses Supabase Auth for sign-in, but the `users`
 * table (via GET /api/me) is the source of truth for the account's role.
 * @returns {React.ReactElement} The rendered application.
 */
export default function App() {
  // The signed-in user's application identity/role, resolved via /api/me.
  // null means either logged out, or logged in with no application role.
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const resolveCurrentUser = async (): Promise<AppUser | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    try {
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      console.error('Error resolving current user:', error);
      return null;
    }
  };

  // Effect to resolve the current user's role on mount and when auth changes
  useEffect(() => {
    const checkCurrentUser = async () => {
      setCurrentUser(await resolveCurrentUser());
    };

    checkCurrentUser();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkCurrentUser();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Destructure useRealTimeQnA hooks
  const {
    questions,
    categories,
    conferenceEvent,
    events,
    users,
    isConnected,
    isBusy,
    activeRole,
    setActiveRole,
    sessionId,
    mySubmittedIds,
    submitQuestion,
    updateStatus,
    editQuestion,
    deleteQuestion,
    createCategory,
    fetchEvents,
    createEvent,
    updateEventById,
    activateEvent,
    fetchUsers,
    updateUser,
    resetDemoData
  } = useRealTimeQnA();

  // Counts for different question statuses to show in the header badges.
  const pendingCount = questions.filter(q => q.status === 'pending').length;
  const pushedCount = questions.filter(q => q.status === 'pushed').length;
  const answeringCount = questions.filter(q => q.status === 'answering').length;

  // Access to each view is a per-role allow-list, not a single admin flag --
  // panelist/stage accounts are restricted logins locked to their own view.
  const canViewModerator = currentUser?.role === 'admin' || currentUser?.role === 'moderator';
  const canViewPanel = canViewModerator || currentUser?.role === 'panelist';
  const canViewStage = canViewModerator || currentUser?.role === 'stage';

  // Panel/Stage only ever show questions belonging to the currently live
  // event; the Moderator view still gets the full unfiltered list.
  const liveQuestions = conferenceEvent.id
    ? questions.filter(q => q.eventId === conferenceEvent.id)
    : [];

  const handleLogin = () => {
    setLoginError('');
    setIsLoginOpen(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setActiveRole('audience');
  };

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setLoginError(error?.message || 'Unable to sign in.');
      setIsLoggingIn(false);
      return;
    }

    const user = await resolveCurrentUser();
    if (!user) {
      await supabase.auth.signOut();
      setLoginError('This account does not have application access.');
      setIsLoggingIn(false);
      return;
    }

    setCurrentUser(user);
    if (user.role === 'admin' || user.role === 'moderator') setActiveRole('moderator');
    else if (user.role === 'panelist') setActiveRole('panel');
    else if (user.role === 'stage') setActiveRole('stage');

    setPassword('');
    setIsLoginOpen(false);
    setIsLoggingIn(false);
  };

  return (
    <div className="min-h-screen text-primary font-sans antialiased selection:bg-indigo-500 selection:text-white">
      <GlobalLoader isVisible={isBusy} />

      {/* Top Navbar Header - Shows a Login button if signed out */}
      <Header
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        title={conferenceEvent.title}
        subtitle={conferenceEvent.subtitle}
        isConnected={isConnected}
        onResetDemo={resetDemoData}
        pendingCount={pendingCount}
        pushedCount={pushedCount}
        answeringCount={answeringCount}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {/* Main View Container - Renders the view based on the active role */}
      <main className="transition-all duration-200">
        {activeRole === 'audience' && (
          <AudienceView
            questions={questions}
            categories={categories}
            conferenceEvent={conferenceEvent}
            onSubmit={submitQuestion}
            sessionId={sessionId}
            mySubmittedIds={mySubmittedIds}
          />
        )}

        {/* Moderator view - admin or moderator role required */}
        {canViewModerator && activeRole === 'moderator' && (
          <ModeratorView
            questions={questions}
            categories={categories}
            conferenceEvent={conferenceEvent}
            events={events}
            users={users}
            isAdmin={currentUser?.role === 'admin'}
            onUpdateStatus={updateStatus}
            onEditQuestion={editQuestion}
            onDeleteQuestion={deleteQuestion}
            onCreateCategory={createCategory}
            onFetchEvents={fetchEvents}
            onCreateEvent={createEvent}
            onUpdateEvent={updateEventById}
            onActivateEvent={activateEvent}
            onFetchUsers={fetchUsers}
            onUpdateUser={updateUser}
          />
        )}

        {/* Panel view - admin, moderator, or panelist role required */}
        {canViewPanel && activeRole === 'panel' && (
          <PanelView
            questions={liveQuestions}
            categories={categories}
            conferenceEvent={conferenceEvent}
            onUpdateStatus={updateStatus}
          />
        )}

        {/* Stage view - admin, moderator, or stage role required */}
        {canViewStage && activeRole === 'stage' && (
          <StageView
            questions={liveQuestions}
            categories={categories}
            conferenceEvent={conferenceEvent}
          />
        )}
      </main>
      <Footer />

      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form onSubmit={submitLogin} className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-primary">Sign in</h2>
            <p className="mt-1 text-sm text-secondary">Sign in with the account created for you in Supabase.</p>
            <label className="mt-5 block text-sm font-medium text-secondary">Email
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input-base mt-1 w-full" autoComplete="email" />
            </label>
            <label className="mt-3 block text-sm font-medium text-secondary">Password
              <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input-base mt-1 w-full" autoComplete="current-password" />
            </label>
            {loginError && <p className="mt-3 text-sm text-rose-600">{loginError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsLoginOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-secondary">Cancel</button>
              <button disabled={isLoggingIn} type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{isLoggingIn ? 'Signing in…' : 'Sign in'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
