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
