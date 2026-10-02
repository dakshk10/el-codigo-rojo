# EL CÓDIGO ROJO — Implementation Plan

Five gated **Build Phases**. Each phase ends with a verification report and a **hard stop** until the organiser replies `PROCEED PHASE N`.

> "Build Phase" (this document) is unrelated to "PHASE 1 // THE ROYAL MINT" (the CODEVERSE event round).

Section references: `PRD §n` = `docs/PRD.md`, `UX §n` = `docs/UI_UX.md`.

---

## 0. Read-only Inputs (never modify)

| Path | Purpose |
|---|---|
| `challenge/public.json` | Player-facing evidence, unlock graph, duration |
| `challenge/server.json` | Private facts, solution, hint text, scoring constants |
| `challenge/teams.json` | Read-only team ID mapping `{ "Team Name": "T01", ... }` provided by gateway organiser |
| `scripts/verify-challenge.mjs` | Must pass at every phase: `node scripts/verify-challenge.mjs` |


## 1. Target Repository Layout

```text
el-codigo-rojo/
  package.json                # npm workspaces: shared, server, client
  tsconfig.base.json          # strict: true, noUncheckedIndexedAccess: true
  vercel.json                 # build/routing config for static client + Functions
  challenge/                  # read-only inputs (see above)
  scripts/                    # verify-challenge.mjs, load-test.mjs (Phase 5)
  docs/                       # PRD.md, UI_UX.md, IMPLEMENTATION_PLAN.md, PHASE_REPORTS/, ORGANISER_RUNBOOK.md (Phase 5)
  shared/src/                 # zod schemas, scoring, cipher, nlp/ (pure functions, no I/O)
  server/
    migrations/                # plain SQL, applied in order, against Neon
    src/                       # config, db (pooled Neon client), challenge loader, routes, services
  client/src/                 # app, views, components, store, api, styles
```

Rules: files ≤ 300 lines (tests excepted); one responsibility per file; no barrel-file sprawl; no dead code; no `any`; no `console.log` in `src`.

## 2. Global Definition of Done (applies to every phase)

- [ ] `npm run typecheck` passes with zero errors (all workspaces)
- [ ] `npm test` passes (all workspaces)
- [ ] `node scripts/verify-challenge.mjs` prints `ALL CHECKS PASSED`
- [ ] No `TODO`, `FIXME`, placeholder text, lorem ipsum, mock data, or commented-out code in `src`
- [ ] No dependency outside the pinned list (PRD §18) was added
- [ ] `challenge/*.json` unchanged (`git diff --stat challenge/` empty)
- [ ] Verification report written to `docs/PHASE_REPORTS/phase-N.md` in the required format
- [ ] Work committed; git tag `phase-N-complete` created

## 3. API Contract (built across phases; stable once introduced)

All game routes derive the session from the httpOnly cookie. Request bodies are validated with `zod`. Errors are `{ "error": "CODE", "message": "..." }` with a fitting HTTP status. **No response ever contains data from `server.json` except hint text after a hint is used.**

| Method + Path | Phase | Purpose |
|---|---|---|
| `GET /api/health` | 1 | Liveness |
| `POST /api/teams/enter` `{teamName, passcode}` | 1 | Create team+session or resume; sets cookie |
| `GET /api/session` | 1 | Session snapshot (below) |
| `POST /api/session/start` | 1 | BEGIN HEIST, idempotent |
| `GET /api/evidence/:id` | 1 | Evidence tokens if unlocked; records "opened"; `403 LOCKED` otherwise |
| `POST /api/session/hints/:n/use` `{confirm:true}` | 1 | Apply hint, return its text |
| `POST /api/session/check` `{values:[s,s,s]}` | 1 | Capped transformation check → `{valid, checksRemaining}` |
| `POST /api/session/submit` `{code, idempotencyKey}` | 1 | Final code |
| `PUT /api/session/workspace` `{...}` | 3 | Save opaque workspace (notes, marks, reviewed, board, scratchpad) |
| `GET /api/admin/leaderboard` | 5 | Admin table (`x-admin-token`) |
| `POST /api/admin/sessions/:teamId/reset` | 5 | Reset a session |
| `GET /api/admin/export.csv` | 5 | CSV export |

**Session snapshot (`GET /api/session`):**

