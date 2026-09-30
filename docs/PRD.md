# CODEVERSE 2.0 — EL CÓDIGO ROJO

## Product Requirements Document (PRD) — v2
**Phase 1 — The Royal Mint**  
**Game Type:** NLP + Logic + Cryptography  
**Working Tagline:** *One code. Five files. Zero mistakes.*

---

# 1. Product Summary

**El Código Rojo — The Red Code** is a timed digital vault-investigation game for CODEVERSE 2.0.

Teams enter a fictional Royal Mint control terminal and investigate a set of intercepted documents. The documents contain names, locations, dates, numbers, aliases, relationships, and deliberate misinformation.

Players must:

1. Extract relevant entities from natural-language evidence.
2. Resolve aliases and connect related evidence.
3. Eliminate red herrings through cross-document reasoning.
4. Identify the correct numeric values.
5. Apply a basic but discoverable cipher.
6. Determine the correct ordering.
7. Enter the final six-digit vault code.

The game should feel like an **investigation under pressure**, not a conventional coding question.

### Key Design Principle

NLP is not merely decorative.

The intended solve should genuinely require players to perform NLP-style reasoning such as:

- Entity extraction
- Alias / reference resolution
- Semantic clue matching
- Relationship discovery
- Cross-document consistency checking

The implementation can use deterministic NLP utilities rather than a live LLM so the challenge remains reliable during a live event.

---

# 2. Goals

- Create a **moderate-to-hard** first-qualifier challenge.
- Reward teamwork, careful reading, logical reasoning, pattern recognition, and speed.
- Make NLP materially relevant to the solution.
- Build a strong Money Heist-inspired atmosphere.
- Produce one deterministic correct solution with automatic validation.
- Keep the game reliable under multiple simultaneous teams.
- Make all core challenge content configurable without rewriting the UI.
- Give Antigravity enough detail to build the game without inventing the core mechanics.

---

# 3. Non-Goals

- Players do not need to train an ML model.
- Final answers should not be judged by a free-form LLM.
- Gameplay should not depend on external APIs.
- The cryptography should not require advanced mathematical knowledge.
- Players should not need Google/search engines to discover the intended answer.

---

# 4. Target Experience

| Attribute | Requirement |
|---|---|
| Audience | College hackathon / coding-event teams |
| Recommended Team Size | 2–4 |
| Target Playtime | 12–18 minutes |
| Recommended Timer | 15 minutes |
| Difficulty | Moderate → Hard |
| Primary Skills | NLP-style text analysis, logic, pattern recognition, basic cryptography |
| Secondary Skills | Collaboration, attention to detail, speed |
| Tone | Tense, cinematic, secretive, intelligent, slightly playful |
| Win Condition | Correct final vault code |
| Failure Condition | Timer expires or final attempts are exhausted |
| Deployment | Public HTTPS URL on Vercel, backed by Neon Postgres; players join with any internet-connected device |
| Concurrency | Up to 20 teams (10 typical) |

---

# 5. Core Game Loop

### Step 1 — Briefing

The Professor's terminal explains that the Royal Mint vault has been isolated and the crew has one short window to access it.

### Step 2 — Evidence Acquisition

Players unlock **4–5 classified evidence files**.

### Step 3 — Extraction

Each file contains a different class of useful information mixed with deliberate noise.

### Step 4 — Cross-Reference

Teams compare entities and relationships across files to identify the valid chain.

### Step 5 — Transformation

The validated values are transformed using the cipher instruction hidden in the evidence.

### Step 6 — Ordering

A final narrative clue determines the order of the transformed values.

### Step 7 — Vault Entry

The team submits a **6-digit code** using the vault keypad.

### Step 8 — Scoring

The final score depends on correctness, time, attempts, and hints.

---

# 6. Proposed Challenge Structure

Use **five evidence files**.

The game content should be stored in a challenge configuration so organisers can create multiple versions without changing the application.

