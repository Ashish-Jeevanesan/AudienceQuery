-- ============================================================================
-- AudienceQueryLive Database Schema (Updated)
-- Supabase SQL Migrations
-- ============================================================================
-- This schema defines the database structure for migrating from in-memory
-- storage to Supabase PostgreSQL database.
--
-- UPDATES:
-- - Removed upvote functionality (upvotes, upvoted_by columns)
-- - Added user isolation: Users can only see their own questions
-- - Removed upvote_history table
-- ============================================================================

-- ============================================================================
-- 1. CATEGORIES TABLE
-- ============================================================================
-- Stores conference topic categories for question organization
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT 'sky',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_categories_name ON categories(name);

-- ============================================================================
-- 2. CONFERENCE_EVENTS TABLE
-- ============================================================================
-- Stores conference/event configuration (single row)
CREATE TABLE IF NOT EXISTS conference_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  join_code TEXT UNIQUE NOT NULL,
  allow_anonymous BOOLEAN DEFAULT true,
  is_accepting_questions BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_conference_events_join_code ON conference_events(join_code);

-- ============================================================================
-- 3. QUESTIONS TABLE
-- ============================================================================
-- Stores audience questions with full metadata and tracking
-- IMPORTANT: Users can only see their own questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  author_name TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'pushed', 'answering', 'answered', 'rejected')),
  is_priority BOOLEAN DEFAULT false,
  moderator_notes TEXT,
  -- User/Session tracking for isolation
  session_id TEXT NOT NULL,
  -- Device and network metadata
  device_info JSONB,
  network_info JSONB,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  answered_at TIMESTAMP WITH TIME ZONE,
  answering_started_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_questions_status ON questions(status);
CREATE INDEX idx_questions_category_id ON questions(category_id);
CREATE INDEX idx_questions_created_at ON questions(created_at DESC);
CREATE INDEX idx_questions_session_id ON questions(session_id);
CREATE INDEX idx_questions_is_priority ON questions(is_priority);
-- Composite index for user-specific queries
CREATE INDEX idx_questions_session_status ON questions(session_id, status);

-- ============================================================================
-- 4. DEVICE_METADATA TABLE
-- ============================================================================
-- Tracks device and network information for each user session
CREATE TABLE IF NOT EXISTS device_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'unknown')),
  os TEXT,
  browser TEXT,
  screen_resolution TEXT,
  ip_address INET,
  user_agent TEXT,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_device_metadata_session_id ON device_metadata(session_id);
CREATE INDEX idx_device_metadata_connected_at ON device_metadata(connected_at DESC);
CREATE INDEX idx_device_metadata_device_type ON device_metadata(device_type);