```json
{
  "status": "NOT_STARTED|ACTIVE|SOLVED|EXPIRED|LOCKED_OUT",
  "serverNow": 0, "endsAt": null, "durationSeconds": 900,
  "team": { "name": "" },
  "evidence": [ { "id": "01", "ordinal": 1, "title": "", "unlocked": true, "opened": false } ],
  "hints": [ { "id": 1, "title": "", "penaltyPercent": 5, "used": false, "text": null } ],
  "attemptsRemaining": 3, "checksRemaining": 3,
  "workspace": {},
  "result": null
}
```

`result` is non-null only in terminal states: `{ score, elapsedSeconds, hintsUsed, wrongAttempts, checksUsed, speedBonus }` (score `0` for `EXPIRED` / `LOCKED_OUT`). Locked evidence titles are returned as `ENCRYPTED` placeholders only if the UX spec requires; bodies never.

**Submit responses:** `{ "result": "GRANTED", "session": {...} }` or `{ "result": "DENIED", "attemptsRemaining": n }` — nothing else about correctness, ever. After expiry: `409 EXPIRED`. Repeated `idempotencyKey`: original response, no extra attempt consumed.

---

## PHASE 1 — Foundation & Game Engine (server + shared, no UI)

**Goal:** a complete, tested, server-authoritative game engine behind the API above. No UI beyond a placeholder page.

**Read only:** PRD §7, §11–§15, §18–§22; this plan §0–§3.

**Build**

1. npm workspaces scaffold, strict TypeScript, `typecheck` and `test` scripts, Vitest and Supertest wired. A `vercel.json` (or framework-detected config) that builds `client` as static output and `server` as a Vercel Function. Confirm current Vercel support for an Express app exported as a Node function (or the equivalent adapter) before writing server code, and record the confirmed approach in the phase report.
2. `shared`: `zod` schemas for `public.json` and `server.json`; pure `scoring` (PRD §12); pure `cipher` (digit shift with wrap, ordering); minimal `nlp/tokenise` producing stable token ids (`t0`, `t1`, …) with `text`, `start`, `end`, `line`, `kind`.
3. `server`: config (`DATABASE_URL`, `ADMIN_TOKEN`, `EVENT_CODE` from environment), Postgres connection via a pooled Neon connection string, SQL migrations and a typed query layer (PRD §20), challenge loader that **refuses to start** on schema failure, event-access-code gate, team entry with scrypt-hashed passcode and an `httpOnly`/`Secure`/`SameSite=Lax` cookie, session service with the status machine (PRD §13) using database timestamps (`now()`), unlock rules (PRD §7), evidence delivery as tokens, hint service, capped check service (30 s scoring penalty), submit service (attempts, idempotency, constant-time compare, lazy expiry, row-locked against concurrent requests for the same session), rate limiting backed by a database table rather than in-memory state.
4. A local dev entry point (`tsx` + a thin server wrapper) so the API is runnable and testable without deploying; `vercel dev` documented as the closer-to-production alternative.

**Do NOT build:** any real UI, admin endpoints, NLP search, board persistence, an actual Vercel deployment (that happens naturally as you push, but standing up the project/env vars is a Phase 5 checklist item to confirm, not a Phase 1 deliverable).

**Verification checklist**

| ID | Check |
|---|---|
| P1-01 | Server refuses to start when `challenge/*.json` fails schema validation (test) |
| P1-02 | Scoring worked example (768 s, Hint 1, 1 wrong attempt, 0 checks) returns exactly **594**; clamps at 0.60; speed bonus at < 450 s; cumulative hints ≈ 0.727 (tests) |
| P1-03 | Cipher: applying the digit shift (with wrap-around) and the ordering rule to `solution.extracted_values` reproduces `solution.transformed_values` and `solution.final_code` from `server.json`; wrap-around and ordering each tested. Tests read the values from `server.json`; answer literals are never copied into docs, fixtures or client code |
| P1-04 | Status machine: NOT_STARTED→ACTIVE→SOLVED / LOCKED_OUT / EXPIRED; terminal states immutable; start is idempotent |
| P1-05 | Evidence 04 locked until 01–03 opened, 05 locked until 04 opened; locked → `403`, body never sent (API test) |
| P1-06 | Team entry: new team creates one session; same name + right passcode resumes; wrong passcode rejected neutrally; second session impossible, including when the two creation requests race each other |
| P1-07 | Two teams' sessions are isolated (API test) |
| P1-08 | Wrong code → `DENIED` with attempts only; 3rd wrong → `LOCKED_OUT`; correct → `GRANTED` |
| P1-09 | Duplicate `idempotencyKey` returns the original result and consumes no attempt |
| P1-10 | Submission after `ends_at` → `409 EXPIRED` (test using an injectable/database clock) |
| P1-11 | Check endpoint: single boolean, cap 3, adds 30 s scoring penalty, never per-value info |
| P1-12 | Hint text absent from `GET /api/session` until used; present after; never contains answer values |
| P1-13 | **Leak scan test:** across every endpoint and state, no response contains `solution.final_code`, any transformed value, any unused hint text, or any `server.json` key (values read from `server.json` at test time) |
| P1-14 | State survives a fresh process/connection (test re-opens the DB pool, simulating a new serverless instance) |
| P1-15 | Rate limit: 2nd submit within 2 s of the 1st returns `429`; event-access-code and team-entry guessing are also rate-limited |
| P1-16 | Two concurrent submit requests for the same session (simulated race) result in exactly one attempt consumed, proven with a row-lock or transaction test |
| P1-17 | Event access code gate: wrong code rejected, correct code required before team entry proceeds |