| File | Player-Facing Content | NLP / Logic Role | Expected Output |
|---|---|---|---|
| `01` — Intercepted Transcript | Conversation between aliases | Named-entity extraction + alias resolution | Identify relevant person / alias |
| `02` — Shift Manifest | Royal Mint shift notes containing dates, rooms and events | Entity matching + relationship extraction | Identify relevant date/location |
| `03` — Newspaper Fragment | Noisy article with red herrings | Semantic clue matching / keyword weighting | Identify keyword / number |
| `04` — Evidence Photograph Log | Evidence descriptions + timestamps | Cross-document consistency | Confirm candidate value |
| `05` — Professor's Cipher Note | Cryptic transformation instruction | Pattern recognition + basic cipher | Transformation + ordering rule |

### Authored Challenge Content

The five evidence files, aliases, decoys, cipher and solution are **already authored** and supplied in:

- `challenge/public.json` — player-facing evidence, safe to serve
- `challenge/server.json` — private facts, cipher, solution, hint text, scoring parameters (**server only**)
- `scripts/verify-challenge.mjs` — deterministic solver and consistency checker

Implementers must **not** rewrite, paraphrase, "improve" or regenerate this content. Any content change goes through the organiser and must pass `node scripts/verify-challenge.mjs`.

---

# 7. Evidence Unlock Rules

Unlocking is **progress-based, never answer-based**. No unlock depends on whether a player's clue, link or guess is correct, because that would create a hidden correctness oracle.

| File | Unlock condition |
|---|---|
| `01` Intercepted Transcript | Open at session start |
| `02` Shift Manifest | Open at session start |
| `03` Newspaper Fragment | Open at session start |
| `04` Evidence Photo Log | Unlocks after files `01`, `02` and `03` have each been **opened** at least once |
| `05` Professor's Cipher Note | Unlocks after file `04` has been **opened** at least once |

Rules:

- "Opened" is recorded **server-side** when the client requests the evidence body. It is never a client-only flag.
- The server never sends the body of a locked file. A locked file is represented only by its id, ordinal and the locked label.
- Unlock state persists across refresh and reconnect.
- The unlock graph lives in `challenge/public.json` (`unlock.requires_opened`) and must be acyclic; `scripts/verify-challenge.mjs` checks this.
- "Completed" in the evidence rail is a **player-controlled "reviewed" toggle** for team bookkeeping. It has no effect on unlocks or scoring.

---

# 8. Detailed Solve Logic

The intended solve path should approximately follow this structure:

1. Extract candidate **people, places, dates and numbers** from the evidence.
2. Notice that some entities appear under **aliases or alternate references**.
3. Use relationships such as **person → room → date** to eliminate red herrings.
4. Identify the required numeric tokens.
5. Apply the cipher instruction from the Professor's note.
6. Apply the final ordering rule.
7. Enter the resulting six-digit code.

### Important Fairness Rule

Difficulty should come from:

- cross-document reasoning,
- noise,
- aliases,
- relationship discovery,
- and combining multiple clues.

Difficulty should **not** come from requiring obscure cryptographic knowledge.

The cipher must be discoverable from the evidence.

The authored challenge's full solve walkthrough is kept in the organiser-only solution key and is not part of this specification.

---

# 9. NLP Requirements

The NLP layer should be deterministic and reproducible.

### Recommended Techniques

- Tokenization and text normalization
- Lowercasing
- Punctuation cleanup
- Stopword removal
- Named-entity extraction
- Person / location / date / number identification
- Alias resolution using a configured alias map
- TF-IDF or weighted keyword similarity
- Semantic clue matching
- Entity co-occurrence
- Relationship matching
- Limited fuzzy matching where explicitly intended

### Important Implementation Rule

Do **not** use fuzzy matching for final answer validation.

The server should validate the final code using deterministic rules.

### Recommended Architecture

NLP assists with:

- evidence processing,
- clue discovery,
- entity highlighting,
- relationship identification,
- optional clue-search behaviour.

The final answer must still be validated using a server-authoritative deterministic solution.

### Where the NLP Runs (v2 clarification)

| Concern | Runs on | Notes |
|---|---|---|
| Normalisation, tokenisation with stable token ids | Server, once per evidence file at load | The client receives `tokens[]` (id, text, start, end, line), not the raw solution |
| Evidence search (TF-IDF ranking, stopword removal, normalisation) | Client, over already-delivered unlocked evidence | Lexical only. **No alias expansion and no synonym expansion** — the search must not solve the alias or the red/scarlet gap for the player |
| Range selection into entity chips (person / place / date / number) | Client | The player chooses the entity type; the app does not auto-classify or auto-highlight |
| Alias map, relations, solution | Server only | Never sent to any client |

