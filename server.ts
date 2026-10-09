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
import { Question, Category, ConferenceEvent, EventRecord, QuestionStatus, UserRole, AppUser, Complaint, COMPLAINT_CATEGORIES } from './src/types.js';
import { logger } from './src/logger.js';
import { classifyQuestion } from './src/classify.js';



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

const ALL_ROLES: UserRole[] = ['admin', 'moderator', 'panelist', 'stage', 'management'];

/**
 * Middleware factory: verifies the caller is signed in via Supabase Auth AND
 * holds AT LEAST ONE of the given application roles. A user can hold any
 * combination of roles (many-to-many via `user_role_assignments`), so access
 * is granted on overlap, not equality against a single value. Roles are read
 * from `users`/`user_role_assignments` (the source of truth for access
 * control), not from Supabase Auth's `app_metadata` -- that field is only
 * used once, by the signup trigger's initial role grant, and is otherwise
 * vestigial.
 * Attaches the resolved `{id, email, username, roles}` row to `req.appUser`.
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

    const { data: appUserRow, error: userError } = await supabase
      .from('users')
      .select('id, email, username, user_role_assignments(role)')
      .eq('id', user.id)
      .single();

    if (userError || !appUserRow) {
      return res.status(403).json({ error: 'No application role is assigned to this account' });
    }

    const roles = ((appUserRow as any).user_role_assignments || []).map((r: any) => r.role) as UserRole[];

    if (roles.length === 0 || !roles.some(r => allowedRoles.includes(r))) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }

    (req as any).appUser = { id: appUserRow.id, email: appUserRow.email, username: appUserRow.username, roles };
    next();
  };
}

// Back-compat alias: every endpoint that previously required "admin or
// moderator" (app_metadata-based) keeps that exact same effective access.
const requireAdmin = requireRole('admin', 'moderator');
const requireAdminOnly = requireRole('admin');
const requireAuth = requireRole(...ALL_ROLES);
// The /dashboard complaints manager: admin always has access (per the
// user's explicit request), plus the new `management` role, which grants
// no access to Moderator/Panel/Stage.
const requireDashboard = requireRole('admin', 'management');

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

/** True once an event's optional `expires_at` has passed. No expiry set (null) never expires. */
function computeIsExpired(expiresAt: string | null | undefined): boolean {
  return !!expiresAt && new Date(expiresAt).getTime() <= Date.now();
}

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
    expiresAt: row.expires_at || undefined,
    isExpired: computeIsExpired(row.expires_at),
    logoUrl: row.logo_url || undefined,
    bannerUrls: row.banner_urls?.length ? row.banner_urls : undefined,
    createdAt: row.created_at
  };
}

/** Shape returned when no event was requested or the code didn't match anything. */
const NO_EVENT_SELECTED_FALLBACK: ConferenceEvent = {
  id: '',
  title: '',
  subtitle: '',
  joinCode: '',
  allowAnonymous: true,
  isAcceptingQuestions: false,
  isExpired: false
};

/**
 * Resolves a single event by its join code (case-insensitive -- codes are
 * generated uppercase, but typed/scanned input shouldn't have to match
 * case). Multi-Event Mode: there's no more "the live event" -- every event
 * is independently reachable by its own code, and independently open or
 * closed via its own `is_accepting_questions`.
 */
async function getEventByJoinCode(joinCode: string | undefined | null): Promise<ConferenceEvent | null> {
  if (!joinCode || !joinCode.trim()) return null;
  const { data, error } = await supabase
    .from('events').select('*').eq('is_deleted', false)
    .ilike('join_code', joinCode.trim())
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
  res.json({ id: appUser.id, email: appUser.email, username: appUser.username, roles: appUser.roles });
});

/**
 * @route GET /api/rules/prod-release
 * @description Public flag the frontend router checks to decide where bare
 * `/` (and any unrecognized path) goes: the existing Ask-a-Question flow at
 * /ask while this is 'N' (the default -- what every already-shared link/QR
 * code expects), or the new chooser screen at /root once flipped to 'Y'
 * directly in Supabase. /root stays reachable by direct link regardless.
 */
