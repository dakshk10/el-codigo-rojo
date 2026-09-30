# CODEVERSE 2.0 — EL CÓDIGO ROJO

## UI/UX Design Specification — v2
**Phase 1 — The Royal Mint**  
**Theme:** Money Heist-inspired Royal Mint Vault Investigation

---

# 1. Design Direction

The interface should feel like the crew has entered a secure Royal Mint control network.

The design should be:

- cinematic,
- tense,
- secretive,
- intelligent,
- highly readable under time pressure.

The visual atmosphere should support the story without overwhelming the investigation.

### Visual Identity

| Dimension | Direction |
|---|---|
| Primary | Near-black `#0B0B0B` |
| Main Accent | Blood red `#B00020` / `#C1121F` |
| Paper | Off-white `#E8E2D6` |
| Secondary Accent | Muted amber / restrained terminal green |
| Headings | Condensed display typeface |
| Technical Text | Legible monospace |
| Texture | Subtle paper grain, scanlines, classified stamps, redactions |
| Imagery | Original silhouettes, folders, CCTV framing, vault diagrams |
| Motion | Short and purposeful |
| Tone | Classified + cinematic + urgent |

### Avoid

- Generic cyberpunk neon
- Excessive glow
- Visual clutter
- Extremely dark low-contrast text
- Copyrighted Money Heist / Netflix assets
- Animation that slows gameplay

---

# 2. UX Principles

### Information First

Evidence must remain readable before decorative effects are considered.

### Immediate Feedback

Every interactive action needs an immediate visual response.

### No Critical Information Behind Animation

Animations must never hide or delay required information.

### Persistent Timer

Once the heist starts, the timer should always be visible.

### Clear Next Action

Players should always understand what they can do next.

### Fair Error Handling

Errors explain what happened without revealing the answer.

### Team-Friendly

The interface should support 2–4 players viewing one screen and discussing simultaneously.

### Progressive Disclosure

Evidence starts compact and becomes more detailed when opened.

---

# 3. Screen Map

| Screen | Purpose | Primary Action |
|---|---|---|
| `00` — Team Entry | Identify the team, resume or create a session | `ENTER OPERATION` |
| `01` — Briefing | Establish story + rules | `BEGIN HEIST` |
| `02` — Control Room | Main investigation workspace | Open evidence |
| `03` — Evidence Viewer | Read and inspect evidence | Cross-reference / mark clue |
| `04` — Evidence Board | Organise extracted information | Link evidence |
| `05` — Cipher Terminal | Apply final transformation | Generate candidate |
| `06` — Vault Keypad | Submit final code | Enter code |
| `07` — Result | Show outcome + score | Finish |
| `08` — Admin (organiser only) | Run the event: leaderboard, reset, export | Monitor / reset |

---

# 4. Screen 00 — Team Entry

Full-screen black background with a single small dossier card. This is the first screen on every device.

### Screen 00a — Event Access Code (shown once per browser, before team entry)

Because the game is reachable at a public URL, this gate stands before team entry.

```text
CODEVERSE 2.0
PHASE 1 // THE ROYAL MINT

RESTRICTED ACCESS
ENTER THE OPERATION CODE GIVEN AT THE VENUE

[ ACCESS CODE ]

[ CONTINUE ]
```

A wrong code shows `ACCESS DENIED` with no further detail and is rate-limited server-side. Once accepted, the browser proceeds to Team Entry and is not asked again this session.

### Screen 00b — Team Entry

### Header

```text
CODEVERSE 2.0
PHASE 1 // THE ROYAL MINT
```

### Fields

| Field | Rules |
|---|---|
| `TEAM NAME` | 3–24 characters: letters, digits, spaces, hyphens. Unique, case-insensitive |
| `TEAM PASSCODE` | Exactly 4 digits, numeric keypad on touch devices, masked, `autocomplete="off"` |

### CTA

```text
ENTER OPERATION
```

### Helper Copy

```text
RETURNING? ENTER THE SAME NAME AND PASSCODE TO RESUME.
CHOOSE A PASSCODE YOUR WHOLE TEAM WILL REMEMBER.
```

### Behaviour

- New name → creates the team and goes to `01 — Briefing`.
- Existing name + correct passcode → resumes the same session and goes straight to the screen matching the session status (Briefing, Control Room, or Result).
- Existing name + wrong passcode → `THAT TEAM NAME IS TAKEN, OR THE PASSCODE IS INCORRECT.` No further detail.
- Validation errors appear inline under the field, in text plus an icon (never colour alone).

