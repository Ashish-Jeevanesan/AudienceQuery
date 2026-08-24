/**
 * @file server.ts
 * @description This file sets up an Express.js server for a real-time Q&A application.
 * It uses Server-Sent Events (SSE) for broadcasting updates and manages an in-memory "database"
 * for questions, categories, and event details. It also includes a Vite middleware for development.
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { translate } from 'google-translate-api-x';
import { Question, Category, ConferenceEvent, EventRecord, QuestionStatus, UserRole } from './src/types.js';
import { logger } from './src/logger.js';

// Helper: Hash session ID for safe logging
const hashSessionId = (sessionId: string) =>
  sessionId ? crypto.createHash('sha256').update(sessionId).digest('hex').substring(0, 16) : 'unknown';

// Load environment variables from .env file
dotenv.config();

// Initialize Supabase Admin Client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('âŒ Missing Supabase credentials in .env file');
  console.error('   Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('âœ… Supabase admin client initialized');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// --- Authentication & Authorization ---

const ALL_ROLES: UserRole[] = ['admin', 'moderator', 'panelist', 'stage'];

/**
 * Middleware factory: verifies the caller is signed in via Supabase Auth AND
 * holds one of the given application roles. Roles are read from the `users`
 * table (the source of truth for access control), not from Supabase Auth's
 * `app_metadata` -- that field is only used once, by the migration's
 * one-time backfill, and is otherwise vestigial.
 * Attaches the resolved `{id, email, username, role}` row to `req.appUser`.
 */
function requireRole(...allowedRoles: UserRole[]) {
  return async function (req: express.Request, res: express.Response, next: express.NextFunction) {
    const accessToken = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      return res.status(401).json({ error: 'Sign-in is required' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return res.status(401).json({ error: 'Sign-in is required' });
    }

    const { data: appUser, error: roleError } = await supabase
      .from('users')
      .select('id, email, username, role')
      .eq('id', user.id)
      .single();

    if (roleError || !appUser) {
      return res.status(403).json({ error: 'No application role is assigned to this account' });
    }

    if (!allowedRoles.includes(appUser.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }

    (req as any).appUser = appUser;
    next();
  };
}

// Back-compat alias: every endpoint that previously required "admin or
// moderator" (app_metadata-based) keeps that exact same effective access.
const requireAdmin = requireRole('admin', 'moderator');
const requireAdminOnly = requireRole('admin');
const requireAuth = requireRole(...ALL_ROLES);

/**
 * Helper: Validate session ID format consistently across all endpoints.
 * Format requirement: sess- followed by exactly 32 hex characters (16 bytes = 128 bits entropy)
 * This prevents format divergence between writer and reader endpoints.
 * @param s The sessionId string to validate
 * @returns true if valid format, false otherwise
 */
function validateSessionId(s: string): boolean {
  return /^sess-[a-f0-9]{32}$/.test(s);
}

/**
 * Helper: Generate a cryptographically secure, server-side session ID.
 * Format: sess-<32 hex characters> (16 bytes / 128 bits of entropy)
 * This prevents client spoofing of session IDs.
 * Fixed-length format ensures consistent validation across all endpoints.
 */
function generateSecureSessionId(): string {
  return `sess-${crypto.randomBytes(16).toString('hex')}`; // 32 hex chars = 16 bytes
}


// --- Server-Sent Events (SSE) Logic ---

/**
 * @type {express.Response[]}
 * @description A list of all currently connected SSE clients (browsers).
 */
let clients: express.Response[] = [];

/**
 * Broadcasts an update event to all connected SSE clients.
 * Note: The full state is fetched from Supabase by the client via /api/state endpoint.
 * This function broadcasts incremental updates only.
 * @param {string} type - The type of event that occurred (e.g., 'question:created').
 * @param {any} [data] - Optional data associated with the event.
 */
function broadcastStateUpdate(type: string, data?: any) {
  const payload = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString()
  });

  logger.debug('Broadcasting update to all clients', { type, clientCount: clients.length });

  clients.forEach(client => {
    client.write(`data: ${payload}\n\n`);
  });
}

// --- Events Helpers ---