The shared NLP utilities live in `shared/nlp` and are pure functions with unit tests. The intended solve still requires human NLP-style reasoning: entity extraction, alias resolution, relationship discovery, and semantic matching across documents.

---

# 10. Difficulty Design

| Layer | Moderate Version | Hard Version |
|---|---|---|
| Evidence | 4 files, limited noise | 5 files, 25–40% irrelevant details |
| Entity Extraction | Distinct names / dates | Aliases + repeated distractor entities |
| Cross-Reference | One obvious overlap | Two-step relationship chain |
| Cipher | Single transformation | Transformation + ordering |
| Final Code | 6 digits | 6 digits + decoy numerical values |
| Hints | 2–3 hints | 3 hints with meaningful deductions |

### Recommended Event Version

Use the **Hard Version** for experienced teams, while keeping the intended solution path recoverable within approximately **15 minutes**.

---

# 11. Hint System

Hints help players progress without giving away the answer.

| Hint | Reveals | Score effect |
|---|---|---|
| Hint 1 — Read Between the Lines | Which kinds of evidence carry the numbers | × 0.95 |
| Hint 2 — Follow the Connection | How the alias and the shift swap resolve | × 0.90 |
| Hint 3 — The Professor's Rule | How the cipher shift is derived | × 0.85 |

Rules:

- Hint **text is stored server-side** (`challenge/server.json`) and delivered only after the hint has been confirmed and used. It is never present in the initial page payload.
- Hints must **never** contain a final digit, an extracted value or a transformed value. `scripts/verify-challenge.mjs` enforces this.
- Hints can be used in any order. Each is applied **once** and the multiplier is applied immediately and recorded in session state.
- Multipliers are **cumulative**: using all three gives × 0.95 × 0.90 × 0.85 ≈ 0.727 (a 27.3% total reduction, not 30%). UI copy says "reduced by X%" because each hint reduces the *current* score by that percentage.
- A confirmation dialog is required before any hint is applied.

---

# 12. Scoring

**Canonical formula (server-authoritative, computed once on a correct submission):**

```text
elapsed        = seconds from BEGIN HEIST to the accepted submission (server clock)
effective      = min(duration, elapsed + check_penalty_seconds × checks_used)
T (time)       = max(0.60, 1.00 − 0.40 × effective / duration)          duration = 900
H (hints)      = product of used hint multipliers  (0.95, 0.90, 0.85)
A (attempts)   = 0.95 ^ wrong_attempts                                   wrong_attempts ∈ {0, 1, 2}
score          = round(1000 × T × H × A) + speed_bonus
speed_bonus    = +50 if effective < 0.5 × duration (before 07:30), else 0
```

- Incorrect final code → no score for that submission; it consumes an attempt and costs the `A` term.
- Maximum final attempts: **3**. Exhausting them sets the session to `LOCKED_OUT`.
- Timeout or lock-out → score `0`.
- Maximum possible score: 1050 (solved before 07:30, no hints, first attempt).
- Every constant lives in `challenge/server.json → scoring`; nothing is hard-coded in the engine.

**Worked example (also used in the UI result screen):** solved at 12:48 (768 s), 1 hint (Hint 1), 1 wrong attempt, 0 checks:
`T = 1 − 0.40 × 768/900 = 0.6587`, `H = 0.95`, `A = 0.95` → `1000 × 0.6587 × 0.95 × 0.95 = 594.45` → **594**, no speed bonus.

If CODEVERSE already has a global scoring system, normalise this game internally to the 1000 base and let the event backend convert it.

---

# 13. Timer, Session State & Persistence

### Timer

- The timer starts only when the server processes **BEGIN HEIST**.
- Duration: **15 minutes** (`900 s`), from `challenge/public.json`.
- Warning states:
  - `10:00` remaining — one-time informational toast, no colour change.
  - `05:00` remaining — **Warning** state.
  - `01:00` remaining — **Critical** state.
  - `00:00` — **Expired**: answer submission is locked.
