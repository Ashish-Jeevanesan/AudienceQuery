-- Add is_deleted flag for soft-deletes to events and questions tables.
-- This is an irreversible, no-restore-path action.

ALTER TABLE events ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN events.is_deleted IS 'If true, this event is considered soft-deleted and should not be returned in any standard queries. This is an irreversible action.';

ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN questions.is_deleted IS 'If true, this question is considered soft-deleted, usually as a cascade from its parent event being deleted. This is an irreversible action.';

CREATE INDEX IF NOT EXISTS idx_events_is_deleted ON events(is_deleted);
CREATE INDEX IF NOT EXISTS idx_questions_is_deleted ON questions(is_deleted);
