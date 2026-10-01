import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestDb } from "./helpers/testDb.js";
import { buildApp } from "../src/app.js";
import { getServerChallenge } from "../src/challenge.js";
import type { Kysely } from "kysely";
import type { Database } from "../src/db.js";

function getCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"] as string[] | string | undefined;
  if (!raw) return "";
  const cookies = Array.isArray(raw) ? raw : [raw];
  const session = cookies.find((c) => c.startsWith("ecr_session="));
  return session?.split(";")[0] ?? "";
}

describe("P1-10 – Submission after ends_at → 409 EXPIRED", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;
  let cookie: string;

  beforeEach(async () => {
    db = await createTestDb();
    app = buildApp(db);
    const r = await request(app)
      .post("/api/teams/enter")
      .send({ teamName: "ExpireTeam", passcode: "1234" });
    cookie = getCookie(r);
    await request(app).post("/api/session/start").set("Cookie", cookie);
  });

  it("submit after ends_at returns 409 EXPIRED", async () => {
    // Force ends_at to the past in the DB directly
    const inThePast = new Date(Date.now() - 5000);

    // Get any active session and force-expire it
    await db
      .updateTable("sessions")
      .set({ ends_at: inThePast, status: "ACTIVE" })
      .execute();

    const srv = getServerChallenge();
    const r = await request(app)
      .post("/api/session/submit")
      .set("Cookie", cookie)
      .send({ code: srv.solution.final_code, idempotencyKey: "expired-test" });

    expect(r.status).toBe(409);
    expect(r.body.error).toBe("EXPIRED");
  });
});
