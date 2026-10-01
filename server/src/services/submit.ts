import { timingSafeEqual } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../db.js";
import type { PublicChallenge, ServerChallenge } from "shared";
import { computeScore } from "shared";
import { parseJsonb } from "../jsonb.js";

export type SubmitResult =
  | { kind: "granted"; session: Record<string, unknown> }
  | { kind: "denied"; attemptsRemaining: number }
  | { kind: "expired" }
  | { kind: "locked_out" }
  | { kind: "idempotent"; result: "GRANTED" | "DENIED"; attemptsRemaining?: number }
  | { kind: "session_not_active" };

function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    // Still compare something to avoid timing difference
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export async function submitCode(
  db: Kysely<Database>,
  sessionId: string,
  code: string,
  idempotencyKey: string,
  pub: PublicChallenge,
  srv: ServerChallenge,
): Promise<SubmitResult> {
  return db.transaction().execute(async (trx) => {
    // Check idempotency first
    const existing = await trx
      .selectFrom("submissions")
      .where("session_id", "=", sessionId)
      .where("idempotency_key", "=", idempotencyKey)
      .select(["result"])
      .executeTakeFirst();

    if (existing) {
      const attemptsRow = await trx
        .selectFrom("sessions")
        .where("id", "=", sessionId)
        .select(["attempts_used"])
        .executeTakeFirst();
      const used = attemptsRow?.attempts_used ?? 0;
      return {
        kind: "idempotent",
        result: existing.result as "GRANTED" | "DENIED",
        attemptsRemaining: srv.scoring.attempt_limit - used,
      };
    }

    // Row-lock session
    const row = await trx
      .selectFrom("sessions")
      .where("id", "=", sessionId)
      .forUpdate()
      .select([
        "status",
        "ends_at",
        "started_at",
        "attempts_used",
        "wrong_attempts",
        "checks_used",
        "hints_used",
      ])
      .executeTakeFirst();

    if (!row) return { kind: "session_not_active" };

    // Lazy expiry
    const now = new Date();
    if (row.status === "ACTIVE" && row.ends_at && now >= row.ends_at) {
      await trx
        .updateTable("sessions")
        .set({ status: "EXPIRED" })
        .where("id", "=", sessionId)
        .execute();
      return { kind: "expired" };
    }

    if (row.status === "EXPIRED") return { kind: "expired" };
    if (row.status === "LOCKED_OUT") return { kind: "locked_out" };
    if (row.status !== "ACTIVE") return { kind: "session_not_active" };

    const isCorrect = constantTimeEqual(code, srv.solution.final_code);
    const newAttemptsUsed = row.attempts_used + 1;
    const newWrongAttempts = isCorrect ? row.wrong_attempts : row.wrong_attempts + 1;

    if (isCorrect) {
      const hintsUsed: number[] = parseJsonb<number[]>(row.hints_used);
      const usedHintMultipliers = hintsUsed.map((id) => {
        const h = srv.hints.find((x) => x.id === id);
        return h?.multiplier ?? 1;
      });

      const elapsedSeconds = row.started_at
        ? Math.floor((now.getTime() - row.started_at.getTime()) / 1000)
        : 0;

      const scoreResult = computeScore({
        elapsedSeconds,
        checksUsed: row.checks_used,
        wrongAttempts: row.wrong_attempts,
        scoring: srv.scoring,
        usedHintMultipliers,
        durationSeconds: pub.duration_seconds,
      });

      await trx
        .updateTable("sessions")
        .set({
          status: "SOLVED",
          attempts_used: newAttemptsUsed,
          submitted_at: now,
          final_score: scoreResult.score,
          final_seconds: elapsedSeconds,
        })
        .where("id", "=", sessionId)
        .execute();

      await trx
        .insertInto("submissions")
        .values({ session_id: sessionId, idempotency_key: idempotencyKey, code, result: "GRANTED" })
        .execute();

      return { kind: "granted", session: {} };
    } else {
      const lockedOut = newAttemptsUsed >= srv.scoring.attempt_limit;
      await trx
        .updateTable("sessions")
        .set({
          attempts_used: newAttemptsUsed,
          wrong_attempts: newWrongAttempts,
          status: lockedOut ? "LOCKED_OUT" : "ACTIVE",
          ...(lockedOut ? { final_score: 0 } : {}),
        })
        .where("id", "=", sessionId)
        .execute();

      await trx
        .insertInto("submissions")
        .values({ session_id: sessionId, idempotency_key: idempotencyKey, code, result: "DENIED" })
        .execute();

      return {
        kind: "denied",
        attemptsRemaining: srv.scoring.attempt_limit - newAttemptsUsed,
      };
    }
  });
}