-- ============================================================================
-- 5. AUDIT_LOG TABLE
-- ============================================================================
-- Maintains audit trail for moderator actions
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  moderator_id TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX idx_audit_log_entity_id ON audit_log(entity_id);
CREATE INDEX idx_audit_log_moderator_id ON audit_log(moderator_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE conference_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CATEGORIES TABLE POLICIES
-- ============================================================================
-- Allow public SELECT on categories (everyone can see topics)
CREATE POLICY "categories_public_select" ON categories
  FOR SELECT
  USING (true);

-- Allow authenticated admin users to INSERT categories
CREATE POLICY "categories_admin_insert" ON categories
  FOR INSERT
  WITH CHECK (true);

-- Allow authenticated admin users to UPDATE categories
CREATE POLICY "categories_admin_update" ON categories
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow authenticated admin users to DELETE categories
CREATE POLICY "categories_admin_delete" ON categories
  FOR DELETE
  USING (true);

-- ============================================================================
-- CONFERENCE_EVENTS TABLE POLICIES
-- ============================================================================
-- Allow public SELECT on conference events
CREATE POLICY "conference_events_public_select" ON conference_events
  FOR SELECT
  USING (true);

-- Allow authenticated admin users to UPDATE conference events
CREATE POLICY "conference_events_admin_update" ON conference_events
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- QUESTIONS TABLE POLICIES - USER ISOLATION
-- ============================================================================
-- CRITICAL: Users can ONLY see and manage their OWN questions

-- Users can SELECT only their own questions
-- Moderators/admins can SELECT all questions
CREATE POLICY "questions_select_own_or_admin" ON questions
  FOR SELECT
  USING (
    -- User can see their own questions OR they are an admin
    session_id = current_setting('app.current_session_id', true)
    OR
    current_setting('app.is_admin', true) = 'true'
  );

-- Users can INSERT their own questions
CREATE POLICY "questions_user_insert" ON questions
  FOR INSERT
  WITH CHECK (
    session_id = current_setting('app.current_session_id', true)
  );

-- Users can UPDATE only their own questions (before approved)
-- Admins can UPDATE any question
CREATE POLICY "questions_user_update" ON questions
  FOR UPDATE
  USING (
    (session_id = current_setting('app.current_session_id', true) AND status = 'pending')
    OR
    current_setting('app.is_admin', true) = 'true'
  )
  WITH CHECK (true);

-- Users cannot DELETE (only admins can)
-- Admins can DELETE any question
CREATE POLICY "questions_admin_delete" ON questions
  FOR DELETE
  USING (current_setting('app.is_admin', true) = 'true');

-- ============================================================================
-- DEVICE_METADATA TABLE POLICIES
-- ============================================================================
-- Allow public INSERT on device metadata (anyone can submit device info)
CREATE POLICY "device_metadata_public_insert" ON device_metadata
  FOR INSERT
  WITH CHECK (true);

-- Users can SELECT their own device metadata
CREATE POLICY "device_metadata_user_select" ON device_metadata
  FOR SELECT
  USING (
    session_id = current_setting('app.current_session_id', true)
    OR
    current_setting('app.is_admin', true) = 'true'
  );

-- Allow users to UPDATE their own device metadata
CREATE POLICY "device_metadata_user_update" ON device_metadata
  FOR UPDATE
  USING (
    session_id = current_setting('app.current_session_id', true)
    OR
    current_setting('app.is_admin', true) = 'true'
  )
  WITH CHECK (true);

-- ============================================================================
-- AUDIT_LOG TABLE POLICIES
-- ============================================================================
-- Allow authenticated admin users to SELECT audit logs
CREATE POLICY "audit_log_admin_select" ON audit_log
  FOR SELECT
  USING (current_setting('app.is_admin', true) = 'true');

-- Allow authenticated admin users to INSERT audit logs
CREATE POLICY "audit_log_admin_insert" ON audit_log
  FOR INSERT
  WITH CHECK (current_setting('app.is_admin', true) = 'true');

-- ============================================================================
-- 7. SAMPLE DATA / SEED DATA (Optional)
-- ============================================================================
-- Initial categories
INSERT INTO categories (name, color, description) VALUES
  ('Parenting & Faith', 'indigo', 'Guidance on raising children in a Christian household.'),
  ('Marriage & Spirituality', 'emerald', 'Strengthening the spiritual bond between spouses.'),
  ('Youth & Purpose', 'amber', 'Helping young individuals find their purpose in Christ.'),
  ('Biblical Studies', 'rose', 'Deep dives into scripture and its application in daily life.'),
  ('Open Discussion', 'sky', 'General questions and open discussion topics.')
ON CONFLICT (name) DO NOTHING;

-- Initial conference event
INSERT INTO conference_events (title, subtitle, join_code) VALUES
  ('To Live is for Christ', 'Christian Family Conference 2026', 'LIVE4C')
ON CONFLICT (join_code) DO NOTHING;

-- ============================================================================
-- 8. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for categories table
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for conference_events table
DROP TRIGGER IF EXISTS update_conference_events_updated_at ON conference_events;
CREATE TRIGGER update_conference_events_updated_at BEFORE UPDATE ON conference_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for questions table
DROP TRIGGER IF EXISTS update_questions_updated_at ON questions;
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for device_metadata table
DROP TRIGGER IF EXISTS update_device_metadata_updated_at ON device_metadata;
CREATE TRIGGER update_device_metadata_updated_at BEFORE UPDATE ON device_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. VIEWS (Updated)
-- ============================================================================

-- View for questions with category details (filtered per user via RLS)
CREATE OR REPLACE VIEW questions_with_categories AS
SELECT
  q.id,
  q.text,
  q.author_name,
  q.is_anonymous,
  q.category_id,
  c.name as category_name,
  c.color as category_color,
  q.status,
  q.is_priority,
  q.moderator_notes,
  q.created_at,
  q.answered_at,
  q.answering_started_at,
  q.session_id,
  q.device_info,
  q.network_info
FROM questions q
LEFT JOIN categories c ON q.category_id = c.id
ORDER BY q.created_at DESC;

-- View for dashboard statistics (admin only)
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM questions WHERE status = 'pending') as pending_count,
  (SELECT COUNT(*) FROM questions WHERE status = 'pushed') as pushed_count,
  (SELECT COUNT(*) FROM questions WHERE status = 'answering') as answering_count,
  (SELECT COUNT(*) FROM questions WHERE status = 'answered') as answered_count,
  (SELECT COUNT(*) FROM questions WHERE status = 'approved') as approved_count,
  (SELECT COUNT(*) FROM questions WHERE status = 'rejected') as rejected_count,
  (SELECT COUNT(*) FROM questions) as total_count,
  (SELECT COUNT(DISTINCT session_id) FROM questions) as unique_sessions;

