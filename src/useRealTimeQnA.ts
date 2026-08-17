/**
 * @file src/useRealTimeQnA.ts
 * @description This custom hook is the core of the client-side application.
 * It handles all real-time communication with the backend server via Server-Sent Events (SSE),
 * manages the application's state (questions, categories, etc.), and exposes
 * functions to interact with the API (e.g., submitting questions, upvoting).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Question, Category, ConferenceEvent, QuestionStatus, ViewRole } from './types';
import { supabase } from './supabaseClient';

/**
 * A custom hook to manage the real-time Q&A state and interactions.
 * Integrates Supabase Auth for role-based access control.
 */
export function useRealTimeQnA() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [conferenceEvent, setConferenceEvent] = useState<ConferenceEvent>({
    title: 'To Live is for Christ',
    subtitle: 'Christian Family Conference 2026',
    joinCode: 'LIVE4C',
    allowAnonymous: true,
    isAcceptingQuestions: true
  });
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

      return newQ;
    } catch (err: any) {
      alert(err.message || 'Submission failed. Please try again.');
      throw err;
    }
  }, [captureDeviceMetadata]);

  const updateStatus = useCallback(async (questionId: string, status: QuestionStatus, moderatorNotes?: string) => {
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
  }, [adminFetch, fetchFullState]);

  const editQuestion = useCallback(async (questionId: string, data: {
    text?: string;
    categoryId?: string;
    isPriority?: boolean;
    moderatorNotes?: string;
  }) => {
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
    }
  }, [adminFetch, fetchFullState]);

  const deleteQuestion = useCallback(async (questionId: string) => {
    try {
      const res = await adminFetch(`/api/questions/${questionId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to delete question');
      await fetchFullState();
    } catch (err) {
      console.error('Delete error:', err);
    }
  }, [adminFetch, fetchFullState]);

  const createCategory = useCallback(async (data: { name: string; color: string; description?: string }) => {
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
  }, [adminFetch, fetchFullState]);

  const updateEvent = useCallback(async (data: Partial<ConferenceEvent>) => {
    try {
      const res = await adminFetch('/api/event', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to update event');
    } catch (err) {
      console.error('Update event error:', err);
    }
  }, [adminFetch]);

  const resetDemoData = useCallback(async () => {
    try {
      const res = await adminFetch('/api/reset', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Unable to reset data');
    } catch (err) {
      console.error('Reset error:', err);
    }
  }, [adminFetch]);

  return {
    questions,
    categories,
    conferenceEvent,
    isConnected,
    activeRole,
    setActiveRole,
    sessionId: 'managed-by-cookies',
    mySubmittedIds,
    submitQuestion,
    updateStatus,
    editQuestion,
    deleteQuestion,
    createCategory,
    updateEvent,
    resetDemoData
  };
}