---

# 5. Screen 01 — Briefing

Full-screen black background.

Place a central **classified red file / case dossier**.

### Header

```text
CODEVERSE 2.0
PHASE 1 // THE ROYAL MINT
```

### Main Title

```text
EL CÓDIGO ROJO
```

### Tagline

```text
THE PROFESSOR LEFT ONE KEY.
FIND IT BEFORE THE TIMER RUNS OUT.
```

### Briefing Copy

```text
The Royal Mint vault has been isolated.

Five evidence files.
One hidden chain.
One final access code.

Read carefully.
Connect the clues.
Crack the code.
```

### Mission Metadata

```text
DURATION
15:00

OBJECTIVE
BREACH THE VAULT
```

### CTA

```text
BEGIN HEIST
```

### Footer

```text
EXTERNAL SEARCH IS NOT REQUIRED.
```

---

# 6. Screen 02 — Control Room

This is the main gameplay screen.

It should be designed primarily for:

- laptop / desktop,
- team viewing,
- fast switching between evidence.

## Desktop Layout

### Top Bar

Contains:

- `EL CÓDIGO ROJO`
- `PHASE 1 // THE ROYAL MINT`
- countdown
- projected score (display only; the server computes the real score)

### Left Rail

List the evidence:

```text
01  INTERCEPTED TRANSCRIPT
02  SHIFT MANIFEST
03  NEWSPAPER FRAGMENT
04  EVIDENCE PHOTO LOG
05  PROFESSOR'S CIPHER NOTE
```

States:

- Locked
- Unread
- Opened
- Completed

### Main Panel

Display:

- Mission directive
- selected document
- document body
- metadata
- clue actions

### Right Panel

Display:

- pinned clues
- extracted entities
- relationships
- team notes

### Bottom Navigation

```text
HINTS
EVIDENCE BOARD
CIPHER TERMINAL
VAULT
```

`Completed` on the evidence rail is a player-controlled **reviewed** toggle (`MARK AS REVIEWED`). It has no effect on unlocks or scoring. `Locked` files show `ENCRYPTED — REVIEW FILES 01–03 FIRST` (file `04`) or `ENCRYPTED — REVIEW FILE 04 FIRST` (file `05`).

---

# 7. Evidence File UI

Each file should look like a classified document.

### File Header

```text
CLASSIFIED EVIDENCE
FILE 03
ROYAL MINT SECURITY ARCHIVE
```

### Metadata

```text
SOURCE:
ARCHIVE NODE 04

TIMESTAMP:
08 OCT 2026 / 19:42

CLASSIFICATION:
RESTRICTED
```

### Document Body

Use realistic:

- reports,
- transcripts,
- manifests,
- logs,
- articles.

### Interaction

Evidence bodies are delivered pre-tokenised (stable token ids). Players select a **range of tokens** by click-drag, shift-click or keyboard (arrow keys + shift). The browser's free-form text selection is **not** used, so the same interaction works on desktop, keyboard and touch.

Selection menu:

```text
MARK
LINK
NOTE
```

### Important UX Rule

Do not automatically highlight every potentially useful clue.

The player should have to investigate.

---

# 8. Evidence Viewer Behaviour

### Open

- file slides into main panel,
- short opacity transition,
- no loading spinner unless actual network loading occurs.

### Mark

Marked text gets a subtle red bracket / marker.

### Link

Player can connect selected entity to an existing evidence item.

### Note

Open a small sticky-note style input.

### Metadata Drawer

Allow players to expand metadata:

- source,
- timestamp,
- author,
- location,
- classification.

Marks, notes and reviewed toggles are saved to the server so a refresh or second device restores them. Unlock is decided by the server when a file body is first requested; the client never unlocks anything locally.

---

# 9. Evidence Board

This is the central collaborative mechanic. It resembles an **investigation board**, but stays original rather than reproducing a film set.

Built on **`@xyflow/react` (React Flow)**. Do not hand-build drag, pan, zoom or edge routing.

## Main Elements

### Evidence Cards (nodes)

Cards can represent:

- Person
- Alias
- Location
- Date
- Number
- Event

Cards are created from marked evidence (via `MARK` → `PIN TO BOARD`) or added manually. Players may drag them freely.

### Connection Lines (edges)

Players connect cards. Each line can carry a relationship label:

```text
SEEN AT
SCHEDULED ON
MENTIONED BY
CONNECTED TO
```

## Correctness Is Never Signalled

The board is a **thinking tool**, not a checker. The server never evaluates it.