---

## PHASE 2 — NLP Layer & Client Foundation

**Goal:** the shared NLP utilities, and a client shell that can enter a team, show the briefing, begin the heist and display a correct server-driven timer.

**Read only:** PRD §9, §13; UX §1–§5, §14, §19–§21, §24–§25; this plan §3.

**Build**

1. `shared/nlp`: normalisation (lowercase, punctuation cleanup), stopword list, TF-IDF index and ranked search over token text, helpers to turn a token range into an entity draft. **No alias or synonym expansion.** Pure, deterministic, tested.
2. Client scaffold: Vite + React + Tailwind, **self-hosted** fonts via `@fontsource`, all colour tokens from UX §24 as CSS variables, Tailwind theme mapped to tokens, accessible red rules honoured.
3. API client (relative URLs, typed against `shared` schemas), Zustand store, session polling (15 s + on focus), server-time offset, reconnect with backoff and `ReconnectBanner`.
4. Views: event access code gate (UX §4, Screen 00a), `TEAM_ENTRY` (UX §4, Screen 00b), `BRIEFING` (UX §5). Hash routing. Toast and Modal primitives with focus trapping.
5. `Timer` component: all four states, one-time `10:00` toast, pulse rules, `aria` announcements only at 10:00 / 05:00 / 01:00 / 00:00 (UX §14).

**Do NOT build:** control room, evidence viewer, board, cipher, keypad, results, admin.

**Verification checklist**

| ID | Check |
|---|---|
| P2-01 | NLP tests: normalisation, stopwords, stable token ids across runs, TF-IDF ranking on the real `public.json`, and proof that search performs **no alias or synonym expansion** (test one alias pair and one synonym pair taken from `server.json`) |
| P2-02 | Event access code and team entry screens match UX §4 copy and validation rules; wrong-code and wrong-passcode messages are both neutral |
| P2-03 | Briefing copy matches UX §5 exactly; `BEGIN HEIST` starts the server timer once |
| P2-04 | Timer derives from `endsAt` + server offset; changing the browser clock does not change the display (test with fake timers) |
| P2-05 | Timer thresholds: normal / 10:00 toast / warning at 05:00 / critical at 01:00 / expired at 00:00; reduced-motion respected |
| P2-06 | Timer announces to assistive tech only at the four thresholds, not each second |
| P2-07 | Refresh restores view and timer; killing the network shows `SIGNAL LOST // RECONNECTING` and recovers |
| P2-08 | Fonts and assets load with **no external network request** (Playwright request log or network audit) |
| P2-09 | Token values match UX §24; `--red` / `--red-bright` are never used for small text |
| P2-10 | Production build has no reference to `server.json` content (grep of `client/dist`) |

---

## PHASE 3 — Control Room & Investigation Tools

**Goal:** the main investigation workspace: read all evidence, mark entities, take notes, search, use hints, and never lose work.

**Read only:** UX §6–§8, §13, §17, §19, §22–§23; PRD §7, §11; this plan §3.

**Build**

1. Control Room layout (UX §6): top bar (title, phase line, timer, projected score display-only), evidence rail with `locked / unread / opened` and the player-controlled **reviewed** toggle, main panel, right panel, bottom navigation.
2. `TokenizedDocument`: renders server tokens; mouse, shift-click and keyboard range selection; the selection menu `MARK / LINK / NOTE`; entity type chosen **by the player** (person / alias / location / date / number / event). **No automatic highlighting of clues.**
3. Metadata drawer, evidence search UI (ranked results, jump-to-passage), pinned clues / extracted entities / team notes panel.
4. Hint drawer (UX §13): confirmation modal with the exact copy, `USED` state, text persists.
5. `PUT /api/session/workspace`: debounced saves, opaque JSON, 128 KB combined cap, size-error handling. Restore on refresh and on a second device.
6. Locked-file states and copy per UX §6 / §22.

