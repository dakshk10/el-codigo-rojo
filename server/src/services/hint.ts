import type { Kysely } from "kysely";
import type { Database } from "../db.js";
import type { ServerChallenge } from "shared";
import { parseJsonb } from "../jsonb.js";

export type HintResult =
  | { kind: "ok"; text: string }
  | { kind: "already_used" }
  | { kind: "not_found" }
  | { kind: "session_not_active" };

export async function useHint(
  db: Kysely<Database>,
  sessionId: string,
  hintId: number,
  srv: ServerChallenge,
): Promise<HintResult> {
  const hint = srv.hints.find((h) => h.id === hintId);
  if (!hint) return { kind: "not_found" };

  return db.transaction().execute(async (trx) => {
    const row = await trx
      .selectFrom("sessions")
      .where("id", "=", sessionId)
      .forUpdate()
      .select(["status", "hints_used"])
      .executeTakeFirst();

    if (!row || row.status !== "ACTIVE") return { kind: "session_not_active" };

    const hintsUsed: number[] = parseJsonb<number[]>(row.hints_used);
    if (hintsUsed.includes(hintId)) return { kind: "already_used" };

    const updated = [...hintsUsed, hintId];
    await trx
      .updateTable("sessions")
      .set({ hints_used: JSON.stringify(updated) })
      .where("id", "=", sessionId)
      .execute();

    return { kind: "ok", text: hint.text };
  });
}