- **No snapping, alignment, glow or sound** based on whether a link is correct.
- **No "CORRECT!"** and no "WRONG" of any kind.
- Incorrect and correct links look identical.
- There is **no target link count**.

### Progress Indicator

```text
LINKS MADE
3
```

This counts links the team has drawn. It carries no information about how many are required or right.

## Keyboard and Non-Drag Alternative

Every action available by dragging must also be possible without a pointer:

- `ADD LINK` form: choose source card, relationship label, target card, then confirm.
- Cards and links are also listed in a plain **Link List** (text) beside the canvas.

## Controls

```text
UNDO
CLEAR BOARD     (requires confirmation)
ADD LINK
```

## Persistence

Board state is saved to the server with the rest of the workspace (debounced, opaque JSON, 128 KB combined cap) so a refresh or a second device restores it. The server stores it without interpreting it.

---

# 10. Cipher Terminal

A secure terminal-style interface.

### Visual

- black terminal background,
- monospace type,
- red cursor,
- subtle scanline texture.

### Header

```text
ROYAL MINT SECURITY TERMINAL
CIPHER MODULE // RED KEY
```

### Content

Show the cipher instruction discovered through the evidence (the text of file `05` once unlocked and opened).

### Scratchpad

Players may enter intermediate values and free-form working. It is stored with the session but never evaluated.

### Transformation Check (capped)

```text
CHECK TRANSFORMATION
CHECKS REMAINING: 3
```

- The player enters the **three two-digit transformed values** (order does not matter for this check).
- The response is a **single** result for the whole set:

```text
TRANSFORMATION VALID
TRANSFORMATION NOT VALID
```

- It never says which value is wrong or how many are right.
- **Hard cap: 3 uses per session.** Each use adds **30 seconds to the scoring time** (the countdown is not affected). Before the first use a confirmation states this.
- At 0 remaining the control is disabled and shows `0 CHECKS REMAINING`.

### Important Rule

The terminal must not become a generic coding IDE. Players are solving a puzzle, not writing software.

---

# 11. Vault Keypad

The final interaction should feel physically distinct from the investigation UI.

## Layout

Large six-digit display:

```text
_ _ _ _ _ _
```

Keypad:

```text
┌───┬───┬───┐
│ 1 │ 2 │ 3 │
├───┼───┼───┤
│ 4 │ 5 │ 6 │
├───┼───┼───┤
│ 7 │ 8 │ 9 │
├───┼───┼───┤
│   0   │   │
└───┴───┴───┘
```

Controls:

```text
BACKSPACE
CLEAR
ENTER CODE
```

### Attempts

Always show:

```text
ATTEMPTS REMAINING: 3
```

---

# 12. Vault Feedback States

## Idle

Neutral security interface.

## Incorrect

Display:

```text
ACCESS DENIED
SEQUENCE REJECTED
```

Behaviour:

- keypad briefly shakes,
- entered digits clear,
- attempt count decreases.

### Important

Do not reveal:

- which digit is wrong,
- how many digits are correct,
- whether the first half is correct.

## Correct

Display:

```text
ACCESS GRANTED
VAULT BREACHED
```

Then play a short unlock transition.

---

# 13. Hint Drawer

Hints should visually resemble classified folders.

Example:

```text
HINT 01
READ BETWEEN THE LINES

Penalty:
-5%

[ USE HINT ]
```

### Activation

Require confirmation:

```text
USE THIS HINT?

YOUR SCORE WILL BE REDUCED BY 5%.

[ CANCEL ]   [ CONFIRM ]
```

### Used State

```text
HINT 01
DECRYPTED

USED
```

The hint remains visible for the rest of the game.

Unused hints show only the title and penalty. The hint **text** is not present in the page until the server returns it after confirmation. Once used it stays visible for the rest of the session.

---

# 14. Timer Behaviour

| Time Remaining | State | Behaviour |
|---|---|---|
| `15:00–10:01` | Normal | Stable countdown |
| `10:00` | Normal | One-time subtle toast: `10:00 REMAINING`. No colour change |
| `10:00–05:01` | Normal | Stable countdown |
| `05:00–01:01` | Warning | Subtle pulse every 30 seconds |
| `01:00–00:01` | Critical | Red timer + stronger pulse |
| `00:00` | Expired | Freeze gameplay + timeout screen |

### Timer Position

Keep the timer visible in the top bar on every active game screen. Do not hide it inside the menu.

### Accuracy

The countdown is derived from the **server's** `ends_at` and a measured server/client offset (re-measured on every session fetch). A wrong device clock must not change what the team sees.

