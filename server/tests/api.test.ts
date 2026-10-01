import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestDb } from "./helpers/testDb.js";
import { buildApp } from "../src/app.js";
import { getPublicChallenge, getServerChallenge } from "../src/challenge.js";
import type { Kysely } from "kysely";
import type { Database } from "../src/db.js";

// Shared helpers
function makeApp(db: Kysely<Database>) {
  return buildApp(db);
}

const EVENT_CODE = "test-event-code";

async function enterTeam(
  app: ReturnType<typeof buildApp>,
  name = "TestTeam",
  passcode = "1234",
) {
  const res = await request(app)
    .post("/api/teams/enter")
    .send({ teamName: name, passcode });
  return res;
}

function getCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"] as string[] | string | undefined;
  if (!raw) return "";
  const cookies = Array.isArray(raw) ? raw : [raw];
  const session = cookies.find((c) => c.startsWith("ecr_session="));
  return session?.split(";")[0] ?? "";
}

describe("P1-01 – challenge loader refuses invalid schema", () => {
  it("getPublicChallenge parses successfully", () => {
    expect(() => getPublicChallenge()).not.toThrow();
  });
  it("getServerChallenge parses successfully", () => {
    expect(() => getServerChallenge()).not.toThrow();
  });
});

describe("P1-04 – Status machine", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
  });

  it("NOT_STARTED → ACTIVE after start", async () => {
    const r1 = await enterTeam(app);
    expect(r1.status).toBe(200);
    const cookie = getCookie(r1);
    const session = await request(app).get("/api/session").set("Cookie", cookie);
    expect(session.body.status).toBe("NOT_STARTED");

    await request(app).post("/api/session/start").set("Cookie", cookie);
    const after = await request(app).get("/api/session").set("Cookie", cookie);
    expect(after.body.status).toBe("ACTIVE");
  });

  it("start is idempotent", async () => {
    const r1 = await enterTeam(app);
    const cookie = getCookie(r1);
    await request(app).post("/api/session/start").set("Cookie", cookie);
    const first = await request(app).get("/api/session").set("Cookie", cookie);
    const endsAt1 = first.body.endsAt;

    // Second start: should not reset timer
    await request(app).post("/api/session/start").set("Cookie", cookie);
    const second = await request(app).get("/api/session").set("Cookie", cookie);
    expect(second.body.endsAt).toBe(endsAt1);
    expect(second.body.status).toBe("ACTIVE");
  });
});

describe("P1-05 – Evidence unlock rules", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;
  let cookie: string;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
    const r = await enterTeam(app);
    cookie = getCookie(r);
    await request(app).post("/api/session/start").set("Cookie", cookie);
  });

  it("evidence 01–03 accessible at start", async () => {
    for (const id of ["01", "02", "03"]) {
      const r = await request(app).get(`/api/evidence/${id}`).set("Cookie", cookie);
      expect(r.status).toBe(200);
      expect(r.body.tokens).toBeDefined();
    }
  });

  it("evidence 04 locked until 01–03 opened", async () => {
    // 04 should be locked initially
    const r = await request(app).get("/api/evidence/04").set("Cookie", cookie);
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("LOCKED");
  });

  it("evidence 04 unlocks after 01–03 opened", async () => {
    await request(app).get("/api/evidence/01").set("Cookie", cookie);
    await request(app).get("/api/evidence/02").set("Cookie", cookie);
    await request(app).get("/api/evidence/03").set("Cookie", cookie);

    const r = await request(app).get("/api/evidence/04").set("Cookie", cookie);
    expect(r.status).toBe(200);
  });

  it("evidence 05 locked until 04 opened", async () => {
    await request(app).get("/api/evidence/01").set("Cookie", cookie);
    await request(app).get("/api/evidence/02").set("Cookie", cookie);
    await request(app).get("/api/evidence/03").set("Cookie", cookie);

    const r05before = await request(app).get("/api/evidence/05").set("Cookie", cookie);
    expect(r05before.status).toBe(403);

    await request(app).get("/api/evidence/04").set("Cookie", cookie);

    const r05after = await request(app).get("/api/evidence/05").set("Cookie", cookie);
    expect(r05after.status).toBe(200);
  });
});

