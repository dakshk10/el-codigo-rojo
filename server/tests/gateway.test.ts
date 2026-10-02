import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createTestDb } from "./helpers/testDb.js";
import { buildApp } from "../src/app.js";
import { getServerChallenge, setTeamsMapForTesting } from "../src/challenge.js";
import {
  GatewayClient,
  setDefaultGatewayClient,
  type GatewayEventPayload,
} from "../src/services/gatewayClient.js";

const TEST_LOG_PATH = "logs/test-gateway-events.ndjson";

function getCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"] as string[] | string | undefined;
  if (!raw) return "";
  const cookies = Array.isArray(raw) ? raw : [raw];
  const session = cookies.find((c) => c.startsWith("ecr_session="));
  return session?.split(";")[0] ?? "";
}

describe("Gateway Integration & Score Normalisation (P3-GW-03 to P3-GW-08)", () => {
  beforeEach(() => {
    setTeamsMapForTesting(null);
    setDefaultGatewayClient(new GatewayClient());
    if (existsSync(TEST_LOG_PATH)) {
      rmSync(TEST_LOG_PATH, { force: true });
    }
  });

  afterEach(() => {
    setTeamsMapForTesting(null);
    setDefaultGatewayClient(new GatewayClient());
    if (existsSync(TEST_LOG_PATH)) {
      rmSync(TEST_LOG_PATH, { force: true });
    }
  });

  it("P3-GW-03: GET /api/session returns result.score as a whole number in [0, 10] when non-null", async () => {
    const db = await createTestDb();
    const app = buildApp(db);
    const srv = getServerChallenge();

    // 1. Enter team and start session
    const enterRes = await request(app)
      .post("/api/teams/enter")
      .send({ teamName: "ScoreTeam", passcode: "1234" });
    const cookie = getCookie(enterRes);

    await request(app)
      .post("/api/session/start")
      .set("Cookie", cookie);

    // 2. Submit correct solution
    const submitRes = await request(app)
      .post("/api/session/submit")
      .set("Cookie", cookie)
      .send({
        code: srv.solution.final_code,
        idempotencyKey: "test-idempotency-1",
      });
    expect(submitRes.body.result).toBe("GRANTED");

    // 3. GET /api/session
    const sessionRes = await request(app)
      .get("/api/session")
      .set("Cookie", cookie);

    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.result).not.toBeNull();
    const score = sessionRes.body.result.score;

    // Must be a whole number between 0 and 10
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(10);
    expect(score).toBe(10); // Perfect submission within time with no hints or wrongs

    // 4. Raw score in database remains the internal unnormalised value (1050)
    const dbSession = await db
      .selectFrom("sessions")
      .select(["final_score"])
      .executeTakeFirst();
    expect(dbSession?.final_score).toBe(1050);
  });

  it("P3-GW-04: Team entry with a name absent from teams.json returns TEAM_NOT_REGISTERED", async () => {
    const db = await createTestDb();
    const app = buildApp(db);

    // Configure registered teams
    setTeamsMapForTesting({
      "Registered Team": "T-100",
      "Allowed Squad": "T-101",
    });

    // Attempt entry with an unregistered team name
    const failRes = await request(app)
      .post("/api/teams/enter")
      .send({ teamName: "Unregistered Team", passcode: "1234" });

    expect(failRes.status).toBe(400);
    expect(failRes.body).toEqual({
      error: "TEAM_NOT_REGISTERED",
      message: "This team name is not on the event list.",
    });

    // Attempt entry with a registered team name
    const okRes = await request(app)
      .post("/api/teams/enter")
      .send({ teamName: "Registered Team", passcode: "1234" });

    expect(okRes.status).toBe(200);
    expect(okRes.body.ok).toBe(true);

    // Verify gateway_team_id was persisted in sessions table
    const sessionRow = await db
      .selectFrom("sessions")
      .select(["gateway_team_id"])
      .executeTakeFirst();
    expect(sessionRow?.gateway_team_id).toBe("T-100");
  });

  it("P3-GW-05: solved fires on correct submission, wrong_attempt on each denial, hint_used on each confirmed hint — unit tests using a mock GatewayClient", async () => {
    const db = await createTestDb();
    const app = buildApp(db);
    const srv = getServerChallenge();

    const dispatched: GatewayEventPayload[] = [];
    const mockClient = {
      sendEvent: async (payload: GatewayEventPayload) => {
        dispatched.push(payload);
        return "sent" as const;
      },
      clearQueue: () => {},
    };
    setDefaultGatewayClient(mockClient as unknown as GatewayClient);

    setTeamsMapForTesting({ "Event Team": "T-GW-5" });

    const enterRes = await request(app)
      .post("/api/teams/enter")
      .send({ teamName: "Event Team", passcode: "1234" });
    const cookie = getCookie(enterRes);

    await request(app)
      .post("/api/session/start")
      .set("Cookie", cookie);

    // 1. Confirm and use hint 1
    const hintRes = await request(app)
      .post("/api/session/hints/1/use")
      .set("Cookie", cookie)
      .send({ confirm: true });
    expect(hintRes.status).toBe(200);

    // Wait microtask tick for background gateway dispatch
    await new Promise((r) => setTimeout(r, 50));

    expect(dispatched.length).toBe(1);
    expect(dispatched[0]).toMatchObject({
      type: "hint_used",
      points: 0,
      team_id: "T-GW-5",
    });

    // 2. Submit wrong attempt
    const wrongRes = await request(app)
      .post("/api/session/submit")
      .set("Cookie", cookie)
      .send({ code: "0000-WRONG", idempotencyKey: "attempt-1" });
    expect(wrongRes.body.result).toBe("DENIED");

    await new Promise((r) => setTimeout(r, 50));

    expect(dispatched.length).toBe(2);
    expect(dispatched[1]).toMatchObject({
      type: "wrong_attempt",
      points: 0,
      team_id: "T-GW-5",
    });

    // Clear rate limit table so second submit within 2s window is allowed
    await db.deleteFrom("rate_limits").where("scope", "=", "submit").execute();

    // 3. Submit correct code
    const correctRes = await request(app)
      .post("/api/session/submit")
      .set("Cookie", cookie)
      .send({ code: srv.solution.final_code, idempotencyKey: "attempt-2" });
    expect(correctRes.body.result).toBe("GRANTED");

    await new Promise((r) => setTimeout(r, 50));

    expect(dispatched.length).toBe(3);
    expect(dispatched[2]).toMatchObject({
      type: "solved",
      points: expect.any(Number),
      team_id: "T-GW-5",
      meta: {
        time_taken_seconds: expect.any(Number),
        attempts: 1, // 1 wrong attempt prior to correct submission
      },
    });
  });

  it("P3-GW-06: A gateway timeout or 5xx does not delay or affect the player-facing game response — test with a mock that hangs", async () => {
    const db = await createTestDb();
    const app = buildApp(db);
    const srv = getServerChallenge();

    // Mock client that hangs indefinitely
    const hangingClient = {
      sendEvent: () => new Promise<never>(() => {}),
      clearQueue: () => {},
    };
    setDefaultGatewayClient(hangingClient as unknown as GatewayClient);

    const enterRes = await request(app)
      .post("/api/teams/enter")
      .send({ teamName: "FastTeam", passcode: "1234" });
    const cookie = getCookie(enterRes);

    await request(app)
      .post("/api/session/start")
      .set("Cookie", cookie);

    const startTime = Date.now();
    const submitRes = await request(app)
      .post("/api/session/submit")
      .set("Cookie", cookie)
      .send({ code: srv.solution.final_code, idempotencyKey: "fast-sub" });

    const elapsed = Date.now() - startTime;

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.result).toBe("GRANTED");
    // Response should be prompt (< 250ms), never waiting for the hanging gateway
    expect(elapsed).toBeLessThan(250);
  });

  it("P3-GW-07: A 409 from the gateway is treated as success and not retried — unit test", async () => {
    let callCount = 0;
    const client = new GatewayClient({
      baseUrl: "https://gateway.example.com",
      gameKey: "test-game-key",
      logPath: TEST_LOG_PATH,
      fetchFn: async () => {
        callCount++;
        return new Response(JSON.stringify({ error: "duplicate" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    const status = await client.sendEvent({
      type: "hint_used",
      points: 0,
      team_id: "T-409",
    });

    expect(status).toBe("sent");
    expect(callCount).toBe(1);
    expect(client.getQueueLength()).toBe(0); // Not pushed into retry queue
  });

  it("P3-GW-08: Every dispatched event appears in logs/gateway-events.ndjson with the correct status field — integration test", async () => {
    let mockResponse: { status: number } | Error = { status: 200 };

    const client = new GatewayClient({
      baseUrl: "https://gateway.example.com",
      gameKey: "test-key",
      logPath: TEST_LOG_PATH,
      fetchFn: async () => {
        if (mockResponse instanceof Error) {
          throw mockResponse;
        }
        return new Response("{}", { status: mockResponse.status });
      },
    });

    // 1. Success 200 -> sent
    mockResponse = { status: 200 };
    const s1 = await client.sendEvent({ type: "hint_used", points: 0, team_id: "T01" });
    expect(s1).toBe("sent");

    // 2. Conflict 409 -> sent
    mockResponse = { status: 409 };
    const s2 = await client.sendEvent({ type: "wrong_attempt", points: 0, team_id: "T01" });
    expect(s2).toBe("sent");

    // 3. Config error 401 -> failed
    mockResponse = { status: 401 };
    const s3 = await client.sendEvent({ type: "hint_used", points: 0, team_id: "T01" });
    expect(s3).toBe("failed");

    // 4. Server error 500 -> queued
    mockResponse = { status: 500 };
    const s4 = await client.sendEvent({ type: "solved", points: 6, team_id: "T01" });
    expect(s4).toBe("queued");

    // 5. Network failure -> queued
    mockResponse = new Error("ECONNREFUSED");
    const s5 = await client.sendEvent({ type: "wrong_attempt", points: 0, team_id: "T01" });
    expect(s5).toBe("queued");

    client.clearQueue();

    // Verify NDJSON log file
    const content = readFileSync(resolve(process.cwd(), TEST_LOG_PATH), "utf8");
    const lines = content.trim().split("\n").map((line) => JSON.parse(line));

    expect(lines).toHaveLength(5);

    for (const line of lines) {
      expect(line).toHaveProperty("dispatched_at");
      expect(new Date(line.dispatched_at).toISOString()).toBe(line.dispatched_at);
      expect(line).toHaveProperty("event_id");
      expect(typeof line.event_id).toBe("string");
      expect(line.event_id.length).toBeGreaterThan(0);
      expect(["hint_used", "wrong_attempt", "solved"]).toContain(line.type);
      expect(line.team_id).toBe("T01");
      expect(["sent", "queued", "failed"]).toContain(line.status);
    }

    expect(lines[0].status).toBe("sent");
    expect(lines[1].status).toBe("sent");
    expect(lines[2].status).toBe("failed");
    expect(lines[3].status).toBe("queued");
    expect(lines[4].status).toBe("queued");
  });
});