### Screen Reader Behaviour

The timer is **not** an `aria-live` region that speaks every second. Assistive technology is notified only at `10:00`, `05:00`, `01:00` and `00:00`. The current time is available on demand through a labelled, focusable timer element.

---

# 15. Result Screen

## Success

### Header

```text
VAULT BREACHED
```

### Supporting Copy

```text
THE RED CODE WAS CRACKED.

THE CREW GOT THROUGH.
```

### Stats

```text
COMPLETION TIME
12:48

HINTS USED
1

FINAL ATTEMPTS
2

SCORE
594
```

### Optional Event Integration

If connected to the CODEVERSE backend:

```text
SUBMISSION STATUS
RECORDED
```

---

## Failure

### Header

```text
VAULT SEALED
```

### Supporting Copy

```text
THE ROYAL MINT HAS LOCKED DOWN.

THE WINDOW IS CLOSED.
```

Show:

- time,
- attempts,
- hints,
- final status.

Never display the correct code.

### Score Display Rules

- The success screen shows the score the **server** returned. The client never computes the final score.
- The example above corresponds to: solved at 12:48, Hint 1 used, 1 wrong attempt (`FINAL ATTEMPTS 2` = 1 wrong + 1 correct), 0 checks, giving `1000 × 0.6587 × 0.95 × 0.95 = 594`.
- Show a compact breakdown under the score: `TIME`, `HINTS`, `ATTEMPTS`, `CHECKS`, and `SPEED BONUS` when earned.
- Failure screens show score `0` and never display the correct code.

---

# 16. Screen 08 — Admin (Organiser Only)

A plain, high-contrast, functional table view. It does not need the full cinematic treatment, but it uses the same tokens and fonts.

### Access

- Route: `#/admin`.
- Asks for the organiser token at runtime. The token is held in `sessionStorage` only and is never part of the client bundle.

### Content

```text
LIVE OPERATIONS
```

| Column | Notes |
|---|---|
| Team | Name only, never passcode |
| Status | `NOT_STARTED / ACTIVE / SOLVED / EXPIRED / LOCKED_OUT` |
| Time remaining | Only for `ACTIVE` |
| Score | Server score, `—` if not solved |
| Completion time | `mm:ss` |
| Hints / Wrong attempts / Checks | Counts |
| Action | `RESET` (requires confirmation) |

### Controls

```text
EXPORT CSV
REFRESH (auto every 10 s)
```

The admin screen never shows the solution, the final code, or hint text.

---

# 17. Component Inventory

| Component | States |
|---|---|
| `ClassifiedFileCard` | locked / unread / opened / completed |
| `EvidenceViewer` | document / transcript / log |
| `EntityChip` | person / place / date / number / alias |
| `EvidenceCard` | pinned / unpinned |
| `RelationshipLine` | active / user-created |
| `Timer` | normal / warning / critical / expired |
| `HintCard` | available / confirmation / used |
| `Keypad` | idle / wrong / correct / locked |
| `Toast` | success / warning / error / info |
| `Modal` | confirmation / result |
| `TerminalPanel` | idle / processing / validated |

| `TeamEntryForm` | idle / validating / error / resuming |
| `TokenizedDocument` | idle / selecting / marked |
| `NotesPanel` | empty / has notes / saving |
| `LinkList` | empty / populated |
| `ReconnectBanner` | hidden / reconnecting / recovered |
| `AdminTable` | loading / populated / confirm-reset |

---

# 18. Responsive Behaviour

## Desktop — ≥1200px

Use the full three-column investigation layout:

```text
┌────────────┬─────────────────────┬──────────────┐
│ Evidence   │ Main Investigation  │ Team Board   │
│ Rail       │ Workspace           │ / Notes      │
└────────────┴─────────────────────┴──────────────┘
```

## Tablet — 768–1199px

- Evidence rail remains visible.
- Main evidence takes priority.
- Board opens as a drawer.

## Mobile — <768px

Use a single-column experience.

The Evidence Board becomes a full-screen drawer/modal.

The keypad remains large and easy to operate.

### Touch

Minimum target size:

> **44 × 44 px**

### Tablet and Mobile Note (v2)

Desktop and laptop are the primary supported formats. On smaller screens the Evidence Board falls back to its `Link List` + `ADD LINK` form as the default view, with the React Flow canvas available as an optional full-screen view.

---

# 19. Accessibility

