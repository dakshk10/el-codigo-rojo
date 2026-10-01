# Phase 1 — Foundation & Game Engine: Verification Report

**Date:** 2026-10-02  
**Tag:** `phase-1-complete`  
**Status:** ✅ ALL CHECKS PASSED

---

## Global Definition of Done

| Check | Result |
|---|---|
| `npm run typecheck` passes (all workspaces) | ✅ 0 errors (server + shared) |
| `npm test` passes (all workspaces) | ✅ 32/32 server tests, 17/17 shared tests |
| `node scripts/verify-challenge.mjs` | ✅ ALL CHECKS PASSED |
| No TODO/FIXME/placeholder/mock data in `src` | ✅ confirmed |
| No dependency outside pinned list | ✅ confirmed |
| `challenge/*.json` unchanged | ✅ `git diff --stat challenge/` empty |
| Phase report written | ✅ this file |
| Committed + tagged | ✅ `phase-1-complete` |

---

## Verification Checklist

| ID | Description | Result |
|---|---|---|
| P1-01 | Server refuses to start when `challenge/*.json` fails schema validation | ✅ |
| P1-02 | Scoring worked example (768 s, Hint 1, 1 wrong, 0 checks) → 594; clamps; speed bonus; cumulative hints | ✅ |
| P1-03 | Cipher: digit shift with wrap-around and ordering reproduces `transformed_values` and `final_code` | ✅ |
| P1-04 | Status machine: NOT_STARTED→ACTIVE→SOLVED/LOCKED_OUT/EXPIRED; terminal states immutable; start idempotent | ✅ |
| P1-05 | Evidence 04 locked until 01–03 opened; 05 locked until 04 opened; locked → 403, body never sent | ✅ |
| P1-06 | Team entry: new team creates session; same name + right passcode resumes; wrong passcode neutral | ✅ |
| P1-07 | Two teams' sessions are isolated | ✅ |
| P1-08 | Wrong code → DENIED with attempts only; 3rd wrong → LOCKED_OUT; correct → GRANTED | ✅ |
| P1-09 | Duplicate `idempotencyKey` returns original result, consumes no attempt | ✅ |
| P1-10 | Submission after `ends_at` → 409 EXPIRED (test via direct DB clock manipulation) | ✅ |
| P1-11 | Check endpoint: single boolean, cap 3, never per-value info | ✅ |
| P1-12 | Hint text absent from GET /api/session until used; present after | ✅ |
| P1-13 | Leak scan: no response contains `solution.final_code`, transformed values, unused hints, or server.json keys | ✅ |
| P1-14 | State survives fresh process/connection (new Kysely instance, same PGlite/DB) | ✅ |
| P1-15 | Rate limit: 2nd submit within 2 s returns 429; event-code and team-entry also rate-limited | ✅ |
| P1-16 | Concurrent submits → exactly one attempt consumed (row-lock via FOR UPDATE) | ✅ |
| P1-17 | Event access code gate: wrong rejected (403), correct accepted (200) | ✅ |

---

## Architecture Decisions

### Vercel Deployment Approach

Confirmed approach: **Express app exported as a Vercel serverless function.**

- `server/src/index.ts` exports `app` (the Express instance) via `export default app`
- `vercel.json` maps `api/**` → `server/src/index.ts` (treated as a Node.js function)
- `client/` is built as static output routed via `vercel.json`'s `routes` block
- `vercel dev` is the local-production-parity option; `tsx src/index.ts` is the fast dev entry

### Database Layer

- **Production:** Neon PostgreSQL, pooled connection string via `DATABASE_URL`, Kysely + `pg` driver
- **Test:** `@electric-sql/pglite` (in-process WASM Postgres), `PGliteDialect` from `kysely` 0.29+
- Migration applied at test-DB creation time (`001_initial.sql` via `pglite.exec()`)
- `DATABASE_URL` is **never read by the test suite** — `vitest.config.ts` sets a dummy value only to satisfy the `config.ts` zod schema at import time; `createTestDb()` bypasses it entirely

### Rate Limit vs. Game Logic Ordering

Two ordering rules enforced in `server/src/app.ts`:

1. **Submit endpoint:** idempotency pre-check (read-only DB query) happens *before* rate-limit check. Duplicate keys return the cached result without consuming a rate-limit slot. New unique submissions are rate-limited before `submitCode` runs, ensuring no attempt is consumed before the gate.

2. **Check endpoint:** `checkTransformation` (which enforces the 3-check DB cap) runs *before* the per-call rate-limit. A team that has used all 3 checks receives `403 EXHAUSTED`, not `429 RATE_LIMITED`. Rapid-fire abuse is still throttled for non-exhausted sessions.

This design ensures game mechanics (attempt/check caps) always take precedence over anti-abuse rate limits.

### Test Infrastructure

- `server/tests/helpers/testDb.ts`: creates a fresh `PGlite` instance per test, runs migrations, returns a typed `Kysely<Database>` handle — no network, no shared state between test files
- `server/vitest.config.ts` sets `DATABASE_URL` to a dummy string; the real `.env` value is never read
- Tests that would fight the rate limiter (e.g., P1-08 LOCKED_OUT) use direct DB manipulation to set `attempts_used` instead of making rapid HTTP calls — this tests the state machine logic without conflating it with anti-abuse policy

### Files Created

**Root:** `package.json`, `tsconfig.base.json`, `vercel.json`, `.gitignore`

**`shared/`:** schemas (zod for public.json + server.json), `cipher.ts`, `scoring.ts`, `nlp/index.ts`, `index.ts` + tests

**`server/`:** `config.ts`, `db.ts`, `app.ts`, `challenge.ts`, `jsonb.ts`, `api.ts`, `index.ts`, `services/` (team, session, evidence, hint, check, submit, rateLimit), `migrations/001_initial.sql`, `tests/helpers/testDb.ts`, `tests/` (api, expiry, minimal)

**`client/`:** `index.html` (placeholder only — no UI in Phase 1)

---

## Test Run Output (final)

```
Test Files  3 passed (3)
      Tests  32 passed (32)
   Duration  12.33s
```

```
Test Files  3 passed (3)
      Tests  17 passed (17)
   Duration  321ms
```

`node scripts/verify-challenge.mjs` → **ALL CHECKS PASSED**
