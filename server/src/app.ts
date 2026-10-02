import express from "express";
import cookieParser from "cookie-parser";
import type { Kysely } from "kysely";
import type { Database } from "./db.js";
import { getPublicChallenge, getServerChallenge } from "./challenge.js";
import { config } from "./config.js";
import { enterTeam } from "./services/team.js";
import { getSessionSnapshot, startSession } from "./services/session.js";
import { getEvidence } from "./services/evidence.js";
import { useHint } from "./services/hint.js";
import { checkTransformation } from "./services/check.js";
import { submitCode } from "./services/submit.js";
import { checkRateLimit } from "./services/rateLimit.js";
import { saveWorkspace } from "./services/workspace.js";
import { getLeaderboard, resetTeamSession, exportCsv } from "./services/admin.js";
import { z } from "zod";

const SESSION_COOKIE = "ecr_session";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() ?? "unknown";
  return req.socket.remoteAddress ?? "unknown";
}

function sendError(res: express.Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: code, message });
}

export function buildApp(db: Kysely<Database>): express.Application {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());

  // ── Health ─────────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // ── Event access code gate ─────────────────────────────────────────────────
  app.post(
    "/api/event/verify",
    async (req, res): Promise<void> => {
      const ip = getClientIp(req);
      const allowed = await checkRateLimit(db, "event_code", ip);
      if (!allowed) {
        sendError(res, 429, "RATE_LIMITED", "Too many attempts. Try again later.");
        return;
      }

      const body = z.object({ code: z.string() }).safeParse(req.body);
      if (!body.success) {
        sendError(res, 400, "BAD_REQUEST", "code required");
        return;
      }

      if (body.data.code !== config.EVENT_CODE) {
        sendError(res, 403, "WRONG_EVENT_CODE", "Invalid access code.");
        return;
      }

      res.json({ ok: true });
    },
  );

  // ── Team entry ─────────────────────────────────────────────────────────────
  app.post(
    "/api/teams/enter",
    async (req, res): Promise<void> => {
      const ip = getClientIp(req);
      const allowed = await checkRateLimit(db, "team_entry", ip);
      if (!allowed) {
        sendError(res, 429, "RATE_LIMITED", "Too many attempts. Try again later.");
        return;
      }

      const body = z
        .object({ teamName: z.string(), passcode: z.string() })
        .safeParse(req.body);
      if (!body.success) {
        sendError(res, 400, "BAD_REQUEST", "teamName and passcode required");
        return;
      }

      const result = await enterTeam(db, body.data.teamName, body.data.passcode);

      if (result.kind === "team_not_registered") {
        sendError(res, 400, "TEAM_NOT_REGISTERED", "This team name is not on the event list.");
        return;
      }
      if (result.kind === "invalid_input") {
        sendError(res, 400, "INVALID_INPUT", result.message);
        return;
      }
      if (result.kind === "wrong_passcode" || result.kind === "name_taken") {
        // Neutral message for both
        sendError(res, 401, "UNAUTHORIZED", "Invalid team name or passcode.");
        return;
      }

      res
        .cookie(SESSION_COOKIE, result.sessionId, {
          httpOnly: true,
          secure: config.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: COOKIE_MAX_AGE,
        })
        .json({ ok: true, created: result.kind === "created" });
    },
  );

  // ── Session middleware ─────────────────────────────────────────────────────
  async function requireSession(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): Promise<void> {
    const sessionId = req.cookies[SESSION_COOKIE] as string | undefined;
    if (!sessionId) {
      sendError(res, 401, "NO_SESSION", "No session cookie");
      return;
    }
    req.sessionId = sessionId;
    next();
  }

  // ── GET /api/session ───────────────────────────────────────────────────────
  app.get("/api/session", requireSession, async (req, res): Promise<void> => {
    const pub = getPublicChallenge();
    const srv = getServerChallenge();
    const snapshot = await getSessionSnapshot(db, req.sessionId!, pub, srv);
    if (!snapshot) {
      sendError(res, 404, "NOT_FOUND", "Session not found");
      return;
    }
    res.json(snapshot);
  });

  // ── POST /api/session/start ────────────────────────────────────────────────
  app.post("/api/session/start", requireSession, async (req, res): Promise<void> => {
    const pub = getPublicChallenge();
    await startSession(db, req.sessionId!, pub.duration_seconds);
    const srv = getServerChallenge();
    const snapshot = await getSessionSnapshot(db, req.sessionId!, pub, srv);
    res.json(snapshot);
  });

  // ── GET /api/evidence/:id ─────────────────────────────────────────────────
  app.get("/api/evidence/:id", requireSession, async (req, res): Promise<void> => {
    const pub = getPublicChallenge();
    const result = await getEvidence(db, req.sessionId!, req.params["id"]!, pub);
    if (result.kind === "not_found") {
      sendError(res, 404, "NOT_FOUND", "Evidence not found");
      return;
    }
    if (result.kind === "locked") {
      sendError(res, 403, "LOCKED", "Evidence is locked");
      return;
    }
    res.json({ tokens: result.tokens, metadata: result.metadata });
  });

  // ── PUT /api/session/workspace ─────────────────────────────────────────────
  app.put("/api/session/workspace", requireSession, async (req, res): Promise<void> => {
    const result = await saveWorkspace(db, req.sessionId!, req.body);
    if (result.kind === "invalid_input") {
      sendError(res, 400, "BAD_REQUEST", "Workspace body must be a JSON object");
      return;
    }
    if (result.kind === "too_large") {
      sendError(res, 413, "PAYLOAD_TOO_LARGE", "Workspace data exceeds 128 KB cap");
      return;
    }
    if (result.kind === "not_found") {
      sendError(res, 404, "NOT_FOUND", "Session not found");
      return;
    }
    res.json({ ok: true });
  });

  // ── POST /api/session/hints/:n/use ────────────────────────────────────────
  app.post(
    "/api/session/hints/:n/use",
    requireSession,
    async (req, res): Promise<void> => {
      const body = z.object({ confirm: z.literal(true) }).safeParse(req.body);
      if (!body.success) {
        sendError(res, 400, "BAD_REQUEST", "confirm: true required");
        return;
      }

      const hintId = Number(req.params["n"]);
      if (!Number.isInteger(hintId) || hintId < 1) {
        sendError(res, 400, "BAD_REQUEST", "Invalid hint id");
        return;
      }

      const srv = getServerChallenge();
      const result = await useHint(db, req.sessionId!, hintId, srv);

      if (result.kind === "not_found") {
        sendError(res, 404, "NOT_FOUND", "Hint not found");
        return;
      }
      if (result.kind === "session_not_active") {
        sendError(res, 409, "NOT_ACTIVE", "Session is not active");
        return;
      }
      if (result.kind === "already_used") {
        sendError(res, 409, "ALREADY_USED", "Hint already used");
        return;
      }

      res.json({ text: result.text });
    },
  );

  // ── POST /api/session/check ────────────────────────────────────────────────
  // NOTE: exhaustion (checks_used >= check_limit) is enforced inside checkTransformation
  // and takes precedence. The per-call rate limit is applied only AFTER the DB-level
  // exhaustion check so that a team that has used all checks gets 403 EXHAUSTED, not 429.
  app.post("/api/session/check", requireSession, async (req, res): Promise<void> => {
    const body = z
      .object({ values: z.array(z.string()).length(3) })
      .safeParse(req.body);
    if (!body.success) {
      sendError(res, 400, "BAD_REQUEST", "values must be an array of 3 strings");
      return;
    }

    const srv = getServerChallenge();
    const result = await checkTransformation(db, req.sessionId!, body.data.values, srv);

    if (result.kind === "session_not_active") {
      sendError(res, 409, "NOT_ACTIVE", "Session is not active");
      return;
    }
    if (result.kind === "exhausted") {
      sendError(res, 403, "EXHAUSTED", "No checks remaining");
      return;
    }

    // Apply per-call rate limit only after we know the session is valid and not exhausted.
    // This prevents rapid-fire abuse while ensuring exhausted sessions see 403, not 429.
    const ip = getClientIp(req);
    const allowed = await checkRateLimit(db, "check", `${req.sessionId}:${ip}`);
    if (!allowed) {
      sendError(res, 429, "RATE_LIMITED", "Too many check attempts. Wait a moment.");
      return;
    }

    res.json({ valid: result.valid, checksRemaining: result.checksRemaining });
  });

  // ── POST /api/session/submit ───────────────────────────────────────────────
  // Order: (1) parse body, (2) lightweight idempotency pre-check, (3) rate limit
  // for new submissions only, (4) full submitCode transaction.
  // This guarantees: duplicate keys never hit rate limit; attempts are never consumed
  // before the rate limit check; new unique submissions are rate-limited.
  app.post("/api/session/submit", requireSession, async (req, res): Promise<void> => {
    const body = z
      .object({ code: z.string(), idempotencyKey: z.string() })
      .safeParse(req.body);
    if (!body.success) {
      sendError(res, 400, "BAD_REQUEST", "code and idempotencyKey required");
      return;
    }

    // Step 1: lightweight idempotency pre-check (read-only, no DB side-effects).
    const existing = await db
      .selectFrom("submissions")
      .where("session_id", "=", req.sessionId!)
      .where("idempotency_key", "=", body.data.idempotencyKey)
      .select(["result"])
      .executeTakeFirst();

    if (existing) {
      // Duplicate key → return cached result without touching rate limit.
      const srv = getServerChallenge();
      const attemptsRow = await db
        .selectFrom("sessions")
        .where("id", "=", req.sessionId!)
        .select(["attempts_used"])
        .executeTakeFirst();
      const used = attemptsRow?.attempts_used ?? 0;
      if (existing.result === "GRANTED") {
        res.json({ result: "GRANTED" });
      } else {
        res.json({ result: "DENIED", attemptsRemaining: srv.scoring.attempt_limit - used });
      }
      return;
    }

    // Step 2: new submission — apply rate limit before processing.
    const ip = getClientIp(req);
    const allowed = await checkRateLimit(db, "submit", `${req.sessionId}:${ip}`);
    if (!allowed) {
      sendError(res, 429, "RATE_LIMITED", "Too many submit attempts. Wait a moment.");
      return;
    }

    // Step 3: full submit transaction.
    const pub = getPublicChallenge();
    const srv = getServerChallenge();
    const result = await submitCode(
      db,
      req.sessionId!,
      body.data.code,
      body.data.idempotencyKey,
      pub,
      srv,
    );

    if (result.kind === "expired") {
      res.status(409).json({ error: "EXPIRED", message: "Session has expired" });
      return;
    }
    if (result.kind === "locked_out" || result.kind === "session_not_active") {
      res.status(409).json({ error: "NOT_ACTIVE", message: "Session is not active" });
      return;
    }
    // idempotent shouldn't happen here (we pre-checked above), but handle safely.
    if (result.kind === "idempotent") {
      if (result.result === "GRANTED") {
        res.json({ result: "GRANTED" });
      } else {
        res.json({ result: "DENIED", attemptsRemaining: result.attemptsRemaining });
      }
      return;
    }
    if (result.kind === "granted") {
      res.json({ result: "GRANTED" });
      return;
    }
    res.json({ result: "DENIED", attemptsRemaining: result.attemptsRemaining });
  });

  // ── Admin middleware ───────────────────────────────────────────────────────
  function requireAdmin(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): void {
    const token = req.headers["x-admin-token"];
    if (!token || token !== config.ADMIN_TOKEN) {
      sendError(res, 401, "UNAUTHORIZED", "Invalid or missing admin token");
      return;
    }
    next();
  }

  // ── GET /api/admin/leaderboard ─────────────────────────────────────────────
  app.get("/api/admin/leaderboard", requireAdmin, async (_req, res): Promise<void> => {
    const rows = await getLeaderboard(db);
    res.json({ leaderboard: rows });
  });

  // ── POST /api/admin/reset/:teamName ────────────────────────────────────────
  app.post("/api/admin/reset/:teamName", requireAdmin, async (req, res): Promise<void> => {
    const body = z.object({ confirm: z.literal(true) }).safeParse(req.body);
    if (!body.success) {
      sendError(res, 400, "BAD_REQUEST", "confirm: true required");
      return;
    }
    const teamName = decodeURIComponent(req.params["teamName"]!);
    const result = await resetTeamSession(db, teamName);
    if (result.kind === "not_found") {
      sendError(res, 404, "NOT_FOUND", "Team not found");
      return;
    }
    res.json({ ok: true });
  });

  // ── GET /api/admin/export.csv ──────────────────────────────────────────────
  app.get("/api/admin/export.csv", requireAdmin, async (_req, res): Promise<void> => {
    const csv = await exportCsv(db);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=results.csv");
    res.send(csv);
  });

  return app;
}

// Extend Request type
declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
    }
  }
}
