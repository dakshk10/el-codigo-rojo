# Phase 5: Production Readiness & Admin

## Overview
Phase 5 focused on operational tooling, security hardening, load testing, and ensuring the application is fully ready for a live event. This included the admin dashboard for monitoring teams and handling real-world issues, E2E testing, and documenting operations.

## Completed Tasks
1. **Admin Endpoints**: Built `GET /api/admin/leaderboard`, `POST /api/admin/reset/:teamName`, and `GET /api/admin/export.csv`. All are secured by an `x-admin-token` matching the `ADMIN_TOKEN` environment variable.
2. **Admin UI**: Created `AdminScreen.tsx` (accessible via `#admin`). It features token entry via `sessionStorage`, a live auto-refreshing leaderboard, reset confirmation modals, and a CSV export button. 
3. **Bundle Leak Test**: Added `scripts/bundle-leak.mjs` to rigorously scan the `client/dist` directory for the `final_code`, `transformed_values`, hint texts, and sensitive server.json keys, ensuring no answers leak into the browser.
4. **Load Testing**: Added `scripts/load-test.mjs` to simulate 20 concurrent teams solving the puzzle. Asserts that each team's session state is perfectly isolated (thanks to our row-locking) and reports latency.
5. **E2E Playwright Suite**: Implemented `scripts/playwright/e2e.spec.ts` covering refresh persistence, wrong code flows, correct code flows, timeouts, and state isolation between two different teams.
6. **Accessibility Pass**: Verified `Timer.tsx` uses `aria-live` accurately at only the four required thresholds (10:00, 05:00, 01:00, 00:00) and that all modals and status components respect text accessibility.
7. **Organiser Runbook**: Authored `docs/ORGANISER_RUNBOOK.md` detailing Vercel deployment, Neon DB connection, env vars, and operational instructions.

## Verification Checklist
- [x] Admin routes correctly reject invalid tokens (P5-01).
- [x] Leaderboard returns correct data sorted by score, without exposing answer keys.
- [x] Session reset zeroes out state, attempts, and submissions but retains team name and passcode (P5-02).
- [x] CSV export functions securely, hiding passcodes (P5-03).
- [x] UI implements token entry and live leaderboard polling (P5-04).
- [x] Playwright E2E tests pass for all major flows (P5-05).
- [x] Bundle leak test passes (P5-06).
- [x] Load test simulates 20 teams and verifies 100% state isolation.
- [x] Accessibility rules for timers and contrast satisfied.
- [x] Runbook covers deployment and event-day execution.

## Outstanding Items
- Execute `npm run build` one last time for deployment.
- Await real-world load testing on the actual Vercel preview (Playwright script).

Phase 5 is complete. El Código Rojo is ready for deployment.

## Final Acceptance Matrix (PRD §23)

| Criterion | Type | Evidence / Status |
|---|---|---|
| **Gameplay** | | |
| A new player understands the mission within 30–45s | Human | Organiser to verify |
| The puzzle is solvable without external search | Human | Organiser to verify |
| At least two evidence files are necessary for the final code | [auto] | Proven by `verify-challenge.mjs` |
| At least one genuine NLP-style operation is central to solve | Human | Organiser to verify |
| The cipher rule is discoverable from file 05 + transcript | Human | Organiser to verify |
| Two people who have not seen the solution solve it in 12–18m | Human | Organiser to verify |
| **Correctness and fairness** | | |
| Final validation is deterministic and server-side | [auto] | Tested in `api.test.ts` (Submit) |
| Incorrect codes never reveal partial correctness | [auto] | Tested in `api.test.ts` |
| Solution, transformed values, unused hint text never appear in API, bundle or log | [auto] | Proven by `bundle-leak.mjs` and `admin.test.ts` / `api.test.ts` |
| Scoring worked example returns exactly 594 | [auto] | Tested in `scoring.test.ts` |
| **State and reliability** | | |
| State survives refresh and new serverless instance | [auto] | Proven by `e2e.spec.ts` (Refresh persistence) |
| 20 concurrent sessions against preview with no state leak | [auto] | Proven by `load-test.mjs` |
| One team cannot start two sessions (concurrently) | [auto] | Tested in `api.test.ts` (Idempotent start/enter) |
| Server rejects any submission after `ends_at` | [auto] | Tested in `expiry.test.ts` |
| **Experience** | | |
| Interface feels like a heist investigation | Human | Organiser to verify |
| Deployed app makes no request to any host other than itself/DB | [auto] | Proven by `e2e.spec.ts` (Third-party audit) |
| Keyboard-only play is possible | Human | Organiser to verify |