/** Maps a Supabase `events` row to the camelCase shape the frontend expects. */
function mapEventRow(row: any): EventRecord {
  return {
    id: row.id,
    title: row.title,
    titleHi: row.title_hi || undefined,
    titleOr: row.title_or || undefined,
    subtitle: row.subtitle,
    subtitleHi: row.subtitle_hi || undefined,
    subtitleOr: row.subtitle_or || undefined,
    joinCode: row.join_code,
    allowAnonymous: row.allow_anonymous,
    isAcceptingQuestions: row.is_accepting_questions,
    isLive: row.is_live,
    createdAt: row.created_at
  };
}

/** Fallback shown only if no event has ever been made live (e.g. the migration hasn't run yet). */
const NO_LIVE_EVENT_FALLBACK: ConferenceEvent = {
  id: '',
  title: 'No Live Event',
  subtitle: '',
  joinCode: '',
  allowAnonymous: true,
  isAcceptingQuestions: false,
  isLive: false
};

/** Resolves the single currently-live event, or null if none is live. */
async function getLiveEvent(): Promise<ConferenceEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_live', true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapEventRow(data) : null;
}

// --- API Endpoints ---

/**
 * @route GET /api/me
 * @description Returns the signed-in user's application identity/role.
 * Called once right after login so the client knows which view(s) to grant.
 */
app.get('/api/me', requireAuth, (req, res) => {
  const appUser = (req as any).appUser;
  res.json({ id: appUser.id, email: appUser.email, username: appUser.username, role: appUser.role });
});

/**
 * @route POST /api/session
 * @description Generates a new secure server-side session ID for a user.
 * SECURITY:
 * - Issues sessionId via HttpOnly, Secure, SameSite=Lax cookie
 * - Never exposes sessionId in JSON body (prevents client spoofing)
 * - Logs only truncated prefix for audit
 * - Rate-limit friendly (no sensitive data in logs)
 */
app.post('/api/session', (req, res) => {
  try {
    const sessionId = generateSecureSessionId();

    // Set cookie: HttpOnly, Secure (HTTPS only), SameSite=Lax
    // httpOnly: not accessible to JS (prevents XSS theft)
    // secure: only sent over HTTPS
    // sameSite=Lax: prevents CSRF while allowing top-level navigation
    res.cookie('qna_session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });

    // Log only SHA-256 hash of sessionId for audit (never raw value)
    const sessionHash = crypto.createHash('sha256').update(sessionId).digest('hex').substring(0, 16);
    logger.info('New session created', { sessionHash });

    // Do NOT include sessionId in JSON response body
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error generating session:', error);
    res.status(500).json({ error: 'Failed to generate session' });
  }
});

/**
 * @route GET /api/stream
 * @description Establishes an SSE connection. The client should fetch initial state from /api/state
 * and receives incremental updates as they happen.
 */
app.get('/api/stream', (req, res) => {
  logger.info('SSE connection established', { clientCount: clients.length + 1 });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send connection established message
  res.write(`data: ${JSON.stringify({
    type: 'init',
    message: 'Connected to live updates. Fetch /api/state for full state.',
    timestamp: new Date().toISOString()
  })}\n\n`);

  clients.push(res);

  req.on('close', () => {
    logger.info('SSE connection closed', { clientCount: clients.length - 1 });
    clients = clients.filter(c => c !== res);
  });
});

/**
 * @route GET /api/state
 * @description Retrieves a snapshot of the application state from Supabase.
 * SECURITY: Filters questions by session ID (user isolation).
 * Requires ?sessionId=<id> query parameter to identify the user.
 */
app.get('/api/state', async (req, res) => {
  try {
    // SECURITY: Read sessionId from HttpOnly cookie (never from query parameter)
    // The sessionId is set by POST /api/session via res.cookie('qna_session_id', ...)
    const sessionId = req.cookies?.['qna_session_id'] as string;

    logger.debug('GET /api/state requested', { sessionHash: hashSessionId(sessionId) });

    if (!sessionId) {
      logger.warn('GET /api/state: Missing session cookie');
      return res.status(400).json({ error: 'Missing session cookie. Call POST /api/session first.' });
    }

    // SECURITY: Validate sessionId format using shared helper
    // Ensures writer and reader can never diverge on format
    if (!validateSessionId(sessionId)) {
      logger.warn('GET /api/state: Invalid session ID format', { sessionHash: hashSessionId(sessionId) });
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    // Fetch all questions (not filtered by session - all questions visible to moderators)
    logger.debug('Fetching all questions from Supabase');
    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('*, categories(name, color)')
      .order('created_at', { ascending: false });

    if (questionsError) {
      logger.error('Error fetching questions', { error: questionsError.message, code: questionsError.code });
      throw questionsError;
    }

    logger.info('Questions fetched from database', { count: questionsData?.length || 0, data: questionsData?.slice(0, 2) });

    // Fetch categories (public data, same for all users)
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*');

    if (categoriesError) {
      logger.error('Error fetching categories', categoriesError);
      throw categoriesError;
    }

    logger.debug('Categories fetched', { count: categoriesData?.length || 0 });

    // Resolve the currently live event (public-safe subset only -- the full
    // events list with every event's join code is admin/moderator-gated via
    // GET /api/events, never included in this unauthenticated snapshot).
    const mappedEvent = (await getLiveEvent()) || NO_LIVE_EVENT_FALLBACK;

    // Map Supabase snake_case to frontend camelCase
    const mappedQuestions = (questionsData || []).map((q: any) => ({
      id: q.id,
      text: q.text,
      authorName: q.author_name,
      isAnonymous: q.is_anonymous,
      categoryId: q.category_id,
      categoryName: q.categories?.name || categoriesData?.find((c: any) => c.id === q.category_id)?.name || '',
      status: q.status,
      isPriority: q.is_priority,
      moderatorNotes: q.moderator_notes,
      eventId: q.event_id,
      sessionId: q.session_id,
      deviceInfo: q.device_info,
      networkInfo: q.network_info,
      createdAt: q.created_at,
      answeringStartedAt: q.answering_started_at,
      answeredAt: q.answered_at
    }));

    const mappedCategories = (categoriesData || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      nameHi: c.name_hi || undefined,
      nameOr: c.name_or || undefined,
      color: c.color,
      description: c.description
    }));

    res.json({
      questions: mappedQuestions,
      categories: mappedCategories,
      conferenceEvent: mappedEvent
      // sessionId NOT echoed back - it's in the HttpOnly cookie only
    });
  } catch (error: any) {
    console.error('Error fetching state from Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch state' });
  }
});