-- ============================================================================
-- 10. COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE categories IS 'Stores conference topic categories for organizing questions';
COMMENT ON TABLE conference_events IS 'Stores conference/event configuration settings (single row)';
COMMENT ON TABLE questions IS 'Stores audience-submitted questions with user isolation (users see only their own)';
COMMENT ON TABLE device_metadata IS 'Tracks device and network information for each user session';
COMMENT ON TABLE audit_log IS 'Maintains audit trail of moderator actions';

COMMENT ON COLUMN questions.status IS 'Question lifecycle status: pending, approved, pushed, answering, answered, rejected';
COMMENT ON COLUMN questions.session_id IS 'User session ID - used for user isolation (users can only see their own questions)';
COMMENT ON COLUMN questions.device_info IS 'JSONB containing device type, OS, browser, screen resolution';
COMMENT ON COLUMN questions.network_info IS 'JSONB containing IP address, user agent, connection type';
COMMENT ON COLUMN device_metadata.device_type IS 'Type of device: mobile, tablet, desktop, unknown';

-- ============================================================================
-- 11. IMPORTANT: SESSION CONTEXT SETUP
-- ============================================================================
-- The RLS policies use Supabase session context variables:
--   app.current_session_id   - Set by backend with user's session ID
--   app.is_admin             - Set by backend with 'true' or 'false'
--
-- In backend (server.ts), set these before queries:
--   ALTER ROLE authenticated SET app.current_session_id = 'session-123';
--   ALTER ROLE authenticated SET app.is_admin = 'false';
--
-- Or use postgres.from() with JWT context in Supabase client

-- ============================================================================
-- 12. MIGRATION (2026-08-20): Multi-Event Support + Role-Based Users
-- ============================================================================
-- Adds: user_roles, users (mirrors auth.users with an app role), events
-- (replaces the single-row conference_events with a real list, exactly one
-- of which can be "live" at a time), questions.event_id, and the trigger/
-- function needed to keep it all populated automatically.
--
-- Hand-run this in the Supabase SQL editor BEFORE deploying the server.ts
-- version that depends on it -- the new code queries `users` for role
-- checks and `events` for the live event, so deploying first would 403
-- every admin action and 400 every question submission.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 12.1 USER_ROLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_roles (
  name TEXT PRIMARY KEY
);

