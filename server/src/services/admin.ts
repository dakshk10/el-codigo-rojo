import type { Kysely } from "kysely";
import type { Database } from "../db.js";

export interface LeaderboardRow {
  teamName: string;
  status: string;
  score: number | null;
  completionTimeSeconds: number | null;
  hintsUsed: number;
  wrongAttempts: number;
  checksUsed: number;
  timeRemainingSeconds: number | null;
}

export async function getLeaderboard(
  db: Kysely<Database>,
): Promise<LeaderboardRow[]> {
  const rows = await db
    .selectFrom("sessions")
    .innerJoin("teams", "teams.id", "sessions.team_id")
    .select([
      "teams.name as team_name",
      "sessions.status",
      "sessions.final_score",
      "sessions.final_seconds",
      "sessions.hints_used",
      "sessions.wrong_attempts",
      "sessions.checks_used",
      "sessions.ends_at",
    ])
    .orderBy("sessions.final_score", "desc")
    .orderBy("sessions.final_seconds", "asc")
    .execute();

  const now = Date.now();

  return rows.map((r) => {
    const hintsArr = (() => {
      try {
        const parsed = JSON.parse(r.hints_used as string);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();

    const timeRemaining =
      r.status === "ACTIVE" && r.ends_at
        ? Math.max(0, Math.round((new Date(r.ends_at).getTime() - now) / 1000))
        : null;

    return {
      teamName: r.team_name,
      status: r.status,
      score: r.final_score ?? null,
      completionTimeSeconds: r.final_seconds ?? null,
      hintsUsed: hintsArr.length,
      wrongAttempts: r.wrong_attempts,
      checksUsed: r.checks_used,
      timeRemainingSeconds: timeRemaining,
    };
  });
}

export interface ResetResult {
  kind: "ok" | "not_found";
}

export async function resetTeamSession(
  db: Kysely<Database>,
  teamName: string,
): Promise<ResetResult> {
  const nameLower = teamName.toLowerCase().trim();

  const row = await db
    .selectFrom("teams")
    .innerJoin("sessions", "sessions.team_id", "teams.id")
    .where("teams.name_lower", "=", nameLower)
    .select(["sessions.id"])
    .executeTakeFirst();

  if (!row) return { kind: "not_found" };

  await db
    .updateTable("sessions")
    .set({
      status: "NOT_STARTED",
      started_at: null,
      ends_at: null,
      checks_used: 0,
      attempts_used: 0,
      wrong_attempts: 0,
      hints_used: JSON.stringify([]),
      opened_ids: JSON.stringify([]),
      workspace_json: JSON.stringify({}),
      submitted_at: null,
      final_score: null,
      final_seconds: null,
    })
    .where("id", "=", row.id)
    .execute();

  // Remove submissions for this session
  await db
    .deleteFrom("submissions")
    .where("session_id", "=", row.id)
    .execute();

  return { kind: "ok" };
}

export async function exportCsv(db: Kysely<Database>): Promise<string> {
  const rows = await getLeaderboard(db);
  const header =
    "team_name,status,score,completion_time_seconds,hints_used,wrong_attempts,checks_used";

  const lines = rows.map((r) =>
    [
      JSON.stringify(r.teamName),
      r.status,
      r.score ?? "",
      r.completionTimeSeconds ?? "",
      r.hintsUsed,
      r.wrongAttempts,
      r.checksUsed,
    ].join(","),
  );

  return [header, ...lines].join("\n");
}