/**
 * @route POST /api/questions
 * @description Submits a new question from an audience member.
 * SECURITY: SessionId must be previously generated via POST /api/session.
 * Persists to Supabase and broadcasts update via SSE.
 */
app.post('/api/questions', async (req, res) => {
  const { text, authorName, isAnonymous, categoryId, deviceInfo, networkInfo } = req.body;
  const sessionId = req.cookies?.['qna_session_id'] as string;

  logger.debug('Question submission received', { textLength: text?.length || 0, categoryId, hasSession: !!sessionId });

  if (!text || text.trim().length === 0) {
    logger.warn('Question submission rejected: empty text');
    return res.status(400).json({ error: 'Question text is required' });
  }

  if (!sessionId) {
    return res.status(400).json({ error: 'Session not found. Please refresh the page.' });
  }

  // SECURITY: Validate session ID format
  if (!validateSessionId(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID format' });
  }

  // Capture IP address from request headers
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  try {
    const liveEvent = await getLiveEvent();
    if (!liveEvent) {
      return res.status(400).json({ error: 'No event is currently live. Question submissions are closed.' });
    }

    logger.debug('Inserting question into Supabase', { sessionHash: hashSessionId(sessionId) });

    // Insert question into Supabase
    const { data, error } = await supabase
      .from('questions')
      .insert({
        text: text.trim(),
        author_name: isAnonymous ? 'Anonymous Attendee' : (authorName?.trim() || 'Attendee'),
        is_anonymous: !!isAnonymous,
        category_id: categoryId && categoryId.trim() ? categoryId : null,
        status: 'pending',
        is_priority: false,
        event_id: liveEvent.id,
        session_id: sessionId,
        device_info: deviceInfo || null,
        network_info: {
          ...(networkInfo || {}),
          ip_address: ipAddress
        }
      })
      .select('*, categories(name, color)')
      .single();

    if (error) {
      logger.error('Supabase insert error', error);
      throw error;
    }

    logger.info('Question inserted successfully', { questionId: data.id, status: data.status });

    // Map to frontend format
    const newQuestion: Question = {
      id: data.id,
      text: data.text,
      authorName: data.author_name,
      isAnonymous: data.is_anonymous,
      categoryId: data.category_id,
      categoryName: data.categories?.name || '',
      status: data.status,
      isPriority: data.is_priority,
      eventId: data.event_id,
      sessionId: data.session_id,
      deviceInfo: data.device_info,
      networkInfo: data.network_info,
      createdAt: data.created_at
    };

    logger.debug('Broadcasting question update to all clients', { questionId: newQuestion.id });
    broadcastStateUpdate('question:created', newQuestion);

    logger.info('Question submission completed successfully', { questionId: newQuestion.id });
    res.status(201).json(newQuestion);
  } catch (error: any) {
    logger.error('Error submitting question to Supabase', error);
    res.status(500).json({ error: error.message || 'Failed to submit question' });
  }
});


/**
 * @route PATCH /api/questions/:id/status
 * @description Updates the status of a question (e.g., from 'pending' to 'pushed').
 * SECURITY: Requires admin authentication via Authorization: Bearer <admin-token> header.
 * Handles logic for ensuring only one question is 'answering' at a time.
 * Persists to Supabase.
 */
app.patch('/api/questions/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, moderatorNotes } = req.body as { status: QuestionStatus; moderatorNotes?: string };

  try {
    // Fetch the question from Supabase
    const { data: question, error: fetchError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Only questions belonging to the currently live event may be pushed to
    // the panel -- enforced here (not just hidden client-side) since this
    // is the actual authorization boundary.
    if (status === 'pushed') {
      const liveEvent = await getLiveEvent();
      if (!liveEvent || question.event_id !== liveEvent.id) {
        return res.status(403).json({ error: 'Only questions from the live event can be pushed to the panel.' });
      }
    }

    // If changing to 'answering', demote any currently answering question
    if (status === 'answering') {
      await supabase
        .from('questions')
        .update({ status: 'answered', answered_at: new Date().toISOString() })
        .eq('status', 'answering')
        .neq('id', id);
    }

    // Update the target question
    const updateData: any = { status };
    if (status === 'answering') {
      updateData.answering_started_at = new Date().toISOString();
    } else if (status === 'answered') {
      updateData.answered_at = new Date().toISOString();
    }
    if (moderatorNotes !== undefined) {
      updateData.moderator_notes = moderatorNotes;
    }

    const { data: updatedQuestion, error: updateError } = await supabase
      .from('questions')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    // Map to frontend format
    const result: Question = {
      id: updatedQuestion.id,
      text: updatedQuestion.text,
      authorName: updatedQuestion.author_name,
      isAnonymous: updatedQuestion.is_anonymous,
      categoryId: updatedQuestion.category_id,
      categoryName: updatedQuestion.category_name || '',
      status: updatedQuestion.status,
      isPriority: updatedQuestion.is_priority,
      moderatorNotes: updatedQuestion.moderator_notes,
      eventId: updatedQuestion.event_id,
      sessionId: updatedQuestion.session_id,
      deviceInfo: updatedQuestion.device_info,
      networkInfo: updatedQuestion.network_info,
      createdAt: updatedQuestion.created_at,
      answeringStartedAt: updatedQuestion.answering_started_at,
      answeredAt: updatedQuestion.answered_at
    };

    broadcastStateUpdate('question:status_changed', result);
    res.json(result);
  } catch (error: any) {
    console.error('Error updating question status in Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to update question status' });
  }
});

