-- Migration 002: gateway team id column
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS gateway_team_id TEXT;