- Never communicate state using red/green alone.
- Provide keyboard navigation.
- Provide clear focus states.
- Maintain strong contrast.
- Support `prefers-reduced-motion`.
- Give keypad buttons accessible labels.
- Announce timer-critical states to assistive technology.
- Never communicate required information through sound alone.

### Additional Requirements (v2)

- Timer announcements to assistive technology only at `10:00`, `05:00`, `01:00` and `00:00`; never every second.
- Every board action has a pointer-free equivalent (`ADD LINK` form, Link List, keyboard token selection).
- Token selection works with keyboard (arrow keys, shift + arrows) and shows a visible focus ring.
- State is always conveyed by text or icon **as well as** colour. Red text on black must use the accessible red token (see Colour Tokens).
- Modals trap focus and return it to the trigger on close.

---

# 20. Motion & Microinteractions

| Interaction | Animation | Target Duration |
|---|---|---:|
| File unlock | Red classified stamp / slide-open | 250–350ms |
| Evidence open | Slide + opacity | 200–300ms |
| Hint confirmation | Modal fade / scale | 150–200ms |
| Wrong code | Keypad shake | 300–450ms |
| Correct code | Lock disengage + vault transition | 600–900ms |
| Timer warning | Subtle pulse | ~1 sec |

### Critical Rule

Animations must never delay player input.

---

# 21. Copy Style

Use language such as:

- OPERATION
- CLASSIFIED
- EVIDENCE
- ACCESS
- LOCKED
- BREACH
- EXTRACTED
- SECURITY TERMINAL
- RED KEY
- VAULT

### Avoid

Overusing lines such as:

> SYSTEM HACKED!!!

The game should feel intelligent rather than cheesy.

### Language Flavour

Occasional Spanish or Italian-flavoured labels may be used for atmosphere.

However:

**Language knowledge must never be required to solve the puzzle.**

---

# 22. Example UI Copy

| Context | Copy |
|---|---|
| Mission | `THE ROYAL MINT HAS BEEN SEALED. THE PROFESSOR LEFT A PATH. FOLLOW IT.` |
| Evidence | `CLASSIFIED EVIDENCE // FILE 03` |
| Locked file | `ENCRYPTED — REVIEW FILES 01–03 FIRST` |
| Team entry | `RETURNING? ENTER THE SAME NAME AND PASSCODE TO RESUME.` |
| Checks exhausted | `0 CHECKS REMAINING` |
| Reconnecting | `SIGNAL LOST // RECONNECTING` |
| Hint | `THE PROFESSOR WILL NOT GIVE YOU THE ANSWER. ONLY THE NEXT STEP.` |
| Wrong code | `ACCESS DENIED // THE VAULT REJECTED YOUR SEQUENCE.` |
| Success | `VAULT BREACHED // THE CREW HAS THE KEY.` |
| Timeout | `TIME'S UP // THE VAULT HAS SEALED.` |

---

# 23. Visual Hierarchy

### Highest Priority

1. Timer
2. Current objective
3. Evidence content
4. Final answer state
5. Attempts remaining

### Medium Priority

- Evidence metadata
- Investigation notes
- Hint availability
- Progress indicators

### Low Priority

- decorative stamps,
- grain,
- scanlines,
- ambient animation.

Decorative elements must never compete with the timer or evidence.

---

# 24. Colour Usage & Tokens

### Usage

**Black** — global background, terminal surfaces, navigation, major containers.

**Red** — active navigation, primary CTA, warnings, classification marks, key emphasis.

**Paper / Off-White** — evidence documents, document backgrounds, selected textual evidence.

**Amber / Green** — used sparingly for intermediate validated states, system status, technical metadata.

Do not let secondary colours undermine the dominant red/black identity.

### Colour Tokens (define once, use everywhere)

| Token | Value | Use | Contrast on `--bg` (approx.) |
|---|---|---|---|
| `--bg` | `#0B0B0B` | Global background | — |
| `--panel` | `#141414` | Raised surfaces | — |
| `--line` | `#2A2A2A` | Borders, dividers | decorative |
| `--paper` | `#E8E2D6` | Evidence paper, primary text on dark | 15.3 : 1 |
| `--ink` | `#1A1A1A` | Text on paper | 13.5 : 1 on paper |
| `--muted` | `#8A8578` | Secondary text, metadata | 5.4 : 1 |
| `--red` | `#B00020` | **Fills and borders only** (buttons, stamps, brackets) | 2.7 : 1 |
| `--red-bright` | `#C1121F` | Large display text (≥ 24 px), icons | 3.2 : 1 |
| `--red-text` | `#FF4D5E` | **Small red text on dark** (timer critical, errors, labels) | 6.1 : 1 |
| `--amber` | `#D9A441` | System status, metadata | 8.8 : 1 |
| `--green` | `#5FBF7F` | Validated states, terminal | 8.7 : 1 |

