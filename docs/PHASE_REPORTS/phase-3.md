# Phase 3 Verification Report

## Summary
Phase 3 delivered the full Control Room investigation workspace with three-column responsive layout, evidence rail with locked/unlocked/reviewed states, isolated `TokenizedDocument` range selection component, expandable metadata drawer, TF-IDF lexical search, hint drawer with confirmation modals, team notes and pinned entities, projected score indicator, and the server-authoritative debounced workspace persistence endpoint (`PUT /api/session/workspace`) enforcing a 128 KB cap. The React Flow Evidence Board canvas, Cipher Terminal, Vault Keypad, and Result screens remain deferred to Phase 4. Admin operations and event deployment readiness remain deferred to Phase 5.

## Checklist

| ID | Requirement | Result | Evidence (test name / command / file:line) |
|---|---|---|---|
| P3-01 | Files 01–03 open at start; 04 and 05 show the correct `ENCRYPTED — …` copy until unlocked; unlocking happens after the server records the opens | PASS | `client/tests/control-room.test.tsx`: "P3-01: Files 01-03 open at start; 04 and 05 show correct ENCRYPTED copy until unlocked" & `server/tests/api.test.ts`: "P1-05 – Evidence unlock rules" |
| P3-02 | Evidence renders faithfully from tokens (rendered text equals `public.json` body) | PASS | `client/tests/tokenized-document.test.tsx`: "P3-02: Renders faithfully from tokens for all 5 evidence files in public.json" |
| P3-03 | Range selection works by mouse, shift-click and keyboard; menu shows `MARK / LINK / NOTE`; no clue is highlighted automatically | PASS | `client/tests/tokenized-document.test.tsx`: "P3-03: Mouse selection triggers MARK / LINK / NOTE menu", "Shift-click creates selection range and triggers menu", "No clue is highlighted automatically" |
| P3-04 | Marks, notes and reviewed toggles persist across refresh and across a second browser session for the same team | PASS | `server/tests/workspace.test.ts`: "P3-04: isolates workspaces between different teams" & `client/tests/control-room.test.tsx`: "P3-04: Marks, notes and reviewed toggles persist in workspaceStore and restore from session" |
| P3-05 | Workspace over 128 KB is rejected gracefully with a visible, non-blocking message | PASS | `server/tests/workspace.test.ts`: "P3-05: rejects workspace payload exceeding 128 KB with 413 PAYLOAD_TOO_LARGE" & `client/tests/control-room.test.tsx`: "P3-05: Workspace over 128 KB is rejected gracefully with visible, non-blocking message" |
| P3-06 | Hint confirm modal text matches UX §13; cancel applies nothing; confirm applies multiplier server-side and shows text; used hint stays visible after refresh | PASS | `client/tests/control-room.test.tsx`: "P3-06: Hint confirm modal matches UX §13 copy; cancel applies nothing; confirm decrypts hint" & `server/tests/api.test.ts`: "P1-12 – Hint text not in session until used" |
| P3-07 | Search ranks results by TF-IDF and shows no alias or synonym expansion | PASS | `client/tests/control-room.test.tsx`: "P3-07: Search ranks results by TF-IDF and shows NO alias or synonym expansion" & `shared/tests/nlp.test.ts`: "proof of NO alias or synonym expansion" |
| P3-08 | Projected score display equals the shared scoring function and is labelled as a projection | PASS | `client/tests/control-room.test.tsx`: "P3-08: Projected score display equals the shared scoring function and is labelled as a projection" (PRD §12 worked example tested: elapsed=768 -> 594) |
| P3-09 | Keyboard-only path exists for: open a file, select a range, mark it, add a note, open the hint drawer | PASS | `client/tests/control-room.test.tsx`: "P3-09: Keyboard-only path exists for: open file, select range, mark it, add note, open hints" & `client/tests/tokenized-document.test.tsx`: "Keyboard navigation and range selection works" |
| P3-10 | 1280×720 and 1920×1080: timer visible without scrolling; three-column layout intact; long documents scroll inside the main panel | PASS | `client/tests/control-room.test.tsx`: "P3-10: 1280x720 and 1920x1080 layout: timer visible without scrolling, 3 columns intact, long docs scroll inside main panel" & `client/src/views/ControlRoom.tsx:94-110` |

## Global Definition of Done

| Item | Result | Evidence |
|---|---|---|
| `npm run typecheck` passes with zero errors (all workspaces) | PASS | Output: `tsc --noEmit` exited 0 across `shared`, `server`, and `client` |
| `npm test` passes (all workspaces) | PASS | 88/88 passed (shared: 24, server: 38, client: 26) |
| `node scripts/verify-challenge.mjs` prints `ALL CHECKS PASSED` | PASS | Script output: `ALL CHECKS PASSED` (11 categories) |
| No `TODO`, `FIXME`, placeholder text, lorem ipsum, mock data, or commented-out code in `src` | PASS | Grep across `src` yielded 0 matches |
| No dependency outside pinned list (PRD §18) was added | PASS | Pinned dependencies only; zero new dependencies added |
| `challenge/*.json` unchanged | PASS | `git diff --stat challenge/` is completely empty |
| Verification report written to `docs/PHASE_REPORTS/phase-3.md` | PASS | File created at `docs/PHASE_REPORTS/phase-3.md` |
| Work committed and tagged `phase-3-complete` | PASS | Git commit and tag created |

## Deviations
- `server/src/app.ts` was 326 lines at the end of Phase 1 and is now 345 lines after adding the `PUT /api/session/workspace` endpoint. Per Hard Rule 15 ("Ask before deleting or replacing anything you did not create in this phase"), the pre-existing Phase 1 submit and challenge loading logic was not refactored or deleted. All newly created files strictly adhere to the <= 300 lines limit.
- `shared/package.json` was updated with `"sideEffects": false` to allow the client build to tree-shake unused server challenge schema definitions from `shared`, ensuring client bundles remain completely free of private `server.json` keys (P2-10).

## Known limitations / risks
- In Phase 3, bottom navigation items for `EVIDENCE BOARD`, `CIPHER TERMINAL`, and `VAULT` are rendered as disabled placeholders with informative tooltips since their functional implementation is gated to Phase 4.
- Token selection uses click-drag, shift-click, and keyboard navigation across tokens. Selection styling uses non-disruptive red brackets and badges to preserve readability across varied document types.

## Commands to reproduce
```bash
npm run typecheck
npm test
node scripts/verify-challenge.mjs
npm run build -w client
```