app.get('/api/rules/prod-release', async (req, res) => {
  try {
    const { data, error } = await supabase.from('rules').select('value').eq('key', 'prod_release').maybeSingle();
    if (error) throw error;
    res.json({ prodRelease: data?.value === 'Y' });
  } catch (error: any) {
    logger.error('Error fetching prod_release rule', error);
    // Fail safe to the pre-rollout behavior rather than surfacing an error
    // on the very first page load.
    res.json({ prodRelease: false });
  }
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

    // Resolve the event this request is actually for, by join code
    // (Multi-Event Mode: there's no more "the live event" -- ?event=<code>
    // says which one). Public-safe subset only -- the full events list with
    // every event's join code is admin/moderator-gated via GET /api/events,
    // never included in this unauthenticated snapshot. Missing/unknown code
    // (e.g. Moderator's own fetch, which doesn't pass one) resolves to the
    // "nothing selected" fallback -- Moderator doesn't use this field, it
    // gets every event via its own admin-gated fetch instead.
    const mappedEvent = (await getEventByJoinCode(req.query.event as string)) || NO_EVENT_SELECTED_FALLBACK;

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
 * @route GET /api/events/open
 * @description Public, unauthenticated list of events currently accepting
 * questions -- powers the "pick an event" dropdown shown at a bare `/`
 * visit (Multi-Event Mode). Deliberately a much narrower shape than
 * GET /api/events (admin-only): only what's needed to display and select
 * an event, and only events that are actually open right now.
 */
app.get('/api/events/open', async (req, res) => {
  try {
    // Expired events (expires_at in the past) are excluded here even if
    // still marked is_accepting_questions -- expiry is a hard cutoff for
    // audience-facing visibility, independent of the manual toggle.
    const { data, error } = await supabase
      .from('events')
      .select('id, title, title_hi, title_or, subtitle, subtitle_hi, subtitle_or, join_code')
      .eq('is_accepting_questions', true)
      .eq('is_deleted', false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json((data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      titleHi: row.title_hi || undefined,
      titleOr: row.title_or || undefined,
      subtitle: row.subtitle,
      subtitleHi: row.subtitle_hi || undefined,
      subtitleOr: row.subtitle_or || undefined,
      joinCode: row.join_code
    })));
  } catch (error: any) {
    console.error('Error fetching open events from Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch open events' });
  }
});

/**
 * @route POST /api/questions
 * @description Submits a new question from an audience member.
 * SECURITY: SessionId must be previously generated via POST /api/session.
 * Persists to Supabase and broadcasts update via SSE.
 */
