/*
# Add simple CMS user passwords

Adds password fields to `admin_user_profiles` for the static Bolt-hosted CMS.
Passwords are stored as salted SHA-256 hashes produced by the admin UI.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE admin_user_profiles
  ADD COLUMN IF NOT EXISTS password_hash text DEFAULT '',
  ADD COLUMN IF NOT EXISTS password_salt text DEFAULT '',
  ADD COLUMN IF NOT EXISTS password_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_admin_user_profiles_email_status
  ON admin_user_profiles(email, status);

-- Seed the default admin account with password123 so existing login continues to work.
-- Hash format: sha256(password_salt || '|' || password)
UPDATE admin_user_profiles
SET
  password_salt = 'bbcdefa17ad000000000000000000001',
  password_hash = encode(digest('bbcdefa17ad000000000000000000001|password123', 'sha256'), 'hex'),
  password_updated_at = now(),
  updated_at = now()
WHERE lower(email) = 'admin@bitsbytes.local'
  AND (password_hash IS NULL OR password_hash = '');
