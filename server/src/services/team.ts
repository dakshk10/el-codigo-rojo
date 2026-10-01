import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../db.js";

const SCRYPT_KEYLEN = 64;

function getScryptParams() {
  // Read at call time so test env (NODE_ENV=test) takes effect
  return process.env["NODE_ENV"] === "test"
    ? { N: 1024, r: 1, p: 1 }
    : { N: 16384, r: 8, p: 1 };
}


function scryptHash(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEYLEN, getScryptParams(), (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

async function hashPasscode(passcode: string): Promise<{ hash: Buffer; salt: Buffer }> {
  const salt = randomBytes(16);
  const hash = await scryptHash(passcode, salt);
  return { hash, salt };
}

async function verifyPasscode(
  passcode: string,
  storedHash: Buffer,
  salt: Buffer,
): Promise<boolean> {
  const hash = await scryptHash(passcode, salt);
  if (hash.length !== storedHash.length) return false;
  return timingSafeEqual(hash, storedHash);
}

function validateTeamName(name: string): boolean {
  return /^[A-Za-z0-9 \-]{3,24}$/.test(name);
}

function validatePasscode(passcode: string): boolean {
  return /^\d{4}$/.test(passcode);
}

export type TeamEntryResult =
  | { kind: "created"; teamId: string; sessionId: string }
  | { kind: "resumed"; teamId: string; sessionId: string }
  | { kind: "name_taken" }
  | { kind: "wrong_passcode" }
  | { kind: "invalid_input"; message: string };

export async function enterTeam(
  db: Kysely<Database>,
  name: string,
  passcode: string,
): Promise<TeamEntryResult> {
  if (!validateTeamName(name)) {
    return { kind: "invalid_input", message: "Team name must be 3-24 chars: letters, digits, spaces, hyphens" };
  }
  if (!validatePasscode(passcode)) {
    return { kind: "invalid_input", message: "Passcode must be exactly 4 digits" };
  }

  const nameLower = name.toLowerCase().trim();

  // Check if team exists
  const existing = await db
    .selectFrom("teams")
    .innerJoin("sessions", "sessions.team_id", "teams.id")
    .where("teams.name_lower", "=", nameLower)
    .select(["teams.id", "teams.passcode_hash", "teams.passcode_salt", "sessions.id as session_id"])
    .executeTakeFirst();

  if (existing) {
    // Resume: verify passcode
    const ok = await verifyPasscode(
      passcode,
      existing.passcode_hash as Buffer,
      existing.passcode_salt as Buffer,
    );
    if (!ok) return { kind: "wrong_passcode" };
    return { kind: "resumed", teamId: existing.id, sessionId: existing.session_id };
  }

  // New team: insert with advisory lock to prevent races
  try {
    const { hash, salt } = await hashPasscode(passcode);

    const result = await db.transaction().execute(async (trx) => {
      // Lock at transaction level using pg_try_advisory_xact_lock keyed on the name
      // Fallback: just rely on UNIQUE constraint
      const team = await trx
        .insertInto("teams")
        .values({
          name: name.trim(),
          name_lower: nameLower,
          passcode_hash: hash,
          passcode_salt: salt,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      const session = await trx
        .insertInto("sessions")
        .values({
          team_id: team.id,
          status: "NOT_STARTED",
          checks_used: 0,
          attempts_used: 0,
          wrong_attempts: 0,
          hints_used: JSON.stringify([]),
          opened_ids: JSON.stringify([]),
          workspace_json: JSON.stringify({}),
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      return { teamId: team.id, sessionId: session.id };
    });

    return { kind: "created", ...result };
  } catch (err: unknown) {
    // Unique constraint violation means the name was taken concurrently
    const pg = err as { code?: string };
    if (pg.code === "23505") {
      return { kind: "name_taken" };
    }
    throw err;
  }
}