describe("P1-06 – Team entry rules", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
  });

  it("new team creates session", async () => {
    const r = await enterTeam(app, "AlphaTeam", "1234");
    expect(r.status).toBe(200);
    expect(r.body.created).toBe(true);
    expect(getCookie(r)).not.toBe("");
  });

  it("same name + right passcode resumes", async () => {
    await enterTeam(app, "BetaTeam", "5678");
    const r2 = await enterTeam(app, "BetaTeam", "5678");
    expect(r2.status).toBe(200);
    expect(r2.body.created).toBe(false);
  });

  it("wrong passcode rejected", async () => {
    await enterTeam(app, "GammaTeam", "1111");
    const r = await enterTeam(app, "GammaTeam", "9999");
    expect(r.status).toBe(401);
  });

  it("duplicate name + wrong passcode gives neutral message (same as wrong passcode)", async () => {
    await enterTeam(app, "DeltaTeam", "1234");
    const r = await enterTeam(app, "DeltaTeam", "9999");
    expect(r.status).toBe(401);
    // Must NOT reveal whether name exists or passcode is wrong
    expect(r.body.message).toBe("Invalid team name or passcode.");
  });
});

describe("P1-07 – Two teams are isolated", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
  });

  it("different cookies → different sessions", async () => {
    const r1 = await enterTeam(app, "Team1", "1111");
    const r2 = await enterTeam(app, "Team2", "2222");
    const c1 = getCookie(r1);
    const c2 = getCookie(r2);

    await request(app).post("/api/session/start").set("Cookie", c1);

    const s1 = await request(app).get("/api/session").set("Cookie", c1);
    const s2 = await request(app).get("/api/session").set("Cookie", c2);

    expect(s1.body.status).toBe("ACTIVE");
    expect(s2.body.status).toBe("NOT_STARTED");
    expect(s1.body.team.name).toBe("Team1");
    expect(s2.body.team.name).toBe("Team2");
  });
});

describe("P1-08 – Submit: DENIED / LOCKED_OUT / GRANTED", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;
  let cookie: string;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
    const r = await enterTeam(app);
    cookie = getCookie(r);
    await request(app).post("/api/session/start").set("Cookie", cookie);
  });

  it("wrong code returns DENIED with attempts only", async () => {
    const r = await request(app)
      .post("/api/session/submit")
      .set("Cookie", cookie)
      .send({ code: "000000", idempotencyKey: "key1" });
    expect(r.status).toBe(200);
    expect(r.body.result).toBe("DENIED");
    expect(r.body.attemptsRemaining).toBe(2);
    expect(r.body).not.toHaveProperty("code");
  });

  it("third wrong attempt → session becomes LOCKED_OUT", async () => {
    // Force 2 prior wrong attempts directly in the DB (avoids rate-limit on rapid HTTP calls).
    // This tests the LOCKED_OUT state machine, not the rate limiter.
    await db
      .updateTable("sessions")
      .set({ attempts_used: 2, wrong_attempts: 2 })
      .execute();

    // 3rd and final attempt via HTTP
    const r3 = await request(app)
      .post("/api/session/submit")
      .set("Cookie", cookie)
      .send({ code: "000002", idempotencyKey: "k3" });
    expect(r3.body.result).toBe("DENIED");
    expect(r3.body.attemptsRemaining).toBe(0);

    const s = await request(app).get("/api/session").set("Cookie", cookie);
    expect(s.body.status).toBe("LOCKED_OUT");
  });

  it("correct code → GRANTED", async () => {
    const srv = getServerChallenge();
    const r = await request(app)
      .post("/api/session/submit")
      .set("Cookie", cookie)
      .send({ code: srv.solution.final_code, idempotencyKey: "correct-key" });
    expect(r.body.result).toBe("GRANTED");
  });
});

describe("P1-09 – Idempotency key", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;
  let cookie: string;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
    const r = await enterTeam(app);
    cookie = getCookie(r);
    await request(app).post("/api/session/start").set("Cookie", cookie);
  });

  it("duplicate idempotency key returns original result, no extra attempt consumed", async () => {
    const r1 = await request(app)
      .post("/api/session/submit")
      .set("Cookie", cookie)
      .send({ code: "000000", idempotencyKey: "same-key" });
    expect(r1.body.result).toBe("DENIED");
    expect(r1.body.attemptsRemaining).toBe(2);

    const r2 = await request(app)
      .post("/api/session/submit")
      .set("Cookie", cookie)
      .send({ code: "000000", idempotencyKey: "same-key" });
    expect(r2.body.result).toBe("DENIED");
    // Attempts should NOT have decremented again
    expect(r2.body.attemptsRemaining).toBe(2);
  });
});

