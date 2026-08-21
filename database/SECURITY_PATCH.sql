-- Security patch for the events/roles migration (2026-08-21).
-- Safe to run once; every statement is idempotent.

-- 1. Fix: the new-signup trigger must only ever read role from
--    raw_app_meta_data (service-role-settable only), never
--    raw_user_meta_data (client-settable at signup -- trusting it would
--    let anyone self-promote to admin).
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

-- 2. Fix: remove the overly-permissive write policy on `events` --
--    it let anyone with the public anon key flip which event is live
--    directly from a browser, bypassing the server entirely.
DROP POLICY IF EXISTS "events_public_select" ON events;
DROP POLICY IF EXISTS "events_admin_write" ON events;
-- events keeps RLS enabled with no policies (default-deny) -- only the
-- server's service-role client (which bypasses RLS) touches this table.

-- 3. Fix: activate_event now validates the target event exists before
--    touching anything, so calling it with a bad id can never leave zero
--    live events (this bit me during my own testing just now).
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
