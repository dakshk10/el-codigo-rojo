import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "../db.js";
import type {
  PublicChallenge,
  ServerChallenge,
  SessionStatus,
  HintSnapshot,
  EvidenceSnapshot,
  ResultSnapshot,
  SessionSnapshot,
} from "shared";
import { parseJsonb } from "../jsonb.js";

export type {
  SessionStatus,
  HintSnapshot,
  EvidenceSnapshot,
  ResultSnapshot,
  SessionSnapshot,
};

function computeStatus(
  raw: string,
  endsAt: Date | null,
  serverNow: Date,
): SessionStatus {
  if (raw === "ACTIVE" && endsAt && serverNow >= endsAt) return "EXPIRED";
  return raw as SessionStatus;
}

function isUnlocked(evidenceId: string, openedIds: string[], pub: PublicChallenge): boolean {
  const ev = pub.evidence.find((e) => e.id === evidenceId);
  if (!ev) return false;
  if (ev.unlock.requires_opened.length === 0) return true;
  return ev.unlock.requires_opened.every((req) => openedIds.includes(req));
}

export async function getSessionSnapshot(
  db: Kysely<Database>,
  sessionId: string,
  pub: PublicChallenge,
  srv: ServerChallenge,
): Promise<SessionSnapshot | null> {
  const row = await db
    .selectFrom("sessions")
    .innerJoin("teams", "teams.id", "sessions.team_id")
    .where("sessions.id", "=", sessionId)
    .select([
      "sessions.id",
      "sessions.status",
      "sessions.started_at",
      "sessions.ends_at",
      "sessions.checks_used",
      "sessions.attempts_used",
      "sessions.wrong_attempts",
      "sessions.hints_used",
      "sessions.opened_ids",
      "sessions.workspace_json",
      "sessions.final_score",
      "sessions.final_seconds",
      "teams.name as team_name",
    ])
    .executeTakeFirst();

  if (!row) return null;

  const serverNow = new Date();
  const openedIds: string[] = parseJsonb<string[]>(row.opened_ids);
  const hintsUsed: number[] = parseJsonb<number[]>(row.hints_used);

  const status = computeStatus(row.status, row.ends_at, serverNow);

  // Lazy expiry: update status in DB if needed
  if (status !== row.status) {
    await db
      .updateTable("sessions")
      .set({ status })
      .where("id", "=", sessionId)
      .execute();
  }

  const evidence: EvidenceSnapshot[] = pub.evidence.map((ev, i) => {
    const unlocked = isUnlocked(ev.id, openedIds, pub);
    return {
      id: ev.id,
      ordinal: i + 1,
      title: unlocked ? ev.title : "ENCRYPTED",
      unlocked,
      opened: openedIds.includes(ev.id),
    };
  });

  const hints: HintSnapshot[] = srv.hints.map((h) => {
    const used = hintsUsed.includes(h.id);
    return {
      id: h.id,
      title: h.title,
      penaltyPercent: Math.round((1 - h.multiplier) * 100),
      used,
      text: used ? h.text : null,
    };
  });

  let result: ResultSnapshot | null = null;
  if (["SOLVED", "EXPIRED", "LOCKED_OUT"].includes(status)) {
    result = {
      score: row.final_score ?? 0,
      elapsedSeconds: row.final_seconds ?? 0,
      hintsUsed: hintsUsed.length,
      wrongAttempts: row.wrong_attempts,
      checksUsed: row.checks_used,
      speedBonus: 0,
    };
  }

  const workspace: Record<string, unknown> = parseJsonb<Record<string, unknown>>(row.workspace_json);

  return {
    status,
    serverNow: serverNow.getTime(),
    endsAt: row.ends_at ? row.ends_at.getTime() : null,
    durationSeconds: pub.duration_seconds,
    team: { name: row.team_name },
    evidence,
    hints,
    attemptsRemaining:
      srv.scoring.attempt_limit - row.attempts_used,
    checksRemaining: srv.scoring.check_limit - row.checks_used,
    workspace,
    result,
  };
}

export async function startSession(
  db: Kysely<Database>,
  sessionId: string,
  durationSeconds: number,
): Promise<{ started: boolean }> {
  // Idempotent: if already ACTIVE/terminal, do nothing
  const row = await db
    .selectFrom("sessions")
    .where("id", "=", sessionId)
    .select(["status"])
    .executeTakeFirst();

  if (!row || row.status !== "NOT_STARTED") return { started: false };

  await db
    .updateTable("sessions")
    .set({
      status: "ACTIVE",
      started_at: sql<Date>`now()`,
      ends_at: sql<Date>`now() + (${durationSeconds} * interval '1 second')`,
    })
    .where("id", "=", sessionId)
    .where("status", "=", "NOT_STARTED")
    .execute();

  return { started: true };
}
