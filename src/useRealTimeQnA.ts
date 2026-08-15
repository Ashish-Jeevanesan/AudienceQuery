/**
 * @file src/useRealTimeQnA.ts
 * @description This custom hook is the core of the client-side application.
 * It handles all real-time communication with the backend server via Server-Sent Events (SSE),
 * manages the application's state (questions, categories, etc.), and exposes
 * functions to interact with the API (e.g., submitting questions, upvoting).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Question, Category, ConferenceEvent, QuestionStatus, ViewRole } from './types';

/**
 * Retrieves a persistent session ID from localStorage or generates a new one.
 * This is crucial for tracking user-specific actions like upvotes and submitted questions.
 * @returns {string} The unique session ID.
 */
function getSessionId(): string {
  let id = localStorage.getItem('qna_session_id');
  if (!id) {
    id = `sess-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
    localStorage.setItem('qna_session_id', id);
  }
  return id;
}

/**
 * A custom hook to manage the real-time Q&A state and interactions.
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
      // Retrieve IDs of questions this user has submitted from local storage.
      return JSON.parse(localStorage.getItem('qna_my_submitted_ids') || '[]');
    } catch {
      return [];
    }
  });

  const sessionId = useRef<string>(getSessionId()).current;

  // Effect for fetching initial state and setting up the SSE connection.
  useEffect(() => {
    let eventSource: EventSource | null = null;

    // Fetches the initial state snapshot from the server.
    const fetchInitialState = async () => {
      try {
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
          // The server broadcasts the entire state on every update.
          if (payload.state) {
            setQuestions(payload.state.questions || []);
            setCategories(payload.state.categories || []);
            if (payload.state.conferenceEvent) setConferenceEvent(payload.state.conferenceEvent);
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        setIsConnected(false);
        eventSource?.close();
        // Attempt to reconnect after a short delay.
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    // Cleanup on component unmount.
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  /**
   * Captures device and network metadata for the current session.
   * @returns {object} Device and network information.
   */
  const captureDeviceMetadata = useCallback(() => {
    // Device info from navigator
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

    // Network info from navigator (limited - IP requires backend)
    const networkInfo = {
      userAgent: navigator.userAgent,
      language: navigator.language
    };

    return { deviceInfo, networkInfo };
  }, []);

  /**
   * Submits a new question to the server with device metadata.
   * @param params - The details of the question to submit.
   * @returns {Promise<Question>} The newly created question.
   */
  const submitQuestion = useCallback(async (params: {
    text: string;
    authorName: string;
    isAnonymous: boolean;
    categoryId: string;
  }) => {
    try {
      // Capture device metadata
      const { deviceInfo, networkInfo } = captureDeviceMetadata();

      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          sessionId,
          deviceInfo,
          networkInfo
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit question');
      }
      const newQ: Question = await res.json();

      // Store submitted question ID in local storage to track "My Questions".
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
  }, [sessionId, captureDeviceMetadata]);

  /**
   * Updates the status of a question (for moderators and panelists).
   * @param {string} questionId - The ID of the question to update.
   * @param {QuestionStatus} status - The new status.
   * @param {string} [moderatorNotes] - Optional notes from the moderator.
   */
  const updateStatus = useCallback(async (questionId: string, status: QuestionStatus, moderatorNotes?: string) => {
    try {
      await fetch(`/api/questions/${questionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, moderatorNotes })
      });
    } catch (err) {
      console.error('Status update error:', err);
    }
  }, []);

  /**
   * Edits the details of a question (for moderators).
   * @param {string} questionId - The ID of the question to edit.
   * @param {object} data - The fields to update.
   */
  const editQuestion = useCallback(async (questionId: string, data: {
    text?: string;
    categoryId?: string;
    isPriority?: boolean;
    moderatorNotes?: string;
  }) => {
    try {
      await fetch(`/api/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (err) {
      console.error('Edit error:', err);
    }
  }, []);

  /**
   * Deletes a question from the system (for moderators).
   * @param {string} questionId - The ID of the question to delete.
   */
  const deleteQuestion = useCallback(async (questionId: string) => {
    try {
      await fetch(`/api/questions/${questionId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Delete error:', err);
    }
  }, []);

  /**
   * Creates a new topic category (for moderators).
   * @param {object} data - The details of the new category.
   */
  const createCategory = useCallback(async (data: { name: string; color: string; description?: string }) => {
    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (err) {
      console.error('Category create error:', err);
    }
  }, []);

  /**
   * Updates the main event settings (for moderators).
   * @param {Partial<ConferenceEvent>} data - The event settings to update.
   */
  const updateEvent = useCallback(async (data: Partial<ConferenceEvent>) => {
    try {
      await fetch('/api/event', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (err) {
      console.error('Update event error:', err);
    }
  }, []);

  /**
   * Resets the in-memory data on the server to its initial sample state.
   */
  const resetDemoData = useCallback(async () => {
    try {
      await fetch('/api/reset', { method: 'POST' });
    } catch (err) {
      console.error('Reset error:', err);
    }
  }, []);

  return {
    questions,
    categories,
    conferenceEvent,
    isConnected,
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
  };
}
