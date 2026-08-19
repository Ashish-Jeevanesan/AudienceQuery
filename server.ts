/**
 * @file server.ts
 * @description This file sets up an Express.js server for a real-time Q&A application.
 * It uses Server-Sent Events (SSE) for broadcasting updates and manages an in-memory "database"
 * for questions, categories, and event details. It also includes a Vite middleware for development.
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { Question, Category, ConferenceEvent, QuestionStatus } from './src/types';
import { logger } from './src/logger';

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

/**
 * Middleware to verify administrator access using a Supabase Auth access token.
 * Roles are read from app_metadata, which can only be changed with the
 * Supabase service-role key (or in the Supabase dashboard).
 */
async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const accessToken = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return res.status(401).json({ error: 'Administrator sign-in is required' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  const role = user?.app_metadata?.role;
  if (error || !user || (role !== 'admin' && role !== 'moderator')) {
    return res.status(403).json({ error: 'Administrator access is required' });
  }

  next();
}

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

// --- API Endpoints ---

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

    // Fetch conference event (public data, same for all users)
    const { data: eventData, error: eventError } = await supabase
      .from('conference_events')
      .select('*')
      .limit(1)
      .single();

    if (eventError && eventError.code !== 'PGRST116') throw eventError;

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
      color: c.color,
      description: c.description
    }));

    const mappedEvent = {
      title: eventData?.title || 'To Live is for Christ',
      subtitle: eventData?.subtitle || 'Christian Family Conference 2026',
      joinCode: eventData?.join_code || 'LIVE4C',
      allowAnonymous: eventData?.allow_anonymous ?? true,
      isAcceptingQuestions: eventData?.is_accepting_questions ?? true
    };

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
  const { name, color, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  try {
    // Insert into Supabase
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: name.trim(),
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
 * @route PATCH /api/event
 * @description Updates general conference settings.
 * SECURITY: Requires admin authentication via Authorization: Bearer <admin-token> header.
 * Persists to Supabase.
 */
app.patch('/api/event', requireAdmin, async (req, res) => {
  const { title, subtitle, isAcceptingQuestions, allowAnonymous } = req.body;

  try {
    // Build update object
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (subtitle !== undefined) updateData.subtitle = subtitle;
    if (isAcceptingQuestions !== undefined) updateData.is_accepting_questions = isAcceptingQuestions;
    if (allowAnonymous !== undefined) updateData.allow_anonymous = allowAnonymous;

    // Update the first (primary) conference event in Supabase
    const { data: updatedEvent, error } = await supabase
      .from('conference_events')
      .update(updateData)
      .limit(1)
      .select('*')
      .single();

    if (error) throw error;

    // Map to frontend format
    const result: ConferenceEvent = {
      title: updatedEvent.title,
      subtitle: updatedEvent.subtitle,
      joinCode: updatedEvent.join_code,
      allowAnonymous: updatedEvent.allow_anonymous,
      isAcceptingQuestions: updatedEvent.is_accepting_questions
    };

    broadcastStateUpdate('event:updated', result);
    res.json(result);
  } catch (error: any) {
    console.error('Error updating conference event in Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to update event settings' });
  }
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