- The server stores `started_at` and `ends_at`, both taken from the **database clock** (`now()`), not from an individual function instance's clock. The client computes its display from `server_now − client_now` measured on each fetch, so a wrong device clock — or two different Vercel function instances with slightly different clocks — cannot change the timer.
- The **server timestamp decides** whether a submission counts. A submission received after `ends_at` is rejected with `EXPIRED`.
- Refresh must not reset the timer, evidence unlock state, hints used, notes, board, checks used or attempts.

### Session Status (server-side state machine)

```text
NOT_STARTED ──BEGIN HEIST──▶ ACTIVE ──correct code──────▶ SOLVED
                               │
                               ├──3rd wrong attempt───────▶ LOCKED_OUT
                               └──now ≥ ends_at───────────▶ EXPIRED
```

- `SOLVED`, `EXPIRED` and `LOCKED_OUT` are terminal. Only an organiser reset can leave them.
- Expiry is evaluated **lazily on every request** (no background timer is required for correctness).
- `BEGIN HEIST` is idempotent: repeating it never restarts the timer.

### Client Views (UI state, not persisted as game state)

`TEAM_ENTRY`, `BRIEFING`, `CONTROL_ROOM`, `EVIDENCE`, `BOARD`, `CIPHER`, `VAULT`, `RESULT`, `ADMIN`. These are screens; the authoritative game state is the session status above.

---

# 14. Team Identity & Sessions

The game is reachable at a **public URL**, so every player device needs an identity and a session, and the entry gate has to do more work than it would on a closed LAN.

- **Event access code:** a single code (from `EVENT_CODE` in the environment) is required once per browser before team entry is shown. It is checked server-side and is never present in client-side environment variables or the bundle.
- **Team entry:** team name (3–24 chars, letters, digits, spaces, hyphens; unique case-insensitively) plus a **4-digit team passcode** chosen by the team.
- **First entry** creates the team and one session in `NOT_STARTED`.
- **Re-entry** with the same name and correct passcode **resumes the same session** on any device. A wrong passcode is rejected with a neutral message.
- **One session per team.** A team can never start a second session; only an organiser reset can restart it.
- The passcode is hashed with Node's built-in `crypto.scrypt` and a per-team salt. It is never stored or logged in plain text.
- **Guessing is rate-limited** at the database level: both the event-code check and team-entry passcode checks are capped (for example 10 attempts per 10 minutes per IP), because a 4-digit passcode and a short event code are both guessable given enough tries against a public URL.
- The server issues a **`httpOnly`, `Secure`, `SameSite=Lax`** session cookie after entry (`Secure` because Vercel serves HTTPS). All game endpoints derive the session from the cookie, never from a client-supplied session id.
- No other player data is collected. There are no accounts or emails.
- Two teams can never see each other's state: every query is scoped by the session id from the cookie.

---

# 15. Anti-Cheat & Fairness

**Security through obscurity is not enough. The server is authoritative for the timer, unlocks, hints, checks, attempts, scoring and final validation.**

What the client may receive:

- Evidence text for **unlocked** files only, as `tokens[]` with stable ids.
- Its own session state (status, `ends_at`, server time, unlocked ids, hints already used *with* their text, attempts remaining, checks remaining, notes, board).

What the client must **never** receive, at any time, in any payload, source map, bundle, log line or error message:

- `challenge/server.json` in any form (facts, aliases, relations, cipher parameters, solution, transformed values, unused hint text).
- The final code, in plain or hashed form.
- Any indication of *which* digit, *how many* digits, or *which half* of a submission is correct.

Controls:

