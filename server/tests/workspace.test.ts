import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestDb } from "./helpers/testDb.js";
import { buildApp } from "../src/app.js";
import type { Kysely } from "kysely";
import type { Database } from "../src/db.js";

function getCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"] as string[] | string | undefined;
  if (!raw) return "";
  const cookies = Array.isArray(raw) ? raw : [raw];
  const session = cookies.find((c) => c.startsWith("ecr_session="));
  return session?.split(";")[0] ?? "";
}

describe("P3-04 & P3-05: Server Workspace API (PUT /api/session/workspace)", () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    db = await createTestDb();
    app = buildApp(db);
  });

  it("requires a session cookie", async () => {
    const res = await request(app)
      .put("/api/session/workspace")
      .send({ notes: "secret notes" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("NO_SESSION");
  });

  it("persists valid workspace and restores in GET /api/session", async () => {
    const r1 = await request(app)
      .post("/api/teams/enter")
      .send({ teamName: "AlphaTeam", passcode: "1234" });
    const cookie = getCookie(r1);

    const testWorkspace = {
      notes: "Found panel 38 for Quill",
      reviewed: ["01", "02"],
      marks: [
        {
          id: "m1",
          fileId: "01",
          startTokenId: "t10",
          endTokenId: "t12",
          text: "three keys",
          entityType: "number",
        },
      ],
      pinnedEntities: [
        { id: "e1", text: "Quill", type: "alias", fileId: "01" },
      ],
    };

    const putRes = await request(app)
      .put("/api/session/workspace")
      .set("Cookie", cookie)
      .send(testWorkspace);

    expect(putRes.status).toBe(200);
    expect(putRes.body.ok).toBe(true);

    const getRes = await request(app)
      .get("/api/session")
      .set("Cookie", cookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.workspace).toEqual(testWorkspace);
  });

  it("P3-05: rejects workspace payload exceeding 128 KB with 413 PAYLOAD_TOO_LARGE", async () => {
    const r1 = await request(app)
      .post("/api/teams/enter")
      .send({ teamName: "BigPayloadTeam", passcode: "1234" });
    const cookie = getCookie(r1);

    // Create a string payload slightly larger than 128 KB (131,072 bytes)
    const largeString = "x".repeat(132 * 1024);
    const oversizedWorkspace = {
      notes: largeString,
    };

    const putRes = await request(app)
      .put("/api/session/workspace")
      .set("Cookie", cookie)
      .send(oversizedWorkspace);

    expect(putRes.status).toBe(413);
    expect(putRes.body.error).toBe("PAYLOAD_TOO_LARGE");
    expect(putRes.body.message).toContain("128 KB");
  });

  it("accepts workspace payload right below 128 KB limit", async () => {
    const r1 = await request(app)
      .post("/api/teams/enter")
      .send({ teamName: "NearLimitTeam", passcode: "1234" });
    const cookie = getCookie(r1);

    // Target ~120 KB
    const nearLimitString = "a".repeat(120 * 1024);
    const validWorkspace = {
      notes: nearLimitString,
    };

    const putRes = await request(app)
      .put("/api/session/workspace")
      .set("Cookie", cookie)
      .send(validWorkspace);

    expect(putRes.status).toBe(200);
    expect(putRes.body.ok).toBe(true);
  });

  it("rejects non-object or array workspace payloads with 400 BAD_REQUEST", async () => {
    const r1 = await request(app)
      .post("/api/teams/enter")
      .send({ teamName: "TypeCheckTeam", passcode: "1234" });
    const cookie = getCookie(r1);

    const arrayRes = await request(app)
      .put("/api/session/workspace")
      .set("Cookie", cookie)
      .send(["not", "an", "object"]);

    expect(arrayRes.status).toBe(400);
    expect(arrayRes.body.error).toBe("BAD_REQUEST");
  });

  it("P3-04: isolates workspaces between different teams", async () => {
    const r1 = await request(app)
      .post("/api/teams/enter")
      .send({ teamName: "TeamOne", passcode: "1111" });
    const cookie1 = getCookie(r1);

    const r2 = await request(app)
      .post("/api/teams/enter")
      .send({ teamName: "TeamTwo", passcode: "2222" });
    const cookie2 = getCookie(r2);

    await request(app)
      .put("/api/session/workspace")
      .set("Cookie", cookie1)
      .send({ teamOneData: "private1" });

    await request(app)
      .put("/api/session/workspace")
      .set("Cookie", cookie2)
      .send({ teamTwoData: "private2" });

    const get1 = await request(app).get("/api/session").set("Cookie", cookie1);
    const get2 = await request(app).get("/api/session").set("Cookie", cookie2);

    expect(get1.body.workspace).toEqual({ teamOneData: "private1" });
    expect(get2.body.workspace).toEqual({ teamTwoData: "private2" });
  });
});