**Do NOT build:** the board canvas (Phase 4), cipher terminal, keypad, results, admin.

**Verification checklist**

| ID | Check |
|---|---|
| P3-01 | Files 01–03 open at start; 04 and 05 show the correct `ENCRYPTED — …` copy until unlocked; unlocking happens after the server records the opens |
| P3-02 | Evidence renders faithfully from tokens (rendered text equals `public.json` body) |
| P3-03 | Range selection works by mouse, shift-click and keyboard; menu shows `MARK / LINK / NOTE`; no clue is highlighted automatically |
| P3-04 | Marks, notes and reviewed toggles persist across refresh and across a second browser session for the same team |
| P3-05 | Workspace over 128 KB is rejected gracefully with a visible, non-blocking message |
| P3-06 | Hint confirm modal text matches UX §13; cancel applies nothing; confirm applies multiplier server-side and shows text; used hint stays visible after refresh |
| P3-07 | Search ranks results by TF-IDF and shows no alias or synonym expansion |
| P3-08 | Projected score display equals the shared scoring function and is labelled as a projection |
| P3-09 | Keyboard-only path exists for: open a file, select a range, mark it, add a note, open the hint drawer |
| P3-10 | 1280×720 and 1920×1080: timer visible without scrolling; three-column layout intact; long documents scroll inside the main panel |

---

## PHASE 4 — Board, Cipher Terminal, Vault & Results

**Goal:** the endgame: board, cipher terminal, keypad, and the success / timeout / lock-out results.

**Read only:** UX §9–§12, §15, §17, §20–§22; PRD §11–§13, §15; this plan §3.

**Build**

1. Evidence Board with **`@xyflow/react`**: cards from marked evidence or manual, labelled edges (`SEEN AT`, `SCHEDULED ON`, `MENTIONED BY`, `CONNECTED TO`), `UNDO`, `CLEAR BOARD` with confirmation, `LINKS MADE` counter, **`ADD LINK` form and Link List** as the non-pointer path. **No snapping, no correctness signal, no target count.** Persist through the workspace endpoint.
2. Cipher Terminal (UX §10): shows file `05` text, scratchpad, `CHECK TRANSFORMATION` with `CHECKS REMAINING`, confirmation before first use stating the 30 s scoring cost, single `VALID / NOT VALID` result.
3. Vault Keypad (UX §11–§12): six-digit display, on-screen keypad plus physical keyboard entry, `BACKSPACE / CLEAR / ENTER CODE`, `ATTEMPTS REMAINING`, shake on denial, `ACCESS DENIED / SEQUENCE REJECTED`, `ACCESS GRANTED / VAULT BREACHED` transition, idempotency key per submission, disable on submit, no partial feedback.
4. Result screens (UX §15): success (server score and breakdown), timeout `VAULT SEALED`, lock-out; never show the code; auto-navigate when the server reports a terminal status.
5. Motion per UX §20 with `prefers-reduced-motion` alternatives; animations never block input.

**Do NOT build:** admin, load tests, runbook.

**Verification checklist**

| ID | Check |
|---|---|
| P4-01 | Board is built on React Flow; links are creatable by drag **and** by `ADD LINK`; Link List mirrors the canvas |
| P4-02 | Correct and incorrect links are visually indistinguishable; no snap, glow, sound or target count anywhere in code (search for it) |
| P4-03 | Board, links and cipher scratchpad restore after refresh |
| P4-04 | `CHECK TRANSFORMATION`: the three `solution.transformed_values` in any order → `VALID`; any other set → `NOT VALID`; never per-value; disabled at 0; each use raises the scoring penalty |
| P4-05 | Keypad rejects non-digits, max 6 digits, empty submit blocked, browser autocomplete off, physical keyboard works |
| P4-06 | Wrong code: shake, cleared digits, attempts decrement, copy exactly per UX §12; nothing reveals partial correctness |
| P4-07 | Third wrong code → lock-out screen; correct code → success screen with the **server** score |
| P4-08 | Double-click on ENTER and a retried request consume at most one attempt |
| P4-09 | Timeout while on any screen → `VAULT SEALED` and input locked; late submit rejected |
| P4-10 | Result screens never display the code; failure score shows `0` |
| P4-11 | `prefers-reduced-motion` disables shake and unlock animation; keypad response < 100 ms |
| P4-12 | End-to-end happy path with the real code (read from `server.json` in test setup, never hard-coded) works in a Playwright test |