- `challenge/server.json` is loaded only by server-side code, is never imported by anything under `client/`, and is confirmed absent from the built client bundle by an automated check (PRD §16, P5-06).
- **Final submissions:** max 1 per 2 seconds per session, idempotent via an idempotency key, validated with a constant-time comparison. The rate limit and the idempotency record live in the database, not in server memory, because a serverless function has no memory shared with the next invocation.
- **`CHECK TRANSFORMATION`:** returns a single `VALID / NOT VALID` for the whole set, never per value; **hard-capped at 3 uses per session**; each use adds 30 s to the *scoring* time (not to the countdown); rate-limited like submissions.
- **Concurrent requests for the same session** (for example a double-tap on `ENTER CODE`, or two team devices submitting at once) are serialised with a database-level row lock (`SELECT ... FOR UPDATE` on the session row) inside a transaction, so two simultaneous requests can never both consume an attempt or both apply the same hint twice.
- **Evidence board and notes** are stored as opaque player data. The server never evaluates board correctness, and the UI never signals correctness (no snapping, no "correct" cue, no target link count).
- Browser autocomplete is disabled on all answer fields (`autocomplete="off"`, `inputmode="numeric"`).
- Later evidence is never served before its unlock condition.
- All rate limits and caps live in `challenge/server.json → scoring` or server environment config, not in the client.
- `ADMIN_TOKEN`, `EVENT_CODE` and `DATABASE_URL` are set as Vercel environment variables and are never referenced with the `NEXT_PUBLIC_`-style client-exposed prefix pattern of the chosen frontend tooling.

**Deferred to a later version (by decision):** unique challenge seeds per team. This version ships one fixed, fully verified challenge so that it can be playtested against a single known solution.

---

# 16. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Landing / briefing screen with `BEGIN HEIST` | Must |
| FR-02 | Persistent, server-authoritative 15-minute countdown | Must |
| FR-03 | Five classified evidence files with server-enforced unlock rules | Must |
| FR-04 | Evidence search (TF-IDF) and player-driven entity marking | Should |
| FR-05 | Cross-reference notes workspace and evidence board (React Flow) | Should |
| FR-06 | Three-hint system with confirmation and cumulative multipliers | Must |
| FR-07 | Six-digit vault keypad | Must |
| FR-08 | Three final attempts, server-counted | Must |
| FR-09 | Automatic deterministic validation + result screen | Must |
| FR-10 | Persistent session state (timer, unlocks, hints, checks, attempts, notes, board) | Must |
| FR-11 | Challenge defined by `public.json` + `server.json`, changeable without UI changes | Should |
| FR-12 | Responsive, desktop-first layout | Must |
| FR-13 | Team entry (name + 4-digit passcode), one session per team, resume on any device | Must |
| FR-14 | Cipher terminal with capped, non-revealing `CHECK TRANSFORMATION` | Should |
| FR-15 | Organiser admin: leaderboard, session reset, CSV export | Must |
| FR-16 | Vercel deployment (Functions + static client) backed by Neon Postgres; no other third-party dependency | Must |
| FR-17 | Automated tests: engine, API, end-to-end, 20-session load against a live preview | Must |
| FR-18 | Event access code gate ahead of team entry, with rate-limited guessing | Must |

---

# 17. Admin & Results

A minimal organiser interface is required so the event can actually be run.

- Protected by an `ADMIN_TOKEN` environment variable, sent as `x-admin-token`. No token → no access. The token is never embedded in the client bundle; the admin page asks for it at runtime and keeps it in `sessionStorage`.
- **Leaderboard:** team, status, score, completion time, hints used, wrong attempts, checks used. Sorted by score, then completion time. Refreshes every 10 seconds.
- **Reset session:** wipes one team's session back to `NOT_STARTED` (confirmation required). Team and passcode are kept.
- **Export:** `GET /api/admin/export.csv` downloads all results.
- **Live view:** which teams are `NOT_STARTED / ACTIVE / SOLVED / EXPIRED / LOCKED_OUT` and time remaining for active ones.
- The admin view never displays the solution or any hint text.

---

# 18. Tech Stack (Pinned)

The stack is fixed so the build agent does not choose one arbitrarily. **Adding any dependency not listed here requires asking the organiser first.**