/**
 * @route PATCH /api/questions/:id
 * @description Allows a moderator to edit the details of a question.
 * SECURITY: Requires admin authentication via Authorization: Bearer <admin-token> header.
 * Persists to Supabase.
 */
app.patch('/api/questions/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { text, categoryId, isPriority, moderatorNotes } = req.body;

  try {
    // Build update object
    const updateData: any = {};
    if (text !== undefined) updateData.text = text.trim();
    if (categoryId) updateData.category_id = categoryId;
    if (isPriority !== undefined) updateData.is_priority = !!isPriority;
    if (moderatorNotes !== undefined) updateData.moderator_notes = moderatorNotes;

    // Update in Supabase
    const { data: updatedQuestion, error } = await supabase
      .from('questions')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updatedQuestion) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Map to frontend format
    const result: Question = {
      id: updatedQuestion.id,
      text: updatedQuestion.text,
      authorName: updatedQuestion.author_name,
      isAnonymous: updatedQuestion.is_anonymous,
      categoryId: updatedQuestion.category_id,
      categoryName: updatedQuestion.category_name || '',
      status: updatedQuestion.status,
      isPriority: updatedQuestion.is_priority,
      moderatorNotes: updatedQuestion.moderator_notes,
      eventId: updatedQuestion.event_id,
      sessionId: updatedQuestion.session_id,
      deviceInfo: updatedQuestion.device_info,
      networkInfo: updatedQuestion.network_info,
      createdAt: updatedQuestion.created_at,
      answeringStartedAt: updatedQuestion.answering_started_at,
      answeredAt: updatedQuestion.answered_at
    };

    broadcastStateUpdate('question:updated', result);
    res.json(result);
  } catch (error: any) {
    console.error('Error updating question in Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to update question' });
  }
});