Rules:

- **Never** use `--red` or `--red-bright` for small text on `--bg`; they fail contrast. Use `--red-text`.
- Text on a `--red` fill uses `#F5F0E6` (about 6.4 : 1).
- State is never red/green alone; pair with an icon or label.
- The timer's `Critical` state uses `--red-text` plus a pulse and a label, not colour alone.

---

# 25. Typography System

All fonts are **self-hosted** through `@fontsource` packages, bundled into the deployment. Never load fonts from a CDN or a third-party font host. Every font has a system fallback stack, so a slow connection never blocks rendering.

| Role | Font | Fallback | Use |
|---|---|---|---|
| Display | **Bebas Neue** | `"Arial Narrow", Impact, sans-serif` | Game title, section headings, major status states |
| UI | **Inter** (variable) | `system-ui, Segoe UI, Roboto, sans-serif` | Buttons, metadata, body UI, newspaper and note body |
| Mono | **JetBrains Mono** | `ui-monospace, Consolas, monospace` | Terminal, timer, vault code, transcript, manifest, photo log, timestamps |

### Rules

- Body evidence is optimised for reading speed, not cinematic styling: 16–17 px, line-height ≈ 1.6 for prose (newspaper, note); 14–15 px monospace for aligned material (transcript, manifest, photo log).
- Display type is never used for evidence body text or for long strings.
- Numbers that players must read exactly (timer, vault code, badge and lot numbers) use the monospace face with tabular figures.

---

# 26. Visual QA Checklist

Before launch:

- Timer visible without scrolling.
- Evidence filenames distinguishable immediately.
- Long evidence documents remain comfortable to read.
- Red/black theme maintains sufficient contrast.
- Keypad is instantly recognisable.
- Hint penalties are obvious before activation.
- Success and failure states are unmistakable.
- No copyrighted Netflix/Money Heist assets.
- Desktop team-view remains readable.
- No animation blocks input.
- Locked/unlocked evidence states are obvious.
- The interface remains coherent with no evidence selected.

### Additional Checks (v2)

- Third-party check: on the deployed Vercel URL, the network panel shows no request to any host other than the deployment itself; fonts and assets all come from the deployment's own bundle.
- No console request to any external host.
- Board and links never signal correctness.
- Timer and score shown match the server after a refresh and after a wrong device clock.
- Team Entry, Admin and Result screens are visually consistent with the rest.
- Contrast: every text/background pair in the Colour Tokens table meets its stated minimum.

---

# 27. Antigravity Implementation Brief

Implement **El Código Rojo — The Red Code** as a polished production-quality React/TypeScript game, built in the five gated phases of `docs/IMPLEMENTATION_PLAN.md`.

### Required Reusable Components

- Evidence rail
- Classified file card
- Tokenised document viewer
- Entity selector
- Evidence board (React Flow) and link list
- Relationship connector
- Notes panel
- Hint drawer
- Countdown timer
- Cipher terminal
- Vault keypad
- Result screens
- Team entry and admin views
- Toast / modal system

### Two Kinds of State (do not mix them)

**Session status — authoritative, on the server:**

```text
NOT_STARTED | ACTIVE | SOLVED | EXPIRED | LOCKED_OUT
```

**Client views — UI only:**

```text
TEAM_ENTRY | BRIEFING | CONTROL_ROOM | EVIDENCE | BOARD | CIPHER | VAULT | RESULT | ADMIN
```

The current view is derived from the session status plus the player's navigation. It is never used to decide game outcomes.

### Architecture

Separate:

- game content (`challenge/*.json`),
- game state (server session),
- validation (server),
- shared pure logic (`shared/`: scoring, NLP utilities, schemas),
- UI,
- visual components.

The organiser can change evidence, aliases, entities, relationships, cipher rules, hints and solution by editing the challenge JSON without rewriting the UI, and must re-run `node scripts/verify-challenge.mjs`.

---

# 28. Final Visual Identity

## EL CÓDIGO ROJO
### THE RED CODE

**CODEVERSE 2.0**  
**PHASE 1 // THE ROYAL MINT**

> **THE PROFESSOR LEFT THE CODE.**  
> **THE FILES LEFT THE TRAIL.**  
> **FIND THE RED KEY.**