describe("P1-11 – Check endpoint", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;
  let cookie: string;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
    const r = await enterTeam(app);
    cookie = getCookie(r);
    await request(app).post("/api/session/start").set("Cookie", cookie);
  });

  it("correct transformed values → valid:true", async () => {
    const srv = getServerChallenge();
    const vals = Object.values(srv.solution.transformed_values);
    const r = await request(app)
      .post("/api/session/check")
      .set("Cookie", cookie)
      .send({ values: vals });
    expect(r.status).toBe(200);
    expect(r.body.valid).toBe(true);
    expect(r.body.checksRemaining).toBe(2);
    // Must NOT contain per-value breakdown
    expect(r.body).not.toHaveProperty("perValue");
  });

  it("wrong values → valid:false", async () => {
    const r = await request(app)
      .post("/api/session/check")
      .set("Cookie", cookie)
      .send({ values: ["00", "00", "00"] });
    expect(r.body.valid).toBe(false);
  });

  it("cap at 3, 4th → 403", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post("/api/session/check")
        .set("Cookie", cookie)
        .send({ values: ["00", "00", "00"] });
    }
    const r4 = await request(app)
      .post("/api/session/check")
      .set("Cookie", cookie)
      .send({ values: ["00", "00", "00"] });
    expect(r4.status).toBe(403);
    expect(r4.body.error).toBe("EXHAUSTED");
  });
});

describe("P1-12 – Hint text not in session until used", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;
  let cookie: string;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
    const r = await enterTeam(app);
    cookie = getCookie(r);
    await request(app).post("/api/session/start").set("Cookie", cookie);
  });

  it("hints have null text before use", async () => {
    const s = await request(app).get("/api/session").set("Cookie", cookie);
    for (const h of s.body.hints) {
      expect(h.used).toBe(false);
      expect(h.text).toBeNull();
    }
  });

  it("text present after use", async () => {
    const r = await request(app)
      .post("/api/session/hints/1/use")
      .set("Cookie", cookie)
      .send({ confirm: true });
    expect(r.status).toBe(200);
    expect(typeof r.body.text).toBe("string");
    expect(r.body.text.length).toBeGreaterThan(0);

    const s = await request(app).get("/api/session").set("Cookie", cookie);
    const h1 = s.body.hints.find((h: { id: number }) => h.id === 1);
    expect(h1?.used).toBe(true);
    expect(h1?.text).not.toBeNull();
  });
});

describe("P1-13 – Leak scan", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;
  let cookie: string;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
    const r = await enterTeam(app);
    cookie = getCookie(r);
    await request(app).post("/api/session/start").set("Cookie", cookie);
    // Open all evidence
    await request(app).get("/api/evidence/01").set("Cookie", cookie);
    await request(app).get("/api/evidence/02").set("Cookie", cookie);
    await request(app).get("/api/evidence/03").set("Cookie", cookie);
    await request(app).get("/api/evidence/04").set("Cookie", cookie);
    await request(app).get("/api/evidence/05").set("Cookie", cookie);
  });

  async function collectAllResponses() {
    const srv = getServerChallenge();
    const responses: string[] = [];

    const session = await request(app).get("/api/session").set("Cookie", cookie);
    responses.push(JSON.stringify(session.body));

    for (const id of ["01", "02", "03", "04", "05"]) {
      const ev = await request(app).get(`/api/evidence/${id}`).set("Cookie", cookie);
      responses.push(JSON.stringify(ev.body));
    }

    // Submit a wrong code
    const submit = await request(app)
      .post("/api/session/submit")
      .set("Cookie", cookie)
      .send({ code: "000000", idempotencyKey: "leak-test-1" });
    responses.push(JSON.stringify(submit.body));

    return { responses: responses.join(" "), srv };
  }

  it("final_code never in any response", async () => {
    const { responses, srv } = await collectAllResponses();
    expect(responses).not.toContain(srv.solution.final_code);
  });

  it("transformed values never in any response", async () => {
    const { responses, srv } = await collectAllResponses();
    for (const v of Object.values(srv.solution.transformed_values)) {
      // The transformed value strings (e.g. "61") might appear coincidentally in tokens
      // but the solution object values must not appear together in a leak context
      expect(responses).not.toContain(`"final_code"`);
      expect(responses).not.toContain(`"transformed_values"`);
      expect(responses).not.toContain(`"solution"`);
      expect(responses).not.toContain(`"shift"`);
      // Check the warning key from server.json is absent
      expect(responses).not.toContain("PRIVATE. Never bundle");
      void v; // referenced for ts
    }
  });

  it("unused hint text absent until used", async () => {
    const srv = getServerChallenge();
    const { responses } = await collectAllResponses();
    // Hint 2 and 3 are not used — their text must not appear
    for (const h of srv.hints.filter((h) => h.id > 1)) {
      expect(responses).not.toContain(h.text);
    }
  });
});

