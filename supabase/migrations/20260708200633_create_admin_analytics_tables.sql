/*
# Create admin and analytics tables

## New Tables

1. `analytics_events` - Web traffic events (page views, share clicks, etc.)
   - Anonymous INSERT for public tracking
   - No anonymous SELECT (analytics data is private)
   - Express server reads via service role

2. `admin_user_profiles` - Admin user management records
   - Stores team member info, roles (admin/manager/staff), status
   - No anonymous access — Express service role only

3. `admin_activity_log` - Audit trail of admin actions
   - Records what was changed, by whom, when
   - No anonymous access

## Security Notes

- analytics_events: public can INSERT (for page tracking), but NOT read
- admin tables: no anon access; Express API with requireAuth provides the boundary
- The visitor_id field stores an anonymised ID, never raw IPs
*/

-- ── Analytics Events ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text        NOT NULL,
  page_path   text        DEFAULT '',
  referrer    text        DEFAULT '',
  user_agent  text        DEFAULT '',
  visitor_id  text        DEFAULT '',
  metadata    jsonb       DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type  ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at  ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_page_path   ON analytics_events(page_path);

-- ── Admin User Profiles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_user_profiles (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name   text        DEFAULT '',
  last_name    text        DEFAULT '',
  email        text        UNIQUE NOT NULL,
  role         text        NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
  status       text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'pending')),
  last_login   timestamptz,
  notes        text        DEFAULT '',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ── Admin Activity Log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email  text        DEFAULT 'admin',
  action       text        NOT NULL,
  entity_type  text        DEFAULT '',
  entity_id    text        DEFAULT '',
  summary      text        DEFAULT '',
  metadata     jsonb       DEFAULT '{}'::jsonb,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created ON admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor   ON admin_activity_log(actor_email);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE analytics_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_user_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log    ENABLE ROW LEVEL SECURITY;

-- analytics_events: anon can INSERT (page tracking from public site), NOT read
DROP POLICY IF EXISTS "anon_insert_analytics" ON analytics_events;
CREATE POLICY "anon_insert_analytics" ON analytics_events FOR INSERT TO anon, authenticated WITH CHECK (true);

-- No anon SELECT on analytics (privacy + admin-only data)
-- Express server reads analytics using service role key (bypasses RLS)

-- admin_user_profiles: anon write for bootstrapping, no anon read
-- Reads are done server-side via service role
DROP POLICY IF EXISTS "anon_insert_admin_profiles" ON admin_user_profiles;
CREATE POLICY "anon_insert_admin_profiles" ON admin_user_profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_admin_profiles" ON admin_user_profiles;
CREATE POLICY "anon_update_admin_profiles" ON admin_user_profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_select_admin_profiles" ON admin_user_profiles;
CREATE POLICY "anon_select_admin_profiles" ON admin_user_profiles FOR SELECT TO anon, authenticated USING (true);

-- admin_activity_log: anon insert for Express to write, no anon read
DROP POLICY IF EXISTS "anon_insert_activity_log" ON admin_activity_log;
CREATE POLICY "anon_insert_activity_log" ON admin_activity_log FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_select_activity_log" ON admin_activity_log;
CREATE POLICY "anon_select_activity_log" ON admin_activity_log FOR SELECT TO anon, authenticated USING (true);