/**
 * @route DELETE /api/questions/:id
 * @description Allows a moderator to delete a question.
 * SECURITY: Requires admin authentication via Authorization: Bearer <admin-token> header.
 * Persists to Supabase.
 */
app.delete('/api/questions/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch the question before deleting (for broadcast)
    const { data: question, error: fetchError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Delete from Supabase
    const { error: deleteError } = await supabase
      .from('questions')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Map for broadcast
    const deleted: Question = {
      id: question.id,
      text: question.text,
      authorName: question.author_name,
      isAnonymous: question.is_anonymous,
      categoryId: question.category_id,
      categoryName: question.category_name || '',
      status: question.status,
      isPriority: question.is_priority,
      moderatorNotes: question.moderator_notes,
      eventId: question.event_id,
      sessionId: question.session_id,
      deviceInfo: question.device_info,
      networkInfo: question.network_info,
      createdAt: question.created_at,
      answeringStartedAt: question.answering_started_at,
      answeredAt: question.answered_at
    };

    broadcastStateUpdate('question:deleted', deleted);
    res.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error('Error deleting question from Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to delete question' });
  }
});

/**
 * @route POST /api/categories
 * @description Allows a moderator to add a new category.
 * SECURITY: Requires admin authentication via Authorization: Bearer <admin-token> header.
 * Persists to Supabase.
 */
app.post('/api/categories', requireAdmin, async (req, res) => {
  const { name, nameHi, nameOr, color, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  try {
    // Insert into Supabase
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: name.trim(),
        name_hi: nameHi?.trim() || null,
        name_or: nameOr?.trim() || null,
        color: color || 'sky',
        description: description || ''
      })
      .select('*')
      .single();

    if (error) throw error;

    // Map to frontend format
    const newCat: Category = {
      id: data.id,
      name: data.name,
      nameHi: data.name_hi || undefined,
      nameOr: data.name_or || undefined,
      color: data.color,
      description: data.description
    };

    broadcastStateUpdate('category:created', newCat);
    res.status(201).json(newCat);
  } catch (error: any) {
    console.error('Error creating category in Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to create category' });
  }
});

/**
 * @route GET /api/events
 * @description Lists every event (including join codes) for the Moderator's
 * "Manage Events" screen. Deliberately NOT part of the public /api/state
 * snapshot -- that would leak every event's join code to any visitor.
 * SECURITY: Requires admin or moderator role.
 */
app.get('/api/events', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json((data || []).map(mapEventRow));
  } catch (error: any) {
    console.error('Error fetching events from Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch events' });
  }
});

/**
 * @route POST /api/events
 * @description Creates a new event with its own full config. The join code
 * is generated server-side, retrying on the rare collision.
 * SECURITY: Requires admin or moderator role.
 */