INSERT INTO user_roles (name) VALUES
  ('admin'), ('moderator'), ('panelist'), ('stage')
ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 12.2 USERS
-- ----------------------------------------------------------------------------
-- Mirrors auth.users with an application role. Populated automatically by
-- the on_auth_user_created trigger below; backfilled once for accounts that
-- already existed before this migration.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT,
  role TEXT NOT NULL REFERENCES user_roles(name) DEFAULT 'panelist',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: enabled, but deliberately NO permissive policies (default-deny).
-- The app never queries this table from the browser -- only the server's
-- service-role client does, which bypasses RLS entirely. Default-deny is
-- cheap insurance against a future accidental client-side `.from('users')`
-- call leaking the email directory; do not add a public-select policy here
-- the way categories/conference_events do.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 12.3 AUTO-PROVISION users ON NEW auth.users SIGNUP
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER so it can write to public.users regardless of who
-- triggered the auth.users insert. Any error in here would roll back the
-- real signup too, so the role value is sanitized against the 4 known
-- roles instead of trusting the FK to reject bad input.
--
-- SECURITY: role is read ONLY from raw_app_meta_data, which can only be
-- set with the service-role key or via the Supabase dashboard -- never
-- from raw_user_meta_data, which a client can set for itself at signup
-- time (e.g. `supabase.auth.signUp({ options: { data: { role: 'admin' } } })`).
-- Trusting user metadata here would let anyone self-promote to admin.
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role TEXT;
  safe_role TEXT;