app.post('/api/questions', async (req, res) => {
  const { text, authorName, isAnonymous, eventJoinCode, deviceInfo, networkInfo } = req.body;
  const sessionId = req.cookies?.['qna_session_id'] as string;

  logger.debug('Question submission received', { textLength: text?.length || 0, hasSession: !!sessionId });

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
    // Multi-Event Mode: the client says which event it's submitting to (by
    // join code) -- there's no more implicit "the live event" to fall back
    // to. That event's own is_accepting_questions is the only gate.
    const targetEvent = await getEventByJoinCode(eventJoinCode);
    if (!targetEvent) {
      return res.status(400).json({ error: 'Unknown or missing event. Please select an event and try again.' });
    }
    if (targetEvent.isExpired) {
      return res.status(400).json({ error: 'This event has ended and is no longer accepting questions.' });
    }
    if (!targetEvent.isAcceptingQuestions) {
      return res.status(400).json({ error: 'This event is not accepting questions right now.' });
    }

    const allCategories = await supabase.from('categories').select('*');
    const classifiedCategoryId = await classifyQuestion(text, allCategories.data || []);

    logger.debug('Inserting question into Supabase', { sessionHash: hashSessionId(sessionId), eventId: targetEvent.id });

    // Insert question into Supabase
    const { data, error } = await supabase
      .from('questions')
      .insert({
        text: text.trim(),
        author_name: isAnonymous ? 'Anonymous Attendee' : (authorName?.trim() || 'Attendee'),
        is_anonymous: !!isAnonymous,
        category_id: classifiedCategoryId,
        status: 'pending',
        is_priority: false,
        event_id: targetEvent.id,
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

// --- Complaints Portal (public, global, not event-scoped) ---

/** Short reference code (e.g. CMP-9F3A2B1C) returned to an anonymous submitter so they have something to reference later -- no account, no login. */
function generateTicketNumber(): string {
  return `CMP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/**
 * Keeps only digits and a single leading '+', so the stored value is ready
 * to dial or message (e.g. a future WhatsApp status-update integration)
 * without further cleanup. Returns null if the digit count isn't a
 * plausible phone number (E.164 allows up to 15 digits).
 */
function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return hasPlus ? `+${digits}` : digits;
}

/**
 * @route POST /api/complaints
 * @description Public, unauthenticated complaint submission -- no
 * sessionId and no event required (a single global complaint box, unlike
 * questions). Returns a ticket_number for the submitter to reference later;
 * there is no "my complaints" view yet, so this is the only handle they get
 * until the separate management dashboard (phase 2) exists.
 */
app.post('/api/complaints', async (req, res) => {
  const { name, phone, complaintText } = req.body as { name?: string; phone?: string; complaintText?: string };

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (name.trim().length > 200) {
    return res.status(400).json({ error: 'Name is too long' });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Please enter a valid phone number' });
  }
  if (!complaintText || !complaintText.trim()) {
    return res.status(400).json({ error: 'Complaint details are required' });
  }
  if (complaintText.trim().length > 2000) {
    return res.status(400).json({ error: 'Complaint is too long (max 2000 characters)' });
  }

  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const ticketNumber = generateTicketNumber();

  try {
    const { data, error } = await supabase
      .from('complaints')
      .insert({
        ticket_number: ticketNumber,
        name: name.trim(),
        phone: normalizedPhone,
        complaint_text: complaintText.trim(),
        network_info: { ipAddress, userAgent: req.headers['user-agent'] || 'unknown' }
      })
      .select('id, ticket_number, created_at')
      .single();

    if (error) {
      logger.error('Supabase complaint insert error', error);
      throw error;
    }

    logger.info('Complaint submitted', { complaintId: data.id, ticketNumber: data.ticket_number });
    res.status(201).json({ id: data.id, ticketNumber: data.ticket_number, createdAt: data.created_at });
  } catch (error: any) {
    logger.error('Error submitting complaint', error);
    res.status(500).json({ error: error.message || 'Failed to submit complaint' });
  }
});

/** Maps a Supabase `complaints` row to the camelCase shape the /dashboard frontend expects. */
function mapComplaintRow(row: any): Complaint {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    name: row.name,
    phone: row.phone,
    complaintText: row.complaint_text,
    status: row.status,
    category: row.category || undefined,
    assignedTo: row.assigned_to || undefined,
    resolutionPhotoUrl: row.resolution_photo_url || undefined,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at || undefined,
    assignedAt: row.assigned_at || undefined,
    resolvedAt: row.resolved_at || undefined
  };
}

/**
 * @route GET /api/complaints/lookup
 * @description Public, unauthenticated status check for the anonymous
 * submitter -- requires BOTH the ticket number and the phone number used at
 * submission, so a guessed/leaked ticket number alone can't reveal another
 * person's complaint. Returns a narrower shape than the dashboard's
 * `Complaint` (no internal notes, no raw name).
 */
app.get('/api/complaints/lookup', async (req, res) => {
  const ticket = ((req.query.ticket as string) || '').trim().toUpperCase();
  const normalizedPhone = normalizePhone((req.query.phone as string) || '');

  if (!ticket || !normalizedPhone) {
    return res.status(400).json({ error: 'Reference number and phone number are required' });
  }

  try {
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('ticket_number', ticket)
      .eq('phone', normalizedPhone)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'No complaint found for that reference number and phone number.' });
    }

    const mapped = mapComplaintRow(data);
    res.json({
      ticketNumber: mapped.ticketNumber,
      status: mapped.status,
      category: mapped.category,
      assignedTo: mapped.assignedTo,
      resolutionPhotoUrl: mapped.resolutionPhotoUrl,
      createdAt: mapped.createdAt,
      acknowledgedAt: mapped.acknowledgedAt,
      assignedAt: mapped.assignedAt,
      resolvedAt: mapped.resolvedAt
    });
  } catch (error: any) {
    logger.error('Error looking up complaint', error);
    res.status(500).json({ error: error.message || 'Failed to look up complaint' });
  }
});

/**
 * @route GET /api/complaints
 * @description Lists every non-deleted complaint for the /dashboard
 * management view. SECURITY: admin or management role required.
 */
app.get('/api/complaints', requireDashboard, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json((data || []).map(mapComplaintRow));
  } catch (error: any) {
    logger.error('Error fetching complaints', error);
    res.status(500).json({ error: error.message || 'Failed to fetch complaints' });
  }
});

/**
 * @route PATCH /api/complaints/:id/acknowledge
 * @description Workflow step 1: categorize the complaint. SECURITY: admin
 * or management role required.
 */
app.patch('/api/complaints/:id/acknowledge', requireDashboard, async (req, res) => {
  const { id } = req.params;
  const { category } = req.body as { category?: string };
  const validCategories = COMPLAINT_CATEGORIES.map(c => c.value);

  if (!category || !validCategories.includes(category as any)) {
    return res.status(400).json({ error: 'A valid category is required' });
  }

  try {
    const { data, error } = await supabase
      .from('complaints')
      .update({ category, status: 'acknowledged', acknowledged_at: new Date().toISOString() })
      .eq('id', id)
      .eq('is_deleted', false)
      .select('*')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Complaint not found' });

    logger.info('Complaint acknowledged', { complaintId: id, category });
    res.json(mapComplaintRow(data));
  } catch (error: any) {
    logger.error('Error acknowledging complaint', error);
    res.status(500).json({ error: error.message || 'Failed to acknowledge complaint' });
  }
});

/**
 * @route PATCH /api/complaints/:id/assign
 * @description Workflow step 2: assign to a (free-text) name. Requires the
 * complaint to already be categorized. SECURITY: admin or management role
 * required.
 */
app.patch('/api/complaints/:id/assign', requireDashboard, async (req, res) => {
  const { id } = req.params;
  const { assignedTo } = req.body as { assignedTo?: string };

  if (!assignedTo || !assignedTo.trim()) {
    return res.status(400).json({ error: 'An assignee name is required' });
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('complaints').select('category, is_deleted').eq('id', id).single();
    if (fetchError || !existing || existing.is_deleted) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    if (!existing.category) {
      return res.status(400).json({ error: 'Categorize this complaint before assigning it' });
    }

    const { data, error } = await supabase
      .from('complaints')
      .update({ assigned_to: assignedTo.trim(), status: 'assigned', assigned_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Complaint not found' });

    logger.info('Complaint assigned', { complaintId: id, assignedTo: assignedTo.trim() });
    res.json(mapComplaintRow(data));
  } catch (error: any) {
    logger.error('Error assigning complaint', error);
    res.status(500).json({ error: error.message || 'Failed to assign complaint' });
  }
});

/**
 * @route POST /api/complaints/:id/photo/signed-upload
 * @description Issues a short-lived signed Storage upload URL for an
 * optional "resolved" photo. SECURITY: admin or management role required.
 */
app.post('/api/complaints/:id/photo/signed-upload', requireDashboard, async (req, res) => {
  const { id } = req.params;

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('complaints').select('id').eq('id', id).eq('is_deleted', false).single();
    if (fetchError || !existing) return res.status(404).json({ error: 'Complaint not found' });

    const path = `${id}/resolution-${Date.now()}.jpg`;
    const { data, error } = await supabase.storage.from('complaint-media').createSignedUploadUrl(path);
    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    logger.error('Error creating signed upload URL for complaint photo', error);
    res.status(500).json({ error: error.message || 'Failed to create signed upload URL' });
  }
});

/**
 * @route PATCH /api/complaints/:id/resolve
 * @description Workflow step 3 (final): mark resolved, with an optional
 * photo (already uploaded via the signed-upload endpoint above). Requires
 * the complaint to already be assigned. SECURITY: admin or management role
 * required.
 */
app.patch('/api/complaints/:id/resolve', requireDashboard, async (req, res) => {
  const { id } = req.params;
  const { photoPath } = req.body as { photoPath?: string };

  if (photoPath && !photoPath.startsWith(`${id}/`)) {
    return res.status(400).json({ error: 'Path mismatch' });
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('complaints').select('assigned_to, is_deleted').eq('id', id).single();
    if (fetchError || !existing || existing.is_deleted) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    if (!existing.assigned_to) {
      return res.status(400).json({ error: 'Assign this complaint before resolving it' });
    }

    const updateData: any = { status: 'resolved', resolved_at: new Date().toISOString() };
    if (photoPath) {
      const { data: { publicUrl } } = supabase.storage.from('complaint-media').getPublicUrl(photoPath);
      updateData.resolution_photo_url = `${publicUrl}?v=${Date.now()}`;
    }

    const { data, error } = await supabase
      .from('complaints')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Complaint not found' });

    logger.info('Complaint resolved', { complaintId: id, hasPhoto: !!photoPath });
    res.json(mapComplaintRow(data));
  } catch (error: any) {
    logger.error('Error resolving complaint', error);
    res.status(500).json({ error: error.message || 'Failed to resolve complaint' });
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
      .from('questions').select('*').eq('is_deleted', false)
      .eq('id', id)
      .single();

    if (fetchError || !question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Only questions belonging to an event that's currently open may be
    // pushed to that event's panel -- enforced here (not just hidden
    // client-side) since this is the actual authorization boundary.
    // Multi-Event Mode: this is the question's own event, not "the live
    // event" (there is no such singular thing anymore).
    if (status === 'pushed') {
      const { data: eventRow, error: eventFetchError } = await supabase
        .from('events')
        .select('is_accepting_questions, expires_at')
        .eq('id', question.event_id)
        .maybeSingle();
      if (eventFetchError) throw eventFetchError;
      if (computeIsExpired(eventRow?.expires_at)) {
        return res.status(403).json({ error: "This question's event has expired, so it can't be pushed to the panel." });
      }
      if (!eventRow?.is_accepting_questions) {
        return res.status(403).json({ error: "This question's event isn't accepting questions right now, so it can't be pushed to the panel." });
      }
    }

    // If changing to 'answering', demote any other question *from the same
    // event* that's currently answering -- scoped by event_id, since with
    // multiple events concurrently live, a different event's panel may
    // legitimately have its own question answering at the same time.
    if (status === 'answering') {
      await supabase
        .from('questions')
        .update({ status: 'answered', answered_at: new Date().toISOString() })
        .eq('status', 'answering')
        .eq('event_id', question.event_id)
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
      .from('questions').select('*').eq('is_deleted', false)
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
      .from('events').select('*').eq('is_deleted', false)
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
  const { title, titleHi, titleOr, subtitle, subtitleHi, subtitleOr, allowAnonymous, isAcceptingQuestions, expiresAt } = req.body;
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
          expires_at: expiresAt || null
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
  const { title, titleHi, titleOr, subtitle, subtitleHi, subtitleOr, allowAnonymous, isAcceptingQuestions, expiresAt } = req.body;

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
    // expiresAt: undefined means "not provided, leave alone"; null/'' means
    // "explicitly clear the expiry" -- both distinct from a real timestamp.
    if (expiresAt !== undefined) updateData.expires_at = expiresAt || null;

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
    // Multi-Event Mode: any event's config change is broadcast (tagged with
    // its own id) -- clients viewing a *different* event ignore it
    // client-side (see useRealTimeQnA's SSE handler), same pragmatic
    // approach as question broadcasts. /api/stream has no auth, but this is
    // the same public-safe shape GET /api/state already exposes for any
    // event, so nothing new is leaked.
    broadcastStateUpdate('event:updated', result);
    res.json(result);
  } catch (error: any) {
    console.error('Error updating event in Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to update event' });
  }
});

app.post('/api/events/:id/media/signed-upload', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { kind, slot } = req.body as { kind: 'logo' | 'banner'; slot?: 1 | 2 | 3 };

  if (kind !== 'logo' && kind !== 'banner') {
    return res.status(400).json({ error: "Invalid media kind: must be 'logo' or 'banner'" });
  }
  if (kind === 'banner' && (!slot || ![1, 2, 3].includes(slot))) {
    return res.status(400).json({ error: "Invalid slot for banner: must be 1, 2, or 3" });
  }

  try {
    const { error: eventError } = await supabase.from('events').select('id').eq('id', id).single();
    if (eventError) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const path = kind === 'logo' ? `${id}/logo.jpg` : `${id}/banner-${slot}.jpg`;
    const { data, error } = await supabase.storage.from('event-media').createSignedUploadUrl(path);

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Error creating signed upload URL:', error);
    res.status(500).json({ error: error.message || 'Failed to create signed upload URL' });
  }
});

app.post('/api/events/:id/media/confirm', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { kind, slot, path } = req.body as { kind: 'logo' | 'banner'; slot?: 1 | 2 | 3; path: string };
  
  const expectedPath = kind === 'logo' ? `${id}/logo.jpg` : `${id}/banner-${slot}.jpg`;
  if (path !== expectedPath) {
    return res.status(400).json({ error: 'Path mismatch' });
  }

  try {
    const { data: { publicUrl } } = supabase.storage.from('event-media').getPublicUrl(path);
    const versionedUrl = `${publicUrl}?v=${Date.now()}`;

    let updateData: any = {};
    if (kind === 'logo') {
      updateData.logo_url = versionedUrl;
    } else {
      const { data: eventData, error: fetchError } = await supabase.from('events').select('banner_urls').eq('id', id).single();
      if (fetchError) throw fetchError;
      
      const bannerUrls = Array.isArray(eventData.banner_urls) ? [...eventData.banner_urls] : [];
      while (bannerUrls.length < 3) {
        bannerUrls.push(null);
      }
      bannerUrls[slot! - 1] = versionedUrl;
      updateData.banner_urls = bannerUrls;
    }
    
    const { data: updatedEvent, error } = await supabase.from('events').update(updateData).eq('id', id).select('*').single();
    if (error) throw error;

    const result = mapEventRow(updatedEvent);
    broadcastStateUpdate('event:updated', result);
    res.json(result);
  } catch (error: any) {
    console.error('Error confirming media upload:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm media upload' });
  }
});

app.delete('/api/events/:id/media', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { kind, slot } = req.body as { kind: 'logo' | 'banner'; slot?: 1 | 2 | 3 };
  
  const path = kind === 'logo' ? `${id}/logo.jpg` : `${id}/banner-${slot}.jpg`;

  try {
    const { error: removeError } = await supabase.storage.from('event-media').remove([path]);
    if (removeError) console.warn('Error removing from storage (may not exist)', removeError);

    let updateData: any = {};
    if (kind === 'logo') {
      updateData.logo_url = null;
    } else {
      const { data: eventData, error: fetchError } = await supabase.from('events').select('banner_urls').eq('id', id).single();
      if (fetchError) throw fetchError;
      
      const bannerUrls = Array.isArray(eventData.banner_urls) ? [...eventData.banner_urls] : [];
      while (bannerUrls.length < 3) {
        bannerUrls.push(null);
      }
      bannerUrls[slot! - 1] = null;
      updateData.banner_urls = bannerUrls;
    }

    const { data: updatedEvent, error } = await supabase.from('events').update(updateData).eq('id', id).select('*').single();
    if (error) throw error;

    const result = mapEventRow(updatedEvent);
    broadcastStateUpdate('event:updated', result);
    res.json(result);
  } catch (error: any) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: error.message || 'Failed to delete media' });
  }
});

app.delete('/api/events/:id', requireAdminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, is_deleted')
      .eq('id', id)
      .single();

    if (eventError || !event || event.is_deleted) {
      return res.status(404).json({ error: 'Event not found or already deleted' });
    }

    const { error: questionsError } = await supabase
      .from('questions')
      .update({ is_deleted: true })
      .eq('event_id', id);

    if (questionsError) throw questionsError;

    const { error: eventUpdateError } = await supabase
      .from('events')
      .update({ is_deleted: true, logo_url: null, banner_urls: [] })
      .eq('id', id);

    if (eventUpdateError) throw eventUpdateError;
    
    const paths = [`${id}/logo.jpg`, `${id}/banner-1.jpg`, `${id}/banner-2.jpg`, `${id}/banner-3.jpg`];
    const { error: storageError } = await supabase.storage.from('event-media').remove(paths);
    if (storageError) {
        console.warn(`Storage cleanup failed for event ${id}, some files may not have been removed.`, storageError);
    }

    broadcastStateUpdate('event:deleted', { id });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error soft-deleting event:', error);
    res.status(500).json({ error: error.message || 'Failed to delete event' });
  }
});



/** Maps a `users` row (with its embedded `user_role_assignments`) to the camelCase shape the frontend expects. */
function mapUserRow(row: any): AppUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    roles: (row.user_role_assignments || []).map((r: any) => r.role)
  };
}

/**
 * @route GET /api/users
 * @description Lists every user with their roles, for the admin-only
 * "Manage Users" screen.
 * SECURITY: Requires admin role (moderators cannot manage other users' roles).
 */
app.get('/api/users', requireAdminOnly, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, username, user_role_assignments(role)')
      .order('email', { ascending: true });

    if (error) throw error;
    res.json((data || []).map(mapUserRow));
  } catch (error: any) {
    console.error('Error fetching users from Supabase:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
});

/**
 * @route PATCH /api/users/:id
 * @description Updates a user's username and/or full set of roles (a user
 * may hold any combination -- `roles` replaces the set entirely, it isn't
 * merged). Guards against ever removing the last remaining admin (a
 * self-lockout footgun this system has no other recovery path for).
 * SECURITY: Requires admin role.
 */
app.patch('/api/users/:id', requireAdminOnly, async (req, res) => {
  const { id } = req.params;
  const { roles, username } = req.body as { roles?: string[]; username?: string };

  try {
    if (roles !== undefined) {
      if (!Array.isArray(roles) || roles.length === 0 || roles.some(r => !ALL_ROLES.includes(r as UserRole))) {
        return res.status(400).json({ error: 'At least one valid role is required' });
      }

      const { data: targetRoles, error: targetError } = await supabase
        .from('user_role_assignments')
        .select('role')
        .eq('user_id', id);

      if (targetError) throw targetError;
      const hadAdmin = (targetRoles || []).some(r => r.role === 'admin');

      if (hadAdmin && !roles.includes('admin')) {
        const { count, error: countError } = await supabase
          .from('user_role_assignments')
          .select('user_id', { count: 'exact', head: true })
          .eq('role', 'admin');

        if (countError) throw countError;
        if ((count ?? 0) <= 1) {
          return res.status(400).json({ error: 'Cannot remove the last remaining admin.' });
        }
      }

      // Replace the role set wholesale: simplest correct way to go from
      // "whatever it was" to "exactly this array" without reasoning about
      // which individual roles were added/removed.
      const { error: deleteError } = await supabase.from('user_role_assignments').delete().eq('user_id', id);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from('user_role_assignments')
        .insert(roles.map(role => ({ user_id: id, role })));
      if (insertError) throw insertError;
    }

    if (username !== undefined) {
      const { error: usernameError } = await supabase
        .from('users')
        .update({ username: username?.trim() || null })
        .eq('id', id);
      if (usernameError) throw usernameError;
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .select('id, email, username, user_role_assignments(role)')
      .eq('id', id)
      .single();

    if (error || !updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(mapUserRow(updatedUser));
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
 * SECURITY: Restricted to admin only (not moderator) -- viewed via the
 * dedicated /logs page.
 */
app.get('/api/logs', requireAdminOnly, (req, res) => {
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