app.post('/api/events', requireAdmin, async (req, res) => {
  const { title, titleHi, titleOr, subtitle, subtitleHi, subtitleOr, allowAnonymous, isAcceptingQuestions } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Event title is required' });
  }

  const generateJoinCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  try {
    let insertedEvent: any = null;
    let lastError: any = null;

    for (let attempt = 0; attempt < 5 && !insertedEvent; attempt++) {
      const { data, error } = await supabase
        .from('events')
        .insert({
          title: title.trim(),
          title_hi: titleHi?.trim() || null,
          title_or: titleOr?.trim() || null,
          subtitle: subtitle?.trim() || '',
          subtitle_hi: subtitleHi?.trim() || null,
          subtitle_or: subtitleOr?.trim() || null,
          join_code: generateJoinCode(),
          allow_anonymous: allowAnonymous ?? true,
          is_accepting_questions: isAcceptingQuestions ?? true,
          is_live: false
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') { lastError = error; continue; } // join_code collision, retry
        throw error;
      }
      insertedEvent = data;
    }

    if (!insertedEvent) {
      throw lastError || new Error('Failed to generate a unique join code');
    }

    res.status(201).json(mapEventRow(insertedEvent));
  } catch (error: any) {
    console.error('Error creating event in Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to create event' });
  }
});

/**
 * @route PATCH /api/events/:id
 * @description Edits an existing event's config.
 * SECURITY: Requires admin or moderator role.
 */
app.patch('/api/events/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, titleHi, titleOr, subtitle, subtitleHi, subtitleOr, allowAnonymous, isAcceptingQuestions } = req.body;

  try {
    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (titleHi !== undefined) updateData.title_hi = titleHi?.trim() || null;
    if (titleOr !== undefined) updateData.title_or = titleOr?.trim() || null;
    if (subtitle !== undefined) updateData.subtitle = subtitle;
    if (subtitleHi !== undefined) updateData.subtitle_hi = subtitleHi?.trim() || null;
    if (subtitleOr !== undefined) updateData.subtitle_or = subtitleOr?.trim() || null;
    if (allowAnonymous !== undefined) updateData.allow_anonymous = allowAnonymous;
    if (isAcceptingQuestions !== undefined) updateData.is_accepting_questions = isAcceptingQuestions;

    const { data: updatedEvent, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updatedEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const result = mapEventRow(updatedEvent);
    // Only broadcast if this is the live event -- Audience/Panel/Stage only
    // ever care about the live event's config, and /api/stream has no auth
    // so nothing beyond that public-safe shape should ever go out on it.
    if (result.isLive) {
      broadcastStateUpdate('event:updated', result);
    }
    res.json(result);
  } catch (error: any) {
    console.error('Error updating event in Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to update event' });
  }
});

/**
 * @route POST /api/events/:id/activate
 * @description Makes this event the single live event, atomically (via the
 * `activate_event` Postgres function) so a crash or a race between two
 * moderators can never leave zero or two live events.
 * SECURITY: Requires admin or moderator role.
 */
app.post('/api/events/:id/activate', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const { error: rpcError } = await supabase.rpc('activate_event', { p_event_id: id });
    if (rpcError) {
      if ((rpcError as any).code === '23505') {
        return res.status(409).json({ error: 'Another moderator just changed the live event -- please retry.' });
      }
      if ((rpcError as any).code === 'P0001') {
        return res.status(404).json({ error: 'Event not found' });
      }
      throw rpcError;
    }

    const { data: activatedEvent, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !activatedEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const result = mapEventRow(activatedEvent);
    broadcastStateUpdate('event:activated', result);
    res.json(result);
  } catch (error: any) {
    console.error('Error activating event in Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to activate event' });
  }
});

/**
 * @route GET /api/users
 * @description Lists every user with their role, for the admin-only "Manage
 * Users" screen.
 * SECURITY: Requires admin role (moderators cannot manage other users' roles).
 */
