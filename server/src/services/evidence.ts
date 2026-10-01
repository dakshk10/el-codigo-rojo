import type { Kysely } from "kysely";
import type { Database } from "../db.js";
import type { PublicChallenge } from "shared";
import { tokenise } from "shared";
import type { Token } from "shared";
import { parseJsonb } from "../jsonb.js";

function isUnlocked(evidenceId: string, openedIds: string[], pub: PublicChallenge): boolean {
  const ev = pub.evidence.find((e) => e.id === evidenceId);
  if (!ev) return false;
  return ev.unlock.requires_opened.every((req) => openedIds.includes(req));
}

export type EvidenceResult =
  | { kind: "ok"; tokens: Token[]; metadata: Record<string, string> }
  | { kind: "locked" }
  | { kind: "not_found" };

export async function getEvidence(
  db: Kysely<Database>,
  sessionId: string,
  evidenceId: string,
  pub: PublicChallenge,
): Promise<EvidenceResult> {
  const ev = pub.evidence.find((e) => e.id === evidenceId);
  if (!ev) return { kind: "not_found" };

  const row = await db
    .selectFrom("sessions")
    .where("id", "=", sessionId)
    .select(["opened_ids", "status"])
    .executeTakeFirst();

  if (!row) return { kind: "not_found" };

  const openedIds: string[] = parseJsonb<string[]>(row.opened_ids);

  if (!isUnlocked(evidenceId, openedIds, pub)) {
    return { kind: "locked" };
  }

  // Record the open if not already recorded
  if (!openedIds.includes(evidenceId)) {
    const updated = [...openedIds, evidenceId];
    await db
      .updateTable("sessions")
      .set({ opened_ids: JSON.stringify(updated) })
      .where("id", "=", sessionId)
      .execute();
  }

  const tokens = tokenise(ev.body);

  return {
    kind: "ok",
    tokens,
    metadata: ev.metadata as Record<string, string>,
  };
}