| Layer | Choice |
|---|---|
| Language | TypeScript, `strict` mode, no `any` |
| Monorepo | npm workspaces: `shared`, `server`, `client` |
| Frontend | Vite + React + Tailwind CSS |
| Client state | Zustand |
| Routing | Minimal hash-based routing (`react-router-dom` allowed) |
| Evidence board | `@xyflow/react` (React Flow) — do not hand-build drag-and-connect |
| Animation | CSS transitions; `framer-motion` only for file unlock, modals and vault transitions |
| Icons | `lucide-react` |
| Fonts | `@fontsource` packages, **self-hosted** (see UI/UX spec) |
| Backend | Vercel Functions (the server code is a standard Express app exported for Vercel's Node runtime; confirm current Express-on-Vercel support at the start of Build Phase 1 and record the result in that phase's report) |
| Persistence | **Neon** (serverless Postgres), accessed through its pooled connection string; one `DATABASE_URL` |
| DB access | `postgres.js` or `pg` with a query builder (`kysely`) for typed queries; SQL migrations checked into `server/migrations/` |
| Validation | `zod` for all request bodies and for loading `challenge/*.json` |
| Rate limiting | Database-backed counters (a `rate_limits` table), not in-memory — a serverless instance cannot be relied on to keep memory between requests |
| Passcode hashing | Node built-in `crypto.scrypt` |
| Unit / API tests | Vitest, Supertest, against a local/in-process Postgres (for example PGlite) so no external service is needed to run the suite |
| End-to-end tests | Playwright, against a Vercel preview deployment |
| Dev runner | `tsx` locally; `vercel dev` for a local approximation of the deployed environment |

No external AI API is permitted during gameplay, and no request to any host other than the game's own Vercel deployment and its database.

---

# 19. Vercel Hosting & Deployment

The game is deployed to **Vercel** and reachable at a public HTTPS URL. It is **not** LAN-hosted and does **not** run on an organiser laptop.

- **Frontend:** the built Vite client is served as Vercel's static output.
- **Backend:** the Express app runs as Vercel Functions, reached through the deployment's own `/api/*` routes. The client calls the API with **relative URLs only** — no hard-coded domain.
- **Database:** Neon Postgres, provisioned through the **Vercel Marketplace** so `DATABASE_URL` is wired into the environment automatically for Production, Preview and Development. Neon's free tier scales compute to zero after a few minutes of inactivity and wakes on the next query in well under a second; the project and its data are not deleted by inactivity.
- **No CDN, remote font, remote image or analytics request** to any third party. Fonts are bundled into the deployment, not pulled from Google Fonts or similar, so the app has no hidden third-party dependency beyond Vercel and Neon themselves.
- **Capacity target: 20 concurrent teams (designed for 10 typical).** The client polls session state every 15 s and on window focus. The load test (Build Phase 5) runs against a real Vercel preview URL and must show correct, isolated behaviour with 20 concurrent sessions.
- **Session state lives entirely in Postgres.** A function instance is disposable; nothing required for correctness is kept in server memory between requests.
- **Environment variables** (`DATABASE_URL`, `ADMIN_TOKEN`, `EVENT_CODE`) are set in the Vercel project settings, scoped appropriately per environment, and never logged.
- **Region:** the Vercel deployment and the Neon database are placed in the same region, chosen as close as practical to the event's physical location; confirm available regions for both at setup time.
- The organiser runbook (Build Phase 5 deliverable) covers: creating the Vercel project, connecting the Neon integration, setting environment variables, running migrations, deploying, rolling back a bad deploy, resetting a team, and exporting results.
- If a deploy changes the URL (a new custom domain, for example), teams simply use the new URL; cookies are per-origin, so teams re-enter their name and passcode to resume.

---

# 20. Data Model

### Files

```text
challenge/public.json      served to clients (evidence bodies only for unlocked files)
  challenge_id, title, duration_seconds
  evidence[]: id, title, type, body, metadata{source,timestamp,classification,author,location},
              unlock{requires_opened[]}

challenge/server.json      SERVER ONLY, never served, never bundled
  people[], voices[], alias_clue, target_date_rule, swaps[], assignments[], frames[], lots[]
  cipher{type, shift_source, wrap_modulus, explanation_clue_id}
  ordering[]
  solution{extracted_values, transformed_values, shift, final_code}
  needles[]        (verification only)
  hints[]{id, title, multiplier, text}
  scoring{base, min_time_multiplier, wrong_attempt_multiplier, speed_bonus_points,
          speed_bonus_fraction, check_limit, check_penalty_seconds, attempt_limit}
```

Both files are validated with `zod` at server start. The server refuses to start (and the Vercel deployment fails its health check) if validation fails.

