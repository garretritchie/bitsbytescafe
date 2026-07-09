-- Admin credentials table: stores PBKDF2-SHA256 hashes only, never plaintext passwords
CREATE TABLE IF NOT EXISTS admin_user_credentials (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES admin_user_profiles(id) ON DELETE CASCADE,
  password_hash       text        NOT NULL,
  password_salt       text        NOT NULL,
  password_updated_at timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  CONSTRAINT uq_credentials_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON admin_user_credentials(user_id);

ALTER TABLE admin_user_credentials ENABLE ROW LEVEL SECURITY;

-- Anon SELECT so the browser can fetch the salt+hash for login verification
CREATE POLICY "anon_select_credentials" ON admin_user_credentials
  FOR SELECT TO anon, authenticated USING (true);

-- Anon INSERT for initial account creation
CREATE POLICY "anon_insert_credentials" ON admin_user_credentials
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Anon UPDATE for password resets via admin panel
CREATE POLICY "anon_update_credentials" ON admin_user_credentials
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Anon DELETE for credential cleanup
CREATE POLICY "anon_delete_credentials" ON admin_user_credentials
  FOR DELETE TO anon, authenticated USING (true);

-- Seed the default admin account (admin@bitsbytes.local) with password: password123
-- Hash is PBKDF2-SHA256 with 100000 iterations, key length 32 bytes
-- salt: bbc2024cafesalt01  hash: 724a89a862a5e780ef80d83a77026c0c785fe40f21836cb0ec54b2884dc622e0
INSERT INTO admin_user_credentials (user_id, password_hash, password_salt)
SELECT id, '724a89a862a5e780ef80d83a77026c0c785fe40f21836cb0ec54b2884dc622e0', 'bbc2024cafesalt01'
FROM admin_user_profiles
WHERE email = 'admin@bitsbytes.local'
ON CONFLICT (user_id) DO NOTHING;