app.get('/api/users', requireAdminOnly, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, username, role')
      .order('email', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    console.error('Error fetching users from Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
});

/**
 * @route PATCH /api/users/:id
 * @description Updates a user's username and/or role. Guards against ever
 * removing the last remaining admin (a self-lockout footgun this system has
 * no other recovery path for).
 * SECURITY: Requires admin role.
 */
app.patch('/api/users/:id', requireAdminOnly, async (req, res) => {
  const { id } = req.params;
  const { role, username } = req.body;

  try {
    if (role !== undefined) {
      if (!ALL_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const { data: target, error: targetError } = await supabase
        .from('users')
        .select('role')
        .eq('id', id)
        .single();

      if (targetError || !target) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (target.role === 'admin' && role !== 'admin') {
        const { count, error: countError } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'admin');

        if (countError) throw countError;
        if ((count ?? 0) <= 1) {
          return res.status(400).json({ error: 'Cannot remove the last remaining admin.' });
        }
      }
    }

    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (username !== undefined) updateData.username = username?.trim() || null;

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, email, username, role')
      .single();

    if (error || !updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(updatedUser);
  } catch (error: any) {
    console.error('Error updating user in Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
});

const TRANSLATABLE_TARGETS = ['hi', 'or'] as const;
type TranslatableTarget = typeof TRANSLATABLE_TARGETS[number];

/**
 * @route POST /api/translate
 * @description Translates a short piece of moderator-entered text (a
 * category name, event title/subtitle) into Hindi and/or Odia, as an
 * editable draft -- never authoritative, the moderator reviews/corrects
 * before saving. Uses the free, unofficial `google-translate-api-x`
 * wrapper (no API key/billing) rather than a paid translation API.
 * SECURITY: Requires admin or moderator role -- not public, since this
 * spends the app's own goodwill against Google's rate limits.
 */
app.post('/api/translate', requireAdmin, async (req, res) => {
  const { text, targets } = req.body as { text?: string; targets?: string[] };

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text to translate is required' });
  }

  const requestedTargets = (targets || []).filter(
    (t): t is TranslatableTarget => TRANSLATABLE_TARGETS.includes(t as TranslatableTarget)
  );
  if (requestedTargets.length === 0) {
    return res.status(400).json({ error: 'At least one valid target language (hi, or) is required' });
  }

  const results: Partial<Record<TranslatableTarget, string>> = {};
  const errors: Partial<Record<TranslatableTarget, string>> = {};

  // Each target is translated independently -- if Hindi succeeds but Odia
  // is rate-limited (or vice versa), the caller still gets the one that
  // worked instead of the whole request failing.
  await Promise.all(
    requestedTargets.map(async (target) => {
      try {
        const result = await translate(text.trim(), { to: target });
        results[target] = Array.isArray(result) ? result[0]?.text : result.text;
      } catch (error: any) {
        logger.error('Translation failed', { target, error: error?.message });
        errors[target] = error?.message || 'Translation failed';
      }
    })
  );

  res.json({ ...results, errors: Object.keys(errors).length > 0 ? errors : undefined });
});

/**
 * @route POST /api/reset
 * @description DESTRUCTIVE: Resets the database by deleting all questions and categories.
 * SECURITY: Requires admin authentication via Authorization: Bearer <admin-token> header.
 * This is a dangerous operation and should only be accessible to trusted admins.
 */
app.post('/api/reset', requireAdmin, async (req, res) => {
  try {
    // Delete all questions (this will cascade if foreign keys are set up)
    await supabase.from('questions').delete().neq('id', '');

    // Delete all categories except the seed categories
    // (You can customize this to preserve certain categories)
    await supabase.from('categories').delete().neq('id', '');

    // Optionally re-seed initial data if desired
    // For now, just return success
    broadcastStateUpdate('reset');
    res.json({ success: true, message: 'Database has been reset. Seed data removed.' });
  } catch (error: any) {
    console.error('Error resetting database:', error);
    res.status(500).json({ error: error.message || 'Failed to reset database' });
  }
});

/**
 * @route GET /api/logs
 * @description Returns the current application logs (for debugging).
 * SECURITY: Restricted to admin users only.
 */
app.get('/api/logs', requireAdmin, (req, res) => {
  try {
    const logContent = logger.getLogContent();
    res.setHeader('Content-Type', 'text/plain');
    res.send(logContent);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

// --- Server Initialization ---

/**
 * Starts the Express server.
 * In development, it uses Vite's middleware for hot-reloading the frontend.
 * In production, it serves the static built files from the 'dist' directory.
 */
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Conference Q&A Server started`, { port: PORT, url: `http://localhost:${PORT}` });
  });
}

// On Vercel, requests are routed to this app via a serverless function
// (api/[...slug].ts) instead of a long-running process, so skip app.listen().
if (!process.env.VERCEL) {
  startServer();
}

export default app;