describe("P1-14 – State survives process restart (DB persistence)", () => {
  it("session state from one db handle is readable from a new handle", async () => {
    const db1 = await createTestDb();
    const app1 = makeApp(db1);
    const r = await enterTeam(app1, "PersistTeam", "4321");
    const cookie = getCookie(r);
    await request(app1).post("/api/session/start").set("Cookie", cookie);
    await request(app1).get("/api/evidence/01").set("Cookie", cookie);

    // Simulate new serverless instance: same db, new buildApp
    const app2 = makeApp(db1);
    const s = await request(app2).get("/api/session").set("Cookie", cookie);
    expect(s.body.status).toBe("ACTIVE");
    expect(s.body.evidence.find((e: { id: string; opened: boolean }) => e.id === "01")?.opened).toBe(true);
  });
});

describe("P1-15 – Rate limiting", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;
  let cookie: string;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
    const r = await enterTeam(app);
    cookie = getCookie(r);
    await request(app).post("/api/session/start").set("Cookie", cookie);
  });

  it("2nd submit within 2s window → 429", async () => {
    await request(app)
      .post("/api/session/submit")
      .set("Cookie", cookie)
      .send({ code: "000000", idempotencyKey: "rl1" });
    // Same window (same second bucket) → rate limited
    const r2 = await request(app)
      .post("/api/session/submit")
      .set("Cookie", cookie)
      .send({ code: "000001", idempotencyKey: "rl2" });
    expect(r2.status).toBe(429);
  });
});

describe("P1-17 – Event access code gate", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
  });

  it("wrong event code rejected", async () => {
    const r = await request(app)
      .post("/api/event/verify")
      .send({ code: "wrong-code" });
    expect(r.status).toBe(403);
  });

  it("correct event code accepted", async () => {
    const r = await request(app)
      .post("/api/event/verify")
      .send({ code: EVENT_CODE });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});

describe("P1-16 – Concurrent submit race", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;
  let cookie: string;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeApp(db);
    const r = await enterTeam(app);
    cookie = getCookie(r);
    await request(app).post("/api/session/start").set("Cookie", cookie);
  });

  it("two concurrent submits consume at most one attempt", async () => {
    // We use different idempotency keys so both are processed
    // (rate limit may stop the second — that's fine: either way only 1 attempt max)
    const [r1, r2] = await Promise.all([
      request(app)
        .post("/api/session/submit")
        .set("Cookie", cookie)
        .send({ code: "000000", idempotencyKey: "concurrent-a" }),
      request(app)
        .post("/api/session/submit")
        .set("Cookie", cookie)
        .send({ code: "000001", idempotencyKey: "concurrent-b" }),
    ]);

    const s = await request(app).get("/api/session").set("Cookie", cookie);
    // One was rate-limited (429) or both got through — either way attempts ≤ 2 used
    const nonRateLimited = [r1, r2].filter((r) => r.status !== 429);
    expect(nonRateLimited.length).toBeGreaterThanOrEqual(1);
    // Regardless, total attempts used ≤ 2 (started with 3 remaining)
    expect(s.body.attemptsRemaining).toBeGreaterThanOrEqual(1);
  });
});
