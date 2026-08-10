/**
 * @file src/App.tsx
 * @description The root component of the application. It acts as a controller,
 * fetching all real-time data via the `useRealTimeQnA` hook and routing to the
 * appropriate view (`AudienceView`, `ModeratorView`, etc.) based on the
 * current `activeRole`.
 */

import React from 'react';
import { useRealTimeQnA } from './useRealTimeQnA';
import { Header } from './components/Header';
import { AudienceView } from './components/AudienceView';
import { ModeratorView } from './components/ModeratorView';
import { PanelView } from './components/PanelView';
import { StageView } from './components/StageView';

/**
 * The main application component.
 * It orchestrates the entire UI, fetching data and passing it down to the
 * active view component.
 * @returns {React.ReactElement} The rendered application.
 */
export default function App() {
  const {
    questions,
    categories,
    conferenceEvent,
    isConnected,
    activeRole,
    setActiveRole,
    sessionId,
    mySubmittedIds,
    submitQuestion,
    upvoteQuestion,
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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar Header */}
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
      />

      {/* Main View Container - Renders the view based on the active role */}
      <main className="transition-all duration-200">
        {activeRole === 'audience' && (
          <AudienceView
            questions={questions}
            categories={categories}
            conferenceEvent={conferenceEvent}
            onSubmit={submitQuestion}
            onUpvote={upvoteQuestion}
            sessionId={sessionId}
            mySubmittedIds={mySubmittedIds}
          />
        )}

        {activeRole === 'moderator' && (
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

        {activeRole === 'panel' && (
          <PanelView
            questions={questions}
            categories={categories}
            onUpdateStatus={updateStatus}
          />
        )}

        {activeRole === 'stage' && (
          <StageView
            questions={questions}
            categories={categories}
            conferenceEvent={conferenceEvent}
          />
        )}
      </main>
    </div>
  );
}
