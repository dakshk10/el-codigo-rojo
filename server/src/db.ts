import { Pool } from "pg";
import {
  Kysely,
  PostgresDialect,
  type Generated,
  type ColumnType,
} from "kysely";
import { config } from "./config.js";

// ── Database schema types ───────────────────────────────────────────────────

export interface TeamsTable {
  id: Generated<string>;
  name: string;
  name_lower: string;
  passcode_hash: Buffer;
  passcode_salt: Buffer;
  created_at: ColumnType<Date, never, never>;
}

// SelectType, InsertType, UpdateType
// Fields with DB defaults: use ColumnType<SelectType, InsertType | undefined, UpdateType>
export interface SessionsTable {
  id: Generated<string>;
  team_id: string;
  status: ColumnType<string, string | undefined, string>;
  started_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  ends_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  checks_used: ColumnType<number, number | undefined, number>;
  attempts_used: ColumnType<number, number | undefined, number>;
  wrong_attempts: ColumnType<number, number | undefined, number>;
  hints_used: ColumnType<string, string | undefined, string>;
  opened_ids: ColumnType<string, string | undefined, string>;
  workspace_json: ColumnType<string, string | undefined, string>;
  submitted_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  final_score: ColumnType<number | null, number | null | undefined, number | null>;
  final_seconds: ColumnType<number | null, number | null | undefined, number | null>;
  created_at: ColumnType<Date, never, never>;
}

export interface SubmissionsTable {
  id: Generated<string>;
  session_id: string;
  idempotency_key: string;
  code: string;
  result: string;
  created_at: ColumnType<Date, never, never>;
}

export interface RateLimitsTable {
  id: Generated<string>;
  scope: string;
  key: string;
  window_start: Date;
  count: ColumnType<number, number | undefined, number>;
}

export interface Database {
  teams: TeamsTable;
  sessions: SessionsTable;
  submissions: SubmissionsTable;
  rate_limits: RateLimitsTable;
}

// ── Connection ──────────────────────────────────────────────────────────────

let _db: Kysely<Database> | null = null;

export function getDb(): Kysely<Database> {
  if (!_db) {
    const pool = new Pool({ connectionString: config.DATABASE_URL });
    _db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    });
  }
  return _db;
}