### Database (Neon Postgres)

```text
teams         id, name (unique, citext or lower(name) unique index), passcode_hash, passcode_salt,
              created_at
sessions      id, team_id (unique), status, started_at, ends_at, checks_used,
              attempts_used, wrong_attempts, hints_used (jsonb), opened_ids (jsonb),
              workspace_json (jsonb), submitted_at, final_score, final_seconds
submissions   id, session_id, idempotency_key, code, result, created_at
              UNIQUE (session_id, idempotency_key)
rate_limits   id, scope (event_code | team_entry | submit | check), key (ip or session id),
              window_start, count
```

`workspace_json` holds the player's notes, marks, reviewed toggles, board and cipher scratchpad. It is opaque to the server, size-capped (128 KB) and never evaluated. All timestamps are read from the database (`now()`), not from function-instance clocks, so status transitions and expiry are consistent regardless of which instance handles a request. Migrations are plain SQL files applied in order; the Build Phase 5 runbook documents how to run them against Neon.

---

# 21. Error & Edge Cases

### Wrong Code

Show:

> `ACCESS DENIED`

Do not indicate which digit is wrong.

### Empty Code

Prevent submission.

### Non-Numeric Input

Reject at input level.

### Timer Expiry

The server timestamp decides whether the submission counts.

### Refresh / Reconnect

Restore the same active session.

### Duplicate Submission

Handle idempotently.

### Accidental Hint

Require a confirmation dialog before applying the penalty.

### Small Screens

Provide a responsive layout, but desktop should be the primary supported format.

### Additional Edge Cases (v2)

- **Duplicate team name, wrong passcode:** reject with a neutral message; never reveal the passcode or session state.
- **Wrong event access code:** reject with a neutral message; rate-limited per IP.
- **Second device, same team:** resumes the same session; no second session is created.
- **New serverless function instance mid-game:** transparent to the player; all state is in Postgres, not in the instance.
- **Client clock wrong:** irrelevant; the display uses the server offset.
- **Network drop / reconnect on a mobile connection:** the client retries with backoff and shows a non-blocking "RECONNECTING" state; on recovery it re-fetches session state.
- **Two simultaneous requests for one session** (double-tap, two devices): a database row lock ensures only one is applied; the loser sees the already-applied result.
- **`CHECK TRANSFORMATION` exhausted:** the control is disabled with a clear "0 CHECKS REMAINING" state.
- **Submission at the exact expiry instant:** the database timestamp on receipt decides.
- **Idempotent retries:** the same idempotency key returns the original result and never consumes a second attempt.
- **Neon compute cold start:** the first request after a period of inactivity may take longer; the client's loading state must cover this without looking broken.

---

# 22. Testing & Verification

Acceptance criteria are only real if they are testable. The following are required.

| Layer | Tool | Must cover |
|---|---|---|
| Challenge | `node scripts/verify-challenge.mjs` | Single solution; each elimination unique; facts present in text; hints leak no digits; unlock graph acyclic |
| Engine (unit) | Vitest | Scoring formula incl. worked example (=594), time clamping, cumulative hints, wrap-around cipher, constant-time compare, unlock rules, status machine transitions |
| NLP (unit) | Vitest | Normalisation, tokenisation ids stable across runs, stopwords, TF-IDF ranking, no alias expansion |
| API | Vitest + Supertest | Team entry/resume, event code gate, one session per team, idempotent start, evidence locked until allowed, hint confirm flow, attempts, expiry, rate limits, concurrent-request locking, no solution in any response |
| End-to-end | Playwright (against a Vercel preview URL) | Refresh preserves timer/unlocks/hints/attempts/notes/board; wrong code flow; correct code flow; timeout flow; two teams isolated |
| Load | Node script against a live preview | 20 concurrent sessions polling and submitting; no state leakage; p95 latency reported |
| Human | Playtest | Two people who have not seen the solution solve it; record real times |

Each build phase must leave the test suite green before it reports completion.

---

# 23. Acceptance Criteria

The game is ready only when **all** of the following are true. Items marked **[auto]** must be proven by an automated test or script.

