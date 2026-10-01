-- Migration 001: initial schema
-- Applied in order against Neon Postgres

CREATE TABLE IF NOT EXISTS teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  name_lower  TEXT NOT NULL UNIQUE,
  passcode_hash BYTEA NOT NULL,
  passcode_salt BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL UNIQUE REFERENCES teams(id),
  status          TEXT NOT NULL DEFAULT 'NOT_STARTED'
                    CHECK (status IN ('NOT_STARTED','ACTIVE','SOLVED','EXPIRED','LOCKED_OUT')),
  started_at      TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  checks_used     INT NOT NULL DEFAULT 0,
  attempts_used   INT NOT NULL DEFAULT 0,
  wrong_attempts  INT NOT NULL DEFAULT 0,
  hints_used      JSONB NOT NULL DEFAULT '[]',
  opened_ids      JSONB NOT NULL DEFAULT '[]',
  workspace_json  JSONB NOT NULL DEFAULT '{}',
  submitted_at    TIMESTAMPTZ,
  final_score     INT,
  final_seconds   INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES sessions(id),
  idempotency_key TEXT NOT NULL,
  code            TEXT NOT NULL,
  result          TEXT NOT NULL CHECK (result IN ('GRANTED','DENIED')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope         TEXT NOT NULL,
  key           TEXT NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL,
  count         INT NOT NULL DEFAULT 1,
  UNIQUE (scope, key, window_start)
);

CREATE INDEX IF NOT EXISTS rate_limits_scope_key_window
  ON rate_limits (scope, key, window_start);
