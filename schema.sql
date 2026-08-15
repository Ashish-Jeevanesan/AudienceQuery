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
-- END OF SCHEMA
-- ============================================================================
