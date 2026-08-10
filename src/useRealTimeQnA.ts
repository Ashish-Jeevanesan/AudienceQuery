import { useState, useEffect, useCallback, useRef } from 'react';
import { Question, Category, ConferenceEvent, QuestionStatus, ViewRole } from './types';

// Get or generate persistent session ID for audience client upvotes
function getSessionId(): string {
  let id = localStorage.getItem('qna_session_id');
  if (!id) {
    id = `sess-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
    localStorage.setItem('qna_session_id', id);
  }
  return id;
}

export function useRealTimeQnA() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [conferenceEvent, setConferenceEvent] = useState<ConferenceEvent>({
    title: 'TechFuture Summit 2026',
    subtitle: 'Keynote & Leadership Panel Live Q&A',
    joinCode: 'TF2026',
    allowAnonymous: true,
    allowUpvotes: true,
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

  const sessionId = useRef<string>(getSessionId()).current;

  // Initial state fetch & SSE setup
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const fetchInitial = async () => {
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

    fetchInitial();

    // SSE Connection
    const connectSSE = () => {
      eventSource = new EventSource('/api/stream');

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
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
        // Reconnect after 3 seconds
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

  // Submit Question
  const submitQuestion = useCallback(async (params: {
    text: string;
    authorName: string;
    isAnonymous: boolean;
    categoryId: string;
  }) => {
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, sessionId })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit question');
      }
      const newQ: Question = await res.json();
      
      // Store in local submitted list
      setMySubmittedIds(prev => {
        const updated = [newQ.id, ...prev];
        localStorage.setItem('qna_my_submitted_ids', JSON.stringify(updated));
        return updated;
      });

      return newQ;
    } catch (err: any) {
      alert(err.message || 'Submission failed');
      throw err;
    }
  }, [sessionId]);

  // Upvote Question
  const upvoteQuestion = useCallback(async (questionId: string) => {
    try {
      const res = await fetch(`/api/questions/${questionId}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      if (!res.ok) throw new Error('Upvote failed');
    } catch (err) {
      console.error('Upvote error:', err);
    }
  }, [sessionId]);

  // Update Status (Approved, Pushed, Answering, Answered, Rejected)
  const updateStatus = useCallback(async (questionId: string, status: QuestionStatus, moderatorNotes?: string) => {
    try {
      const res = await fetch(`/api/questions/${questionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, moderatorNotes })
      });
      if (!res.ok) throw new Error('Status update failed');
    } catch (err) {
      console.error('Status update error:', err);
    }
  }, []);

  // Edit Question Details
  const editQuestion = useCallback(async (questionId: string, data: {
    text?: string;
    categoryId?: string;
    isPriority?: boolean;
    moderatorNotes?: string;
  }) => {
    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Update question failed');
    } catch (err) {
      console.error('Edit error:', err);
    }
  }, []);

  // Delete Question
  const deleteQuestion = useCallback(async (questionId: string) => {
    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Delete failed');
    } catch (err) {
      console.error('Delete error:', err);
    }
  }, []);

  // Create Category
  const createCategory = useCallback(async (data: { name: string; color: string; description?: string }) => {
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Category creation failed');
    } catch (err) {
      console.error('Category create error:', err);
    }
  }, []);

  // Update Event
  const updateEvent = useCallback(async (data: Partial<ConferenceEvent>) => {
    try {
      const res = await fetch('/api/event', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Event update failed');
    } catch (err) {
      console.error('Update event error:', err);
    }
  }, []);

  // Reset Demo Data
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
    upvoteQuestion,
    updateStatus,
    editQuestion,
    deleteQuestion,
    createCategory,
    updateEvent,
    resetDemoData
  };
}
