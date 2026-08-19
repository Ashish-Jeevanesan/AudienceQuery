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
import type { ViewRole } from './types';
import { supabase } from './supabaseClient';

/**
 * The main application component.
 * It orchestrates the entire UI, fetching data and passing it down to the
 * active view component. Uses Supabase Auth for role-based access control.
 * @returns {React.ReactElement} The rendered application.
 */
export default function App() {
  // State to track moderator auth status from Supabase
  const [isModeratorAuthenticated, setIsModeratorAuthenticated] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Effect to check moderator role on mount and when auth changes
  useEffect(() => {
    const checkModeratorRole = async () => {
      try {
        // Get the current user from Supabase Auth
        const { data: { user} } = await supabase.auth.getUser();

        if (user) {
          const role = user.app_metadata?.role;
          setIsModeratorAuthenticated(role === 'admin' || role === 'moderator');
        } else {
          setIsModeratorAuthenticated(false);
        }
      } catch (error) {
        console.error('Error checking moderator role:', error);
        setIsModeratorAuthenticated(false);
      }
    };

    checkModeratorRole();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      checkModeratorRole();
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
    updateEvent,
    resetDemoData
  } = useRealTimeQnA();

  // Counts for different question statuses to show in the header badges.
  const pendingCount = questions.filter(q => q.status === 'pending').length;
  const pushedCount = questions.filter(q => q.status === 'pushed').length;
  const answeringCount = questions.filter(q => q.status === 'answering').length;

  // Determine if the current user has admin access (moderator role)
  // isAdmin is true if: user is authenticated AND has moderator role in Supabase
  const isAdmin = isModeratorAuthenticated;

  // Restrict role changes: only allow switching to audience role freely.
  // Other roles (moderator, panel, stage) require admin privileges.
  const canSwitchRole = (targetRole: ViewRole) => {
    // Audience role is always accessible
    if (targetRole === 'audience') return true;
    // Other roles require admin access
    return isAdmin;
  };

  const handleModeratorLogin = () => {
    setLoginError('');
    setIsLoginOpen(true);
  };

  const submitModeratorLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setLoginError(error?.message || 'Unable to sign in.');
      setIsLoggingIn(false);
      return;
    }

    const role = data.user.app_metadata?.role;
    if (role !== 'admin' && role !== 'moderator') {
      await supabase.auth.signOut();
      setLoginError('This account does not have administrator access.');
      setIsLoggingIn(false);
      return;
    }

    setIsModeratorAuthenticated(true);
    setActiveRole('moderator');
    setPassword('');
    setIsLoginOpen(false);
    setIsLoggingIn(false);
  };

  return (
    <div className="min-h-screen text-primary font-sans antialiased selection:bg-indigo-500 selection:text-white">
      <GlobalLoader isVisible={isBusy} />

      {/* Top Navbar Header - Shows login prompt if not moderator */}
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
        isAdmin={isAdmin}
        onModeratorLogin={handleModeratorLogin}
        isModeratorAuthenticated={isModeratorAuthenticated}
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

        {/* Moderator view - requires moderator role in Supabase */}
        {isAdmin && activeRole === 'moderator' && (
          <ModeratorView
            questions={questions}
            categories={categories}
            conferenceEvent={conferenceEvent}
            onUpdateStatus={updateStatus}
            onEditQuestion={editQuestion}
            onDeleteQuestion={deleteQuestion}
            onCreateCategory={createCategory}
            onUpdateEvent={updateEvent}
          />
        )}

        {/* Panel view - admin access required */}
        {isAdmin && activeRole === 'panel' && (
          <PanelView
            questions={questions}
            categories={categories}
            onUpdateStatus={updateStatus}
          />
        )}

        {/* Stage view - admin access required */}
        {isAdmin && activeRole === 'stage' && (
          <StageView
            questions={questions}
            categories={categories}
            conferenceEvent={conferenceEvent}
          />
        )}
      </main>
      <Footer />

      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form onSubmit={submitModeratorLogin} className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-primary">Administrator access</h2>
            <p className="mt-1 text-sm text-secondary">Sign in with the administrator account created in Supabase.</p>
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
