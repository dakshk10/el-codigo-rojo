import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestDb } from "./helpers/testDb.js";
import { buildApp } from "../src/app.js";
import type { Kysely } from "kysely";
import type { Database } from "../src/db.js";
import { config } from "../src/config.js";

const ADMIN_TOKEN = config.ADMIN_TOKEN;

function makeApp(db: Kysely<Database>) {
  return buildApp(db);
}

async function enterAndStartTeam(
  app: ReturnType<typeof buildApp>,
  name: string,
  passcode = "1234",
) {
  const r = await request(app)
    .post("/api/teams/enter")
    .send({ teamName: name, passcode });
  expect(r.status).toBe(200);
  const raw = r.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookie = cookies.find((c) => c.startsWith("ecr_session="))?.split(";")[0] ?? "";
  await request(app).post("/api/session/start").set("Cookie", cookie);
  return cookie;
}

describe("P5-01 – Admin auth guard", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
  });

  it("rejects missing token on leaderboard", async () => {
    const r = await request(app).get("/api/admin/leaderboard");
    expect(r.status).toBe(401);
    expect(r.body.error).toBe("UNAUTHORIZED");
  });

  it("rejects wrong token on leaderboard", async () => {
    const r = await request(app)
      .get("/api/admin/leaderboard")
      .set("x-admin-token", "wrong-token");
    expect(r.status).toBe(401);
  });

  it("rejects missing token on reset", async () => {
    const r = await request(app)
      .post("/api/admin/reset/AnyTeam")
      .send({ confirm: true });
    expect(r.status).toBe(401);
  });

  it("rejects missing token on export", async () => {
    const r = await request(app).get("/api/admin/export.csv");
    expect(r.status).toBe(401);
  });

  it("accepts correct token on leaderboard", async () => {
    const r = await request(app)
      .get("/api/admin/leaderboard")
      .set("x-admin-token", ADMIN_TOKEN);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.leaderboard)).toBe(true);
  });

  it("leaderboard response never contains solution or hint text", async () => {
    const r = await request(app)
      .get("/api/admin/leaderboard")
      .set("x-admin-token", ADMIN_TOKEN);
    const body = JSON.stringify(r.body);
    // solution.final_code is 6 digits — we don't want the answer
    // Hint text starts with known words from challenge - confirm it's not present
    // The leaderboard only exposes: teamName, status, score, completionTimeSeconds,
    //   hintsUsed (count), wrongAttempts, checksUsed, timeRemainingSeconds
    expect(body).not.toContain("text");
    expect(body).not.toContain("final_code");
    expect(body).not.toContain("transformed_values");
  });
});

describe("P5-02 – Leaderboard ordering and reset", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
  });

  it("leaderboard orders by score desc, then completion_time asc (nulls last by natural sort)", async () => {
    await enterAndStartTeam(app, "TeamA");
    await enterAndStartTeam(app, "TeamB");

    // Set TeamA with a score, TeamB without
    await db
      .updateTable("sessions")
      .set({ status: "SOLVED", final_score: 800, final_seconds: 400 })
      .where("id", "in", (qb) =>
        qb
          .selectFrom("sessions")
          .innerJoin("teams", "teams.id", "sessions.team_id")
          .where("teams.name_lower", "=", "teama")
          .select("sessions.id"),
      )
      .execute();

    const r = await request(app)
      .get("/api/admin/leaderboard")
      .set("x-admin-token", ADMIN_TOKEN);
    expect(r.status).toBe(200);
    const lb = r.body.leaderboard as { teamName: string; score: number | null }[];
    // TeamA should be first (has a score), TeamB second (null score)
    expect(lb[0]?.teamName).toBe("TeamA");
  });

  it("reset returns team to NOT_STARTED and keeps name/passcode", async () => {
    await enterAndStartTeam(app, "ResetTeam");

    // Mark solved
    await db
      .updateTable("sessions")
      .set({ status: "SOLVED", final_score: 700, final_seconds: 300 })
      .where("id", "in", (qb) =>
        qb
          .selectFrom("sessions")
          .innerJoin("teams", "teams.id", "sessions.team_id")
          .where("teams.name_lower", "=", "resetteam")
          .select("sessions.id"),
      )
      .execute();

    const resetRes = await request(app)
      .post("/api/admin/reset/ResetTeam")
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ confirm: true });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.ok).toBe(true);

    // Re-enter with same passcode — should work
    const reEntry = await request(app)
      .post("/api/teams/enter")
      .send({ teamName: "ResetTeam", passcode: "1234" });
    expect(reEntry.status).toBe(200);

    const raw = reEntry.headers["set-cookie"] as string[] | string | undefined;
    const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const cookie = cookies.find((c) => c.startsWith("ecr_session="))?.split(";")[0] ?? "";
    const sess = await request(app).get("/api/session").set("Cookie", cookie);
    expect(sess.body.status).toBe("NOT_STARTED");
  });

  it("reset returns 404 for unknown team", async () => {
    const r = await request(app)
      .post("/api/admin/reset/NonExistentTeam99")
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ confirm: true });
    expect(r.status).toBe(404);
  });

  it("reset requires confirm: true body", async () => {
    await enterAndStartTeam(app, "ConfirmTeam");
    const r = await request(app)
      .post("/api/admin/reset/ConfirmTeam")
      .set("x-admin-token", ADMIN_TOKEN)
      .send({});
    expect(r.status).toBe(400);
  });
});

describe("P5-03 – CSV export", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
  });

  it("CSV contains expected columns and no passcodes", async () => {
    await enterAndStartTeam(app, "CsvTeam", "5678");

    const r = await request(app)
      .get("/api/admin/export.csv")
      .set("x-admin-token", ADMIN_TOKEN);
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/csv/);

    const csv = r.text;
    // Check header columns
    expect(csv).toContain("team_name");
    expect(csv).toContain("status");
    expect(csv).toContain("score");
    expect(csv).toContain("completion_time_seconds");
    expect(csv).toContain("hints_used");
    expect(csv).toContain("wrong_attempts");
    expect(csv).toContain("checks_used");

    // Passcode must NEVER appear
    expect(csv).not.toContain("5678");
    // Team name should appear
    expect(csv).toContain("CsvTeam");
  });

  it("CSV has no solution, hint text or server.json keys", async () => {
    const r = await request(app)
      .get("/api/admin/export.csv")
      .set("x-admin-token", ADMIN_TOKEN);
    const csv = r.text;
    expect(csv).not.toContain("final_code");
    expect(csv).not.toContain("transformed_values");
    expect(csv).not.toContain("passcode_hash");
  });
});
