/**
 * @file src/useRealTimeQnA.ts
 * @description This custom hook is the core of the client-side application.
 * It handles all real-time communication with the backend server via Server-Sent Events (SSE),
 * manages the application's state (questions, categories, etc.), and exposes
 * functions to interact with the API (e.g., submitting questions, upvoting).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Question, Category, ConferenceEvent, EventRecord, OpenEventSummary, AppUser, QuestionStatus, ViewRole } from './types';
import { supabase } from './supabaseClient';
import { compressImage } from './imageCompress';

const NO_EVENT_SELECTED: ConferenceEvent = {
  id: '',
  title: '',
  subtitle: '',
  joinCode: '',
  allowAnonymous: true,
  isAcceptingQuestions: false,
  isExpired: false
};

/**
 * A custom hook to manage the real-time Q&A state and interactions.
 * Integrates Supabase Auth for role-based access control.
 *
 * @param joinCode Multi-Event Mode: the join code of the event this view is
 * currently showing (from the `/e/:joinCode` route), or undefined when
 * nothing's selected yet (e.g. a bare `/` visit, or the Moderator view,
 * which shows an overview across every event regardless of the URL).
 */
export function useRealTimeQnA(joinCode?: string) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [conferenceEvent, setConferenceEvent] = useState<ConferenceEvent>(NO_EVENT_SELECTED);
  // Every event currently accepting questions, in the public-safe summary
  // shape -- powers the "pick an event" dropdown. Fetched unauthenticated,
  // unlike `events` below.
  const [openEvents, setOpenEvents] = useState<OpenEventSummary[]>([]);
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

  // Refs so the mount-once SSE handler below can always read the *current*
  // joinCode/conferenceEvent without needing to reconnect SSE every time
  // either changes (the closure would otherwise capture stale values from
  // whatever they were at mount).
  const joinCodeRef = useRef(joinCode);
  useEffect(() => { joinCodeRef.current = joinCode; }, [joinCode]);
  const conferenceEventIdRef = useRef(conferenceEvent.id);
  useEffect(() => { conferenceEventIdRef.current = conferenceEvent.id; }, [conferenceEvent.id]);

  // The public "pick an event" dropdown list -- every event currently
  // accepting questions. Refreshed on mount and whenever any event's config
  // changes (its accepting-questions flag may have just flipped).
  const fetchOpenEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events/open');
      if (res.ok) setOpenEvents(await res.json());
    } catch (err) {
      console.error('Failed to load open events:', err);
    }
  }, []);

  // Multi-Event Mode: /api/state now resolves `conferenceEvent` from a join
  // code instead of "the live event" (there is no such singular thing
  // anymore). Omitting the code (e.g. Moderator's own fetch) resolves to
  // the "nothing selected" shape -- Moderator doesn't use this field.
  const fetchState = useCallback(async (code?: string) => {
    try {
      const url = code ? `/api/state?event=${encodeURIComponent(code)}` : '/api/state';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
        setCategories(data.categories || []);
        setConferenceEvent(data.conferenceEvent || NO_EVENT_SELECTED);
      }
    } catch (err) {
      console.error('Failed to load state:', err);
    }
  }, []);

  // Mount-once: establish the session, load the initial state and the
  // open-events list, and connect SSE. Re-fetching when the selected event
  // *changes* is handled by the separate joinCode effect further down --
  // SSE itself doesn't need to reconnect for that, since /api/stream is
  // unauthenticated and broadcasts to every client regardless of which
  // event they're viewing; this hook just filters what it applies.
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

    (async () => {
      await ensureSessionId();
      await fetchState(joinCodeRef.current);
    })();

    fetchOpenEvents();

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

          // Handle individual question updates -- deliberately NOT filtered
          // by event here: Moderator wants realtime updates across every
          // event's questions for its "all events" overview, and Panel/
          // Stage/Audience already filter `questions` down to their own
          // event client-side (via conferenceEvent.id), same as before.
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
          } else if (payload.type === 'event:updated' && payload.data) {
            // Only apply to `conferenceEvent` if it's an update to the
            // event *this view* is currently showing -- otherwise it's a
            // different event's config change and irrelevant here. The
            // open-events dropdown refreshes either way, since
            // accepting-questions may have just flipped for any event.
            if (payload.data.id === conferenceEventIdRef.current) {
              setConferenceEvent(payload.data);
            }
            fetchOpenEvents();
          } else if (payload.type === 'event:deleted' && payload.data) {
            if (payload.data.id === conferenceEventIdRef.current) {
              setConferenceEvent(NO_EVENT_SELECTED);
            }
            fetchOpenEvents();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch state whenever the selected event changes -- e.g. navigating
  // to a different /e/:joinCode, or picking a different event in the
  // dropdown. Skips the very first run since the mount effect above
  // already fetched using whatever joinCode was present at mount.
  const isFirstJoinCodeRun = useRef(true);
  useEffect(() => {
    if (isFirstJoinCodeRun.current) {
      isFirstJoinCodeRun.current = false;
      return;
    }
    fetchState(joinCode);
  }, [joinCode, fetchState]);

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

  // Thin wrapper kept so every existing call site (submitQuestion,
  // updateStatus, editQuestion, ...) doesn't need to know the current
  // joinCode itself -- it's already tracked in the ref above.
  const fetchFullState = useCallback(() => fetchState(joinCodeRef.current), [fetchState]);

  const submitQuestion = useCallback(async (params: {
    text: string;
    authorName: string;
    isAnonymous: boolean;
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
            eventJoinCode: joinCodeRef.current,
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

  const createCategory = useCallback(async (data: { name: string; nameHi?: string; nameOr?: string; color: string; description?: string }) => {
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

  const createEvent = useCallback(async (data: { title: string; titleHi?: string; titleOr?: string; subtitle?: string; subtitleHi?: string; subtitleOr?: string; allowAnonymous?: boolean; isAcceptingQuestions?: boolean; expiresAt?: string | null }) => {
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

  const updateEventById = useCallback(async (id: string, data: { title?: string; titleHi?: string; titleOr?: string; subtitle?: string; subtitleHi?: string; subtitleOr?: string; allowAnonymous?: boolean; isAcceptingQuestions?: boolean; expiresAt?: string | null }) => {
    return runTracked(async () => {
      try {
        const res = await adminFetch(`/api/events/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Unable to update event');
        // Also refresh the public open-events dropdown locally -- the same
        // "don't trust SSE to reach this same client" reasoning as
        // submitQuestion above, and accepting-questions may have just
        // flipped for the event this update touched.
        await Promise.all([fetchEvents(), fetchFullState(), fetchOpenEvents()]);
      } catch (err) {
        console.error('Update event error:', err);
        throw err;
      }
    });
  }, [adminFetch, fetchEvents, fetchFullState, fetchOpenEvents, runTracked]);

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

  // Fetches a Hindi/Odia draft translation of moderator-entered text (a
  // category name, event title/subtitle) -- always an editable suggestion,
  // never authoritative. Returns whichever targets succeeded; a target
  // that failed (rate-limited, network) is simply absent from the result.
  const translateText = useCallback(async (text: string, targets: ('hi' | 'or')[]): Promise<Partial<Record<'hi' | 'or', string>>> => {
    return runTracked(async () => {
      try {
        const res = await adminFetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, targets })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Unable to translate');
        const data = await res.json();
        const { errors, ...translations } = data;
        return translations;
      } catch (err) {
        console.error('Translate error:', err);
        throw err;
      }
    });
  }, [adminFetch, runTracked]);

  const uploadEventMedia = useCallback(async (eventId: string, kind: 'logo' | 'banner', file: File, slot?: 1 | 2 | 3): Promise<void> => {
    return runTracked(async () => {
      try {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          throw new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
        }

        const sizeLimitMB = kind === 'banner' ? 5 : 2;
        if (file.size > sizeLimitMB * 1024 * 1024) {
          throw new Error(`File size exceeds the ${sizeLimitMB}MB limit.`);
        }

        const compressedBlob = await compressImage(file, {
          maxSizeMB: sizeLimitMB,
          maxDimensions: 1920,
          targetSizeKB: 400
        });

        const res = await adminFetch(`/api/events/${eventId}/media/signed-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, slot })
        });
        if (!res.ok) {
          throw new Error((await res.json()).error || 'Failed to get signed upload URL');
        }
        const { path, token } = await res.json();

        const { error: uploadError } = await supabase.storage
          .from('event-media')
          .uploadToSignedUrl(path, token, compressedBlob, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;

        const confirmRes = await adminFetch(`/api/events/${eventId}/media/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, slot, path })
        });
        if (!confirmRes.ok) {
          throw new Error((await confirmRes.json()).error || 'Failed to confirm media upload');
        }

        await Promise.all([fetchEvents(), fetchFullState(), fetchOpenEvents()]);
      } catch (err) {
        console.error('Upload event media error:', err);
        throw err;
      }
    });
  }, [adminFetch, fetchEvents, fetchFullState, fetchOpenEvents, runTracked]);

  const deleteEventMedia = useCallback(async (eventId: string, kind: 'logo' | 'banner', slot?: 1 | 2 | 3): Promise<void> => {
    return runTracked(async () => {
      try {
        const res = await adminFetch(`/api/events/${eventId}/media`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, slot })
        });
        if (!res.ok) {
          throw new Error((await res.json()).error || 'Unable to delete media');
        }
        await Promise.all([fetchEvents(), fetchFullState(), fetchOpenEvents()]);
      } catch (err) {
        console.error('Delete event media error:', err);
        throw err;
      }
    });
  }, [adminFetch, fetchEvents, fetchFullState, fetchOpenEvents, runTracked]);

  const deleteEvent = useCallback(async (eventId: string): Promise<void> => {
    return runTracked(async () => {
      try {
        const res = await adminFetch(`/api/events/${eventId}`, {
          method: 'DELETE'
        });
        if (!res.ok) {
          throw new Error((await res.json()).error || 'Unable to delete event');
        }
        await fetchEvents();
      } catch (err) {
        console.error('Delete event error:', err);
        throw err;
      }
    });
  }, [adminFetch, fetchEvents, runTracked]);

  return {
    questions,
    categories,
    conferenceEvent,
    openEvents,
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
    fetchUsers,
    updateUser,
    translateText,
    resetDemoData,
    uploadEventMedia,
    deleteEventMedia,
    deleteEvent
  };
}
