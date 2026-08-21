/**
 * @file src/useRealTimeQnA.ts
 * @description This custom hook is the core of the client-side application.
 * It handles all real-time communication with the backend server via Server-Sent Events (SSE),
 * manages the application's state (questions, categories, etc.), and exposes
 * functions to interact with the API (e.g., submitting questions, upvoting).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Question, Category, ConferenceEvent, EventRecord, AppUser, QuestionStatus, ViewRole } from './types';
import { supabase } from './supabaseClient';

/**
 * A custom hook to manage the real-time Q&A state and interactions.
 * Integrates Supabase Auth for role-based access control.
 */
export function useRealTimeQnA() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [conferenceEvent, setConferenceEvent] = useState<ConferenceEvent>({
    id: '',
    title: 'To Live is for Christ',
    subtitle: 'Christian Family Conference 2026',
    joinCode: 'LIVE4C',
    allowAnonymous: true,
    isAcceptingQuestions: true,
    isLive: false
  });
  // Full events list and user directory are admin/moderator-only and hold
  // sensitive data (every event's join code; every user's email) -- fetched
  // lazily only when their management drawers open, never as part of the
  // public /api/state snapshot.
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeRole, setActiveRole] = useState<ViewRole>('audience');
  const [mySubmittedIds, setMySubmittedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('qna_my_submitted_ids') || '[]');
    } catch {
      return [];
    }
  });

  const sessionInitialized = useRef(false);

  // Tracks how many DB-backed actions are currently in flight, so the shared
  // GlobalLoader overlay can stay visible across overlapping actions instead
  // of one finishing early and hiding it for the others.
  const [pendingCount, setPendingCount] = useState(0);

  const runTracked = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setPendingCount(c => c + 1);
    try {
      return await fn();
    } finally {
      setPendingCount(c => Math.max(0, c - 1));
    }
  }, []);

  const adminFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Administrator sign-in is required');

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${session.access_token}`);
    return fetch(input, { ...init, headers });
  }, []);

  // Effect for fetching initial state and setting up the SSE connection.
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const ensureSessionId = async () => {
      if (sessionInitialized.current) {
        return;
      }

      try {
        const res = await fetch('/api/session', { method: 'POST' });
        if (!res.ok) {
          throw new Error('Failed to establish session');
        }
        sessionInitialized.current = true;
        console.log('✓ Session established');
      } catch (err) {
        console.error('Error establishing session:', err);
        throw err;
      }
    };

    const fetchInitialState = async () => {
      try {
        await ensureSessionId();
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          setQuestions(data.questions || []);
          setCategories(data.categories || []);
          if (data.conferenceEvent) setConferenceEvent(data.conferenceEvent);
        }
      } catch (err) {
        console.error('Failed to load initial state:', err);
      }
    };

    fetchInitialState();

    // Establishes and manages the Server-Sent Events connection.
    const connectSSE = () => {
      eventSource = new EventSource('/api/stream');

      eventSource.onopen = () => {
        setIsConnected(true);
        console.log('SSE connection established.');
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          // Handle full state updates
          if (payload.state) {
            setQuestions(payload.state.questions || []);
            setCategories(payload.state.categories || []);
            if (payload.state.conferenceEvent) setConferenceEvent(payload.state.conferenceEvent);
          }

          // Handle individual question updates
          if (payload.type === 'question:created' && payload.data) {
            setQuestions(prev => [payload.data, ...prev]);
          } else if (payload.type === 'question:updated' && payload.data) {
            setQuestions(prev =>
              prev.map(q => q.id === payload.data.id ? payload.data : q)
            );
          } else if (payload.type === 'question:status_changed' && payload.data) {
            setQuestions(prev =>
              prev.map(q => q.id === payload.data.id ? payload.data : q)
            );
          } else if (payload.type === 'category:created' && payload.data) {
            setCategories(prev =>
              prev.some(c => c.id === payload.data.id) ? prev : [...prev, payload.data]
            );
          } else if ((payload.type === 'event:activated' || payload.type === 'event:updated') && payload.data) {
            // The broadcast payload is already the public-safe subset (same
            // shape as `conferenceEvent`) -- never the full admin events list.
            setConferenceEvent(payload.data);
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        setIsConnected(false);
        eventSource?.close();
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const captureDeviceMetadata = useCallback(() => {
    const deviceInfo = {
      deviceType: /mobile|android|iphone|ipod/i.test(navigator.userAgent)
        ? 'mobile'
        : /ipad|tablet/i.test(navigator.userAgent)
        ? 'tablet'
        : 'desktop',
      os: navigator.platform,
      browser: navigator.userAgent.split(' ').pop() || 'unknown',
      screenResolution: `${window.screen.width}x${window.screen.height}`
    };

    const networkInfo = {
      userAgent: navigator.userAgent,
      language: navigator.language
    };

    return { deviceInfo, networkInfo };
  }, []);

  const fetchFullState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
        setCategories(data.categories || []);
        if (data.conferenceEvent) setConferenceEvent(data.conferenceEvent);
      }
    } catch (err) {
      console.error('Failed to refresh state:', err);
    }
  }, []);

  const submitQuestion = useCallback(async (params: {
    text: string;
    authorName: string;
    isAnonymous: boolean;
    categoryId: string;
  }) => {
    return runTracked(async () => {
      try {
        const { deviceInfo, networkInfo } = captureDeviceMetadata();

        if (!sessionInitialized.current) {
          throw new Error('Session not initialized. Please refresh the page.');
        }

        const res = await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...params,
            deviceInfo,
            networkInfo
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to submit question');
        }
        const newQ: Question = await res.json();

        setMySubmittedIds(prev => {
          const updated = [newQ.id, ...prev];
          localStorage.setItem('qna_my_submitted_ids', JSON.stringify(updated));
          return updated;
        });

        // Refresh from the server rather than trusting the SSE broadcast to
        // reach this same client -- on serverless, a broadcast only reaches
        // clients held open by the same warm function instance that handled
        // the write, so the submitter isn't guaranteed to see it that way.
        await fetchFullState();

        return newQ;
      } catch (err: any) {
        alert(err.message || 'Submission failed. Please try again.');
        throw err;
      }
    });
  }, [captureDeviceMetadata, fetchFullState, runTracked]);

  const updateStatus = useCallback(async (questionId: string, status: QuestionStatus, moderatorNotes?: string) => {
    return runTracked(async () => {
      try {
        const res = await adminFetch(`/api/questions/${questionId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, moderatorNotes })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Unable to update question status');
        await fetchFullState();
      } catch (err) {
        console.error('Status update error:', err);
      }
    });
  }, [adminFetch, fetchFullState, runTracked]);

  const editQuestion = useCallback(async (questionId: string, data: {
    text?: string;
    categoryId?: string;
    isPriority?: boolean;
    moderatorNotes?: string;
  }) => {
    return runTracked(async () => {
      try {
        const res = await adminFetch(`/api/questions/${questionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Unable to edit question');
        await fetchFullState();
      } catch (err) {
        console.error('Edit error:', err);
        // Rethrown so the edit modal can stay open and show the error
        // instead of closing as if the save had succeeded.
        throw err;
      }
    });
  }, [adminFetch, fetchFullState, runTracked]);

  const deleteQuestion = useCallback(async (questionId: string) => {
    return runTracked(async () => {
      try {
        const res = await adminFetch(`/api/questions/${questionId}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Unable to delete question');
        await fetchFullState();
      } catch (err) {
        console.error('Delete error:', err);
      }
    });
  }, [adminFetch, fetchFullState, runTracked]);

  const createCategory = useCallback(async (data: { name: string; color: string; description?: string }) => {
    return runTracked(async () => {
      try {
        const res = await adminFetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Unable to create category');
        await fetchFullState();
      } catch (err) {
        console.error('Category create error:', err);
      }
    });
  }, [adminFetch, fetchFullState, runTracked]);

  // Events and users are admin/moderator-only and aren't part of the public
  // /api/state snapshot -- fetched lazily by whichever drawer needs them.
  const fetchEvents = useCallback(async () => {
    return runTracked(async () => {
      try {
        const res = await adminFetch('/api/events');
        if (!res.ok) throw new Error((await res.json()).error || 'Unable to load events');
        setEvents(await res.json());
      } catch (err) {
        console.error('Fetch events error:', err);
      }
    });
  }, [adminFetch, runTracked]);

  const createEvent = useCallback(async (data: { title: string; subtitle?: string; allowAnonymous?: boolean; isAcceptingQuestions?: boolean }) => {
    return runTracked(async () => {
      try {
        const res = await adminFetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Unable to create event');
        await fetchEvents();
      } catch (err) {
        console.error('Create event error:', err);
        throw err;
      }
    });
  }, [adminFetch, fetchEvents, runTracked]);

  const updateEventById = useCallback(async (id: string, data: { title?: string; subtitle?: string; allowAnonymous?: boolean; isAcceptingQuestions?: boolean }) => {
    return runTracked(async () => {
      try {
        const res = await adminFetch(`/api/events/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Unable to update event');
        await Promise.all([fetchEvents(), fetchFullState()]);
      } catch (err) {
        console.error('Update event error:', err);
        throw err;
      }
    });
  }, [adminFetch, fetchEvents, fetchFullState, runTracked]);

  const activateEvent = useCallback(async (id: string) => {
    return runTracked(async () => {
      try {
        const res = await adminFetch(`/api/events/${id}/activate`, { method: 'POST' });
        if (!res.ok) throw new Error((await res.json()).error || 'Unable to activate event');
        await Promise.all([fetchEvents(), fetchFullState()]);
      } catch (err) {
        console.error('Activate event error:', err);
        throw err;
      }
    });
  }, [adminFetch, fetchEvents, fetchFullState, runTracked]);

  const fetchUsers = useCallback(async () => {
    return runTracked(async () => {
      try {
        const res = await adminFetch('/api/users');
        if (!res.ok) throw new Error((await res.json()).error || 'Unable to load users');
        setUsers(await res.json());
      } catch (err) {
        console.error('Fetch users error:', err);
      }
    });
  }, [adminFetch, runTracked]);

  const updateUser = useCallback(async (id: string, data: { role?: string; username?: string }) => {
    return runTracked(async () => {
      try {
        const res = await adminFetch(`/api/users/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Unable to update user');
        await fetchUsers();
      } catch (err) {
        console.error('Update user error:', err);
        throw err;
      }
    });
  }, [adminFetch, fetchUsers, runTracked]);

  const resetDemoData = useCallback(async () => {
    return runTracked(async () => {
      try {
        const res = await adminFetch('/api/reset', { method: 'POST' });
        if (!res.ok) throw new Error((await res.json()).error || 'Unable to reset data');
        await fetchFullState();
      } catch (err) {
        console.error('Reset error:', err);
      }
    });
  }, [adminFetch, fetchFullState, runTracked]);

  return {
    questions,
    categories,
    conferenceEvent,
    events,
    users,
    isConnected,
    isBusy: pendingCount > 0,
    activeRole,
    setActiveRole,
    sessionId: 'managed-by-cookies',
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
  };
}