---

## PHASE 5 — Admin, Hardening, Accessibility, E2E & Vercel Readiness

**Goal:** make it runnable and safe at the event, live on Vercel, for up to 20 teams.

**Read only:** PRD §15, §17, §19, §22, §23; UX §16, §19, §26; this plan §3.

**Build**

1. Admin API and screen (PRD §17, UX §16): token-protected leaderboard, live status, reset with confirmation, CSV export. Token entered at runtime.
2. Stand up the actual Vercel project: connect the repository, add the Neon integration from the Vercel Marketplace (wiring `DATABASE_URL` automatically), set `ADMIN_TOKEN` and `EVENT_CODE` as environment variables, run migrations against Neon, and deploy to a preview URL.
3. Load test script `scripts/load-test.mjs`, run against the **live preview URL**: 20 concurrent sessions polling, opening evidence, using hints, submitting; asserts isolation and reports p95 latency.
4. Playwright suite, run against the **live preview URL**: refresh persistence, wrong / correct / timeout flows, two-team isolation, third-party request audit.
5. Bundle leak test: build the client, scan the static output (including source maps) for the final code, transformed values, hint text and `server.json` keys.
6. Accessibility pass: focus states, modal focus traps, keyboard paths, contrast per UX §24, timer announcements.
7. Production packaging: `npm run build` produces the deployable client + server; confirm `vercel.json` (or framework detection) builds correctly; session cookies use `Secure`; confirm a rollback to a previous deployment works.
8. `docs/ORGANISER_RUNBOOK.md`: creating/configuring the Vercel project, connecting Neon, setting environment variables, running migrations, deploying and rolling back, resetting a team, exporting results, sharing the event access code and URL with teams, what to do if a deploy fails mid-event.

**Verification checklist**

| ID | Check |
|---|---|
| P5-01 | Admin endpoints reject a missing or wrong token; admin UI never shows solution or hint text |
| P5-02 | Leaderboard orders by score then completion time; reset returns a team to `NOT_STARTED` and keeps name and passcode |
| P5-03 | CSV export contains the expected columns and no passcodes |
| P5-04 | Load test against the live preview: 20 concurrent sessions, zero cross-session leakage, p95 latency reported and acceptable |
| P5-05 | Playwright against the live preview: refresh persistence (timer, unlocks, hints, attempts, workspace), wrong / correct / timeout flows, two-team isolation |
| P5-06 | Leak scan of the built client and source maps is clean |
| P5-07 | Third-party audit: zero requests to any host other than the deployment itself during a full playthrough |
| P5-08 | Keyboard-only playthrough is possible; focus visible; modals trap and restore focus |
| P5-09 | A fresh deployment from a clean checkout succeeds on Vercel, migrations run cleanly against Neon, and the app is reachable at its preview/production URL |
| P5-10 | Runbook exists and its steps were followed once by the agent on the actual deployment |
| P5-11 | **Final acceptance matrix:** every PRD §23 criterion mapped to a test, script, or "organiser to verify" |
| P5-12 | Event access code gate works end-to-end on the live deployment; guessing it is rate-limited |
| P5-13 | Simulated Neon cold start (first request after idling) still completes correctly, just possibly slower; the client's loading state covers it |

---

## 4. Verification Report Format (`docs/PHASE_REPORTS/phase-N.md`)

```markdown
# Phase N Verification Report
## Summary
(3 sentences max: what was built, what is not done)

## Checklist
| ID | Requirement | Result | Evidence (test name / command / file:line) |
|----|-------------|--------|--------------------------------------------|
| PN-01 | ... | PASS / FAIL / PARTIAL | ... |

## Global Definition of Done
| Item | Result | Evidence |

## Deviations
(Anything that differs from the spec, and why. "None" if none.)

## Known limitations / risks
## Commands to reproduce
```

Rules: a requirement is **PASS** only with concrete evidence that was actually executed. If anything is FAIL or PARTIAL, fix it and re-verify **before** stopping, or clearly list it and ask the organiser whether to proceed. Never mark PASS from reading code alone when a test can run.
