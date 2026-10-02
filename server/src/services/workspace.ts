import type { Kysely } from "kysely";
import type { Database } from "../db.js";

export const MAX_WORKSPACE_BYTES = 128 * 1024; // 128 KB combined cap

export type SaveWorkspaceResult =
  | { kind: "ok" }
  | { kind: "too_large"; bytes: number }
  | { kind: "not_found" }
  | { kind: "invalid_input" };

export async function saveWorkspace(
  db: Kysely<Database>,
  sessionId: string,
  workspaceData: unknown
): Promise<SaveWorkspaceResult> {
  if (
    workspaceData === null ||
    typeof workspaceData !== "object" ||
    Array.isArray(workspaceData)
  ) {
    return { kind: "invalid_input" };
  }

  let jsonString: string;
  try {
    jsonString = JSON.stringify(workspaceData);
  } catch {
    return { kind: "invalid_input" };
  }

  const bytes = Buffer.byteLength(jsonString, "utf8");
  if (bytes > MAX_WORKSPACE_BYTES) {
    return { kind: "too_large", bytes };
  }

  const row = await db
    .selectFrom("sessions")
    .where("id", "=", sessionId)
    .select(["id"])
    .executeTakeFirst();

  if (!row) {
    return { kind: "not_found" };
  }

  await db
    .updateTable("sessions")
    .set({ workspace_json: jsonString })
    .where("id", "=", sessionId)
    .execute();

  return { kind: "ok" };
}
