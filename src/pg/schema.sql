CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  workspace text NOT NULL,
  from_code text NOT NULL,
  to_code text NOT NULL,
  message text NOT NULL,
  timestamp timestamptz NOT NULL,
  reply_to text,
  acked_at timestamptz
);

CREATE INDEX IF NOT EXISTS messages_workspace_to_code_timestamp_idx
  ON messages (workspace, to_code, timestamp);

-- Dashboard accounts (web/) — username/password auth, one user can access several
-- workspaces (and a workspace could in principle be shared by several users).
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_access (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace text NOT NULL,
  token text NOT NULL,
  role text NOT NULL DEFAULT 'membre', -- 'admin' | 'membre' | 'lecture'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace)
);

ALTER TABLE workspace_access ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'membre';