BEGIN
  requested_role := NEW.raw_app_meta_data->>'role';

  safe_role := CASE
    WHEN requested_role IN ('admin', 'moderator', 'panelist', 'stage') THEN requested_role
    ELSE 'panelist'
  END;

  INSERT INTO public.users (id, email, username, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    safe_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- One-time backfill for accounts created before this migration existed
-- (e.g. the original administrator account, whose role today lives only
-- in raw_app_meta_data). Sanitized the same way as the trigger above so a
-- single stray value can't abort the whole backfill.
INSERT INTO public.users (id, email, username, role)
SELECT
  au.id,
  au.email,
  split_part(au.email, '@', 1),
  CASE
    WHEN au.raw_app_meta_data->>'role' IN ('admin', 'moderator', 'panelist', 'stage')
      THEN au.raw_app_meta_data->>'role'
    ELSE 'panelist'
  END
FROM auth.users au
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 12.4 EVENTS
-- ----------------------------------------------------------------------------
-- Replaces the single-row conference_events design with a real list. Each
-- event owns its own full config; at most one can be is_live at a time,
-- enforced by the partial unique index below (not just app-level logic).
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  join_code TEXT UNIQUE NOT NULL,
  allow_anonymous BOOLEAN DEFAULT true,
  is_accepting_questions BOOLEAN DEFAULT true,
  is_live BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_live_event ON events(is_live) WHERE is_live = true;
CREATE INDEX IF NOT EXISTS idx_events_join_code ON events(join_code);

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: enabled, but deliberately NO permissive policies (default-deny),
-- same reasoning as `users`. The events table drives real authorization
-- decisions (which event is live, i.e. which questions can be pushed to
-- the panel) -- a permissive `USING (true)` write policy would let anyone
-- holding the public anon key call `supabase.from('events').update(...)`
-- directly from a browser and flip is_live themselves, bypassing every
-- requireRole check in server.ts and the atomic activate_event function
-- entirely. Only the server's service-role client (which bypasses RLS)
-- reads or writes this table -- no client-side code queries it directly.
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Atomically switches the live event: two independent .update() calls from
-- the Node client would be two separate HTTP requests with no shared
-- transaction, which could leave zero (or briefly two) live events on a
-- crash or a race between two moderators activating different events at
-- once. Wrapping both statements in one function makes them one transaction.
--
-- Validates the target event exists BEFORE deactivating the current live
-- event: calling this with a nonexistent id would otherwise still turn off
-- whichever event is currently live (the first UPDATE is unconditional)
-- while the second UPDATE silently matches zero rows, leaving no event
-- live at all. Raising here rolls back the whole function -- including
-- the first UPDATE -- so the original live event is left untouched.
CREATE OR REPLACE FUNCTION activate_event(p_event_id UUID)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Event % does not exist', p_event_id;
  END IF;

  UPDATE events SET is_live = false WHERE is_live = true;
  UPDATE events SET is_live = true WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- 12.5 QUESTIONS.EVENT_ID
-- ----------------------------------------------------------------------------
ALTER TABLE questions ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_questions_event_id ON questions(event_id);

-- ----------------------------------------------------------------------------
-- 12.6 BACKFILL: create the "Legacy Event" from the old single-row config
-- and assign every existing question to it, so nothing is orphaned and the
-- live app keeps working immediately after this migration runs. Guarded so
-- it's safe to re-run: it no-ops once a live event already exists.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  legacy_event_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM events WHERE is_live = true) THEN
    RETURN;
  END IF;

  INSERT INTO events (title, subtitle, join_code, allow_anonymous, is_accepting_questions, is_live)
  SELECT title, subtitle, join_code, allow_anonymous, is_accepting_questions, true
  FROM conference_events
  ORDER BY created_at ASC
  LIMIT 1
  RETURNING id INTO legacy_event_id;

  IF legacy_event_id IS NOT NULL THEN
    UPDATE questions SET event_id = legacy_event_id WHERE event_id IS NULL;
  END IF;
END $$;

-- conference_events is now DEPRECATED and unused -- superseded by `events`
-- above. Left in place (not dropped) since there is no migration tooling in
-- this project to safely reverse a DROP TABLE.
COMMENT ON TABLE conference_events IS 'DEPRECATED, unused as of the 2026-08-20 events/roles migration. Superseded by the events table.';
COMMENT ON TABLE user_roles IS 'The 4 valid application roles: admin, moderator, panelist, stage.';
COMMENT ON TABLE users IS 'Mirrors auth.users with an application role; auto-populated by the on_auth_user_created trigger.';
COMMENT ON TABLE events IS 'A list of conference events; at most one may have is_live = true, enforced by the one_live_event partial unique index.';
COMMENT ON COLUMN questions.event_id IS 'The event this question belongs to. Only the live event''s approved questions may be pushed to the panel.';

-- ============================================================================
-- 13. MIGRATION (2026-08-21): Multi-language category names
-- ============================================================================
-- Supports the audience-facing English/Hindi/Odia language switcher: the
-- topic dropdown a question-asker sees needs to show the category name in
-- their chosen language. `name` stays the canonical/English value and the
-- required column; these two are optional per-language overrides entered
-- by a moderator, with the app falling back to `name` when empty.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_hi TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_or TEXT;

COMMENT ON COLUMN categories.name_hi IS 'Hindi translation of the category name, optional; falls back to `name` when null.';
COMMENT ON COLUMN categories.name_or IS 'Odia translation of the category name, optional; falls back to `name` when null.';

-- ============================================================================
-- 14. MIGRATION (2026-08-21): Multi-language event title/subtitle
-- ============================================================================
-- Same pattern as migration 13 above, applied to `events`: the audience's
-- hero heading, the header bar, and the Stage display all resolve the
-- event's title/subtitle in the viewer's chosen language, falling back to
-- the canonical English `title`/`subtitle` when no translation was entered.
ALTER TABLE events ADD COLUMN IF NOT EXISTS title_hi TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS title_or TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS subtitle_hi TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS subtitle_or TEXT;

COMMENT ON COLUMN events.title_hi IS 'Hindi translation of the event title, optional; falls back to `title` when null.';
COMMENT ON COLUMN events.title_or IS 'Odia translation of the event title, optional; falls back to `title` when null.';
COMMENT ON COLUMN events.subtitle_hi IS 'Hindi translation of the event subtitle, optional; falls back to `subtitle` when null.';
COMMENT ON COLUMN events.subtitle_or IS 'Odia translation of the event subtitle, optional; falls back to `subtitle` when null.';

-- ============================================================================
-- 15. MIGRATION (2026-08-31): Multi-Event Mode -- retire the single-live-event
-- singleton
-- ============================================================================
-- Until now, exactly one event could be `is_live` at a time (enforced by the
-- `one_live_event` partial unique index below), and every audience member --
-- regardless of which event's join code or QR they used -- landed on
-- whichever event held that flag. That made it impossible to run two
-- concurrent groups (e.g. the main service and a youth meeting) side by side.
--
-- `is_accepting_questions` already existed per-event and already meant the
-- right thing (see migration 12's own events table). The actual change here
-- is dropping the singleton so any number of events can be
-- `is_accepting_questions = true` at once, each reachable by its own
-- `/e/:joinCode` link -- see the "Multi-Event Mode" design plan for the full
-- rationale. `is_live` doesn't survive as a "default event" fallback either:
-- a bare `/` visit shows a picker of open events, not a fallback to any one
-- event.
DROP FUNCTION IF EXISTS activate_event(UUID);
DROP INDEX IF EXISTS one_live_event;
ALTER TABLE events DROP COLUMN IF EXISTS is_live;

COMMENT ON TABLE events IS 'A list of events. Any number may have is_accepting_questions = true at once -- each is independently reachable via its own join_code.';
COMMENT ON COLUMN questions.event_id IS 'The event this question belongs to. Only questions whose event has is_accepting_questions = true may be pushed to that event''s panel.';

-- ============================================================================
-- 16. MIGRATION (2026-08-31): Event expiry
-- ============================================================================
-- Optional end date/time for an event. Once past, the event is treated as
-- expired: it drops out of the public "pick an event" dropdown and can no
-- longer accept new question submissions, regardless of its own
-- is_accepting_questions flag. NULL means "never expires" (the default for
-- every existing event). The moderator dashboard still shows expired events
-- (labeled Expired) and every question they ever received -- expiry only
-- affects audience-facing visibility and new submissions, never the data.
ALTER TABLE events ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN events.expires_at IS 'Optional end date/time. Once past, the event is excluded from the public open-events list and rejects new question submissions, but stays fully visible (with all its questions) to moderators. NULL = never expires.';

-- ============================================================================
-- 17. MIGRATION (2026-09-03): Event branding (logo + hero banners)
-- ============================================================================
-- Per-event logo (replaces the default "AQ" mark in Header/Footer/Stage when
-- set) and up to 3 hero banner images (crossfading carousel behind the
-- Audience hero text). Both nullable/empty by default -- an event that never
-- uploads branding renders exactly as it did before this migration.
ALTER TABLE events ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS banner_urls TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN events.logo_url IS 'Public Storage URL of the event''s logo, or NULL to use the default "AQ" branding.';
COMMENT ON COLUMN events.banner_urls IS 'Up to 3 public Storage URLs, in carousel display order. Empty array = no banner carousel, hero renders its default flat background.';

-- Storage bucket for event branding assets. Public read (images render on
-- the unauthenticated Audience/Stage views via Supabase's public object
-- URL), but there are deliberately NO INSERT/UPDATE/DELETE policies on
-- storage.objects for this bucket -- all writes go through the server's
-- service-role client via a short-lived signed upload URL (bypasses RLS by
-- construction), never directly from an anon/authenticated client. Same
-- default-deny posture as the `events` table itself.
--
-- file_size_limit is a post-compression backstop: the client compresses
-- every image to a ~400KB target before upload, so 2MB (2097152 bytes) is a
-- generous ceiling that only matters if a browser can't run that
-- compression step (e.g. no Canvas support).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-media', 'event-media', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
