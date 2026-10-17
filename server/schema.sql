-- All tables are server-only; browser clients never receive database credentials.
CREATE TABLE IF NOT EXISTS baox_users (
  id uuid PRIMARY KEY,
  username varchar(32) NOT NULL UNIQUE CHECK (username = lower(username)),
  nickname varchar(32) NOT NULL,
  password_hash text NOT NULL,
  avatar text NOT NULL DEFAULT '',
  tier text NOT NULL DEFAULT 'member' CHECK (tier IN ('member','angel','team')),
  is_admin boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE TABLE IF NOT EXISTS baox_sessions (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES baox_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS baox_sessions_user ON baox_sessions(user_id);
CREATE INDEX IF NOT EXISTS baox_sessions_expiry ON baox_sessions(expires_at);
CREATE TABLE IF NOT EXISTS baox_page_rules (
  page text PRIMARY KEY,
  public boolean NOT NULL DEFAULT false,
  tiers text[] NOT NULL DEFAULT ARRAY['member','angel','team'],
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS baox_limits (
  key char(64) PRIMARY KEY,
  hits integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS baox_limits_expiry ON baox_limits(expires_at);
CREATE TABLE IF NOT EXISTS baox_audit (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES baox_users(id),
  action text NOT NULL,
  target text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Supabase REST clients have no policies and therefore no direct table access.
ALTER TABLE baox_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE baox_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE baox_page_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE baox_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE baox_audit ENABLE ROW LEVEL SECURITY;
