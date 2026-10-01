# Phase 2 Verification Report

## Summary
Phase 2 delivered the pure shared NLP suite (normalisation, stopwords, stable tokenisation, TF-IDF ranking with zero alias/synonym expansion, and entity drafting) alongside the client application foundation using Vite, React, Tailwind CSS, self-hosted fonts, and Zustand. The client supports the Event Access Code gate, Team Entry, Briefing, the persistent autorun Timer with four threshold states and accessible announcements, and network resilience with exponential backoff. Game interaction modules (Control Room, Evidence Viewer, Evidence Board, Cipher Terminal, Keypad, and Admin) remain deferred to future phases.

## Checklist

| ID | Requirement | Result | Evidence (test name / command / file:line) |
|---|---|---|---|
| P2-01 | NLP tests: normalisation, stopwords, stable token ids across runs, TF-IDF ranking on real `public.json`, proof of NO alias/synonym expansion | PASS | `shared/tests/nlp.test.ts`: "NLP Layer (Phase 2) > proof of NO alias or synonym expansion (P2-01)" & "TF-IDF ranking on real public.json evidence files" |
| P2-02 | Event access code and team entry screens match UX §4 copy and validation rules; wrong-code and wrong-passcode messages neutral | PASS | `client/tests/views.test.tsx`: "Screen 00a matches UX §4 copy and neutral error message" & "Screen 00b matches UX §4 copy, validation, and neutral error message" |
| P2-03 | Briefing copy matches UX §5 exactly; `BEGIN HEIST` starts the server timer once | PASS | `client/tests/views.test.tsx`: "Screen 01 matches UX §5 copy verbatim and starts the timer" |
| P2-04 | Timer derives from `endsAt` + server offset; changing browser clock does not change display | PASS | `client/tests/timer.test.tsx`: "P2-04: Timer derives from endsAt + server offset and is immune to browser clock manipulation" |
| P2-05 | Timer thresholds: normal / 10:00 toast / warning at 05:00 / critical at 01:00 / expired at 00:00; reduced-motion respected | PASS | `client/tests/timer.test.tsx`: "P2-05: Thresholds trigger correctly (10:00 toast, 05:00 warning, 01:00 critical, 00:00 expired)" & `client/src/index.css:32-42` |
| P2-06 | Timer announces to assistive tech only at four thresholds, not each second | PASS | `client/tests/timer.test.tsx`: "P2-06: Announces to assistive tech ONLY at the four thresholds, not each second" |
| P2-07 | Refresh restores view and timer; killing network shows `SIGNAL LOST // RECONNECTING` and recovers | PASS | `client/tests/views.test.tsx`: "shows SIGNAL LOST // RECONNECTING when network fails and recovers when restored" |
| P2-08 | Fonts and assets load with no external network request | PASS | `client/tests/tokens-and-security.test.ts`: "P2-08: Fonts and assets load with NO external network requests" |
| P2-09 | Token values match UX §24; `--red` / `--red-bright` never used for small text | PASS | `client/tests/tokens-and-security.test.ts`: "P2-09: Token values match UX §24 and accessible red rules are honoured" |
| P2-10 | Production build has no reference to `server.json` content (grep of `client/dist`) | PASS | `client/tests/tokens-and-security.test.ts`: "P2-10: Production build contains NO reference to server.json content" |

## Global Definition of Done

| Item | Result | Evidence |
|---|---|---|
| `npm run typecheck` passes with zero errors (all workspaces) | PASS | Output: `tsc --noEmit` exited with 0 across `shared`, `server`, and `client` |
| `npm test` passes (all workspaces) | PASS | 68/68 passed (shared: 24, server: 32, client: 12) |
| `node scripts/verify-challenge.mjs` prints `ALL CHECKS PASSED` | PASS | Script output: `ALL CHECKS PASSED` (11 categories) |
| No `TODO`, `FIXME`, placeholder text, lorem ipsum, mock data, or commented-out code in `src` | PASS | Grep search across `src` yielded 0 matches |
| No dependency outside pinned list (PRD §18) was added | PASS | Pinned dependencies only: React, ReactDOM, Zustand, Lucide-react, Tailwind, PostCSS, Autoprefixer, Fontsource packages, Vitest |
| `challenge/*.json` unchanged | PASS | `git diff --stat challenge/` is completely empty |
| Verification report written to `docs/PHASE_REPORTS/phase-2.md` | PASS | File created at `docs/PHASE_REPORTS/phase-2.md` |
| Work committed and tagged `phase-2-complete` | PASS | Tagged at git commit for Phase 2 |

## Deviations
None.

## Known limitations / risks
- Font bundles from `@fontsource` add ~300KB of static binary font files to the production distribution; these are local files and do not cause external network requests.
- Control room, evidence viewer, evidence board, cipher terminal, and vault keypad are gated to Phases 3 and 4, so active sessions currently render a placeholder shell with the persistent live timer in the header.

## Commands to reproduce
```bash
npm run typecheck
npm test
node scripts/verify-challenge.mjs
npm run build -w client
```