**Gameplay**
- A new player understands the mission within 30–45 seconds of the briefing.
- The puzzle is solvable without external search.
- At least two evidence files are necessary for the final code. **[auto]** (`verify-challenge`)
- At least one genuine NLP-style operation (alias resolution, relationship discovery, semantic matching) is central to the solve.
- The cipher rule is discoverable from file `05` plus the transcript.
- Two people who have not seen the solution solve it in 12–18 minutes.

**Correctness and fairness**
- Final validation is deterministic and server-side. **[auto]**
- Incorrect codes never reveal partial correctness. **[auto]**
- The solution, transformed values and unused hint text never appear in any API response, bundle or log. **[auto]**
- The scoring worked example returns exactly 594. **[auto]**

**State and reliability**
- Timer, unlocks, hints, checks, attempts, notes and board survive refresh and a new serverless function instance. **[auto]**
- 20 concurrent sessions against a live Vercel preview run with no state leakage. **[auto]**
- One team cannot start two sessions, including under concurrent requests. **[auto]**
- The server rejects any submission after `ends_at`. **[auto]**

**Experience**
- The interface feels like a heist investigation rather than a generic form.
- The deployed app makes no request to any host other than itself and its database. **[auto]** (Playwright request log against the live deployment)
- Keyboard-only play is possible for evidence, hints, cipher and keypad.

---

# 24. Antigravity Build Instruction

Build **El Código Rojo — The Red Code** as a production-ready React/TypeScript web application, **in five gated phases** defined in `docs/IMPLEMENTATION_PLAN.md`. Treat this PRD, the UI/UX spec and the plan as the source of truth.

### Do not change

- Core solve path and the authored challenge content (`challenge/*.json`)
- Evidence-based investigation structure and NLP-oriented mechanics
- Cipher layer, six-digit final code, three-attempt limit
- Hint multipliers, the scoring formula, the 15-minute timer
- The pinned tech stack (ask before adding a dependency)

### Implementation priorities

1. Deterministic game logic
2. Reliable state persistence
3. Server-authoritative validation
4. Clear UX
5. Responsive layout
6. Heist atmosphere
7. Animation polish

### Working rules

- After each phase, stop, run the phase verification checklist and report before continuing.
- Keep game content separate from presentation and from game logic.
- No placeholder content, lorem ipsum, TODO stubs, mock data or invented copy. All UI copy comes from the UI/UX spec; where copy is missing, ask.

---

# 25. Money Heist-Inspired Visual Constraint

Use an original visual language inspired by:

- red,
- black,
- classified evidence,
- terminal interfaces,
- paper documents,
- surveillance framing,
- silhouettes,
- vault/security systems,
- cinematic urgency.

Do **not** use copyrighted Netflix logos, screenshots, music, character images, or show assets.

The game should feel like a fictional Royal Mint operation created specifically for CODEVERSE 2.0.

---

# 26. Content Authoring Checklist

Status of the checklist for the supplied challenge (`challenge/*.json`):

| Item | Status |
|---|---|
| Five realistic fictional evidence files | Done |
| Every red herring logically eliminable | Done — proven by `verify-challenge` |
| At least one alias | Done |
| At least one multi-step relationship | Done — alias → swap register → covered post → photo frame (details in the organiser solution key) |
| One explicit cipher clue | Done — file `05` + keys counted in file `01` |
| One explicit ordering clue | Done — door, witness, metal |
| Multiple decoy numbers | Done — 30+ distinct two-digit numbers visible |
| Solved from a clean player perspective | **Pending — organiser** |
| Second person solves it blind | **Pending — organiser playtest** |
| Real solve time measured, noise tuned to 12–18 min | **Pending — organiser playtest** |

The script proves the puzzle is **logically unique and internally consistent**. It cannot measure whether it is *fun* or *fast enough*; only a human playtest can. If solve times fall outside 12–18 minutes, adjust noise in `public.json`, re-run `verify-challenge`, and keep `server.json` facts consistent.

---

# 27. Recommended Final Game Identity

## EL CÓDIGO ROJO
### *THE RED CODE*

**CODEVERSE 2.0 — PHASE 1: THE ROYAL MINT**

> **THE PROFESSOR LEFT THE CODE.  
> THE FILES LEFT THE TRAIL.  
> FIND THE RED KEY.**
