import type { Kysely } from "kysely";
import type { Database } from "../db.js";
import type { ServerChallenge } from "shared";

export type CheckResult =
  | { kind: "ok"; valid: boolean; checksRemaining: number }
  | { kind: "exhausted" }
  | { kind: "session_not_active" };

/**
 * Check transformation: returns single VALID/NOT_VALID for the whole set.
 * Adds scoring penalty, never reveals per-value info.
 */
export async function checkTransformation(
  db: Kysely<Database>,
  sessionId: string,
  values: string[],
  srv: ServerChallenge,
): Promise<CheckResult> {
  return db.transaction().execute(async (trx) => {
    const row = await trx
      .selectFrom("sessions")
      .where("id", "=", sessionId)
      .forUpdate()
      .select(["status", "checks_used"])
      .executeTakeFirst();

    if (!row || row.status !== "ACTIVE") return { kind: "session_not_active" };
    if (row.checks_used >= srv.scoring.check_limit) return { kind: "exhausted" };

    const newChecksUsed = row.checks_used + 1;
    await trx
      .updateTable("sessions")
      .set({ checks_used: newChecksUsed })
      .where("id", "=", sessionId)
      .execute();

    // Check: values must match the set of transformed values (order-insensitive)
    const expected = Object.values(srv.solution.transformed_values).sort();
    const provided = [...values].sort();
    const valid =
      expected.length === provided.length &&
      expected.every((v, i) => v === provided[i]);

    return {
      kind: "ok",
      valid,
      checksRemaining: srv.scoring.check_limit - newChecksUsed,
    };
  });
}
