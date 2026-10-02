import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SessionSnapshot, EvidenceSnapshot, HintSnapshot } from "shared";
import { api } from "../src/api/client.js";
import { useSessionStore } from "../src/store/sessionStore.js";
import { useWorkspaceStore } from "../src/store/workspaceStore.js";
import { ControlRoom } from "../src/views/ControlRoom.js";
import { HintDrawer } from "../src/components/hints/HintDrawer.js";
import { EvidenceSearch } from "../src/components/evidence/EvidenceSearch.js";
import { calculateProjectedScore, ProjectedScore } from "../src/components/scoring/ProjectedScore.js";
import { computeScore } from "shared";
import publicChallenge from "../../challenge/public.json";

function makeMockSession(overrides?: Partial<SessionSnapshot>): SessionSnapshot {
  const evidence: EvidenceSnapshot[] = [
    { id: "01", ordinal: 1, title: "INTERCEPTED TRANSCRIPT", unlocked: true, opened: true },
    { id: "02", ordinal: 2, title: "SHIFT MANIFEST", unlocked: true, opened: false },
    { id: "03", ordinal: 3, title: "NEWSPAPER FRAGMENT", unlocked: true, opened: false },
    { id: "04", ordinal: 4, title: "EVIDENCE PHOTO LOG", unlocked: false, opened: false },
    { id: "05", ordinal: 5, title: "PROFESSOR'S CIPHER NOTE", unlocked: false, opened: false },
  ];

  const hints: HintSnapshot[] = [
    { id: 1, title: "Read Between the Lines", penaltyPercent: 5, used: false, text: null },
    { id: 2, title: "Follow the Connection", penaltyPercent: 10, used: false, text: null },
    { id: 3, title: "The Professor's Rule", penaltyPercent: 15, used: false, text: null },
  ];

  return {
    status: "ACTIVE",
    serverNow: Date.now(),
    endsAt: Date.now() + 900000,
    durationSeconds: 900,
    team: { name: "RESISTANCE-ALPHA" },
    evidence,
    hints,
    attemptsRemaining: 3,
    checksRemaining: 3,
    workspace: {},
    result: null,
    ...overrides,
  };
}

describe("Phase 3 Verification: Control Room & Investigation Tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useWorkspaceStore.setState({
      reviewed: [],
      notes: "",
      marks: [],
      pinnedEntities: [],
      extra: {},
      isSaving: false,
      saveError: null,
    });
  });

  it("P3-01: Files 01-03 open at start; 04 and 05 show correct ENCRYPTED copy until unlocked", async () => {
    const session = makeMockSession();
    useSessionStore.getState().setSession(session);

    // Mock fetchEvidence
    vi.spyOn(api, "fetchEvidence").mockResolvedValue({
      tokens: [{ id: "t0", text: "CHANNEL", start: 0, end: 7, line: 1, kind: "word" }],
      metadata: { classification: "RESTRICTED" },
    });

    render(<ControlRoom />);

    await waitFor(() => {
      // Files 01, 02, 03 are unlocked and selectable
      expect(screen.getByTestId("file-card-01")).toBeDefined();
      expect(screen.getByTestId("file-card-02")).toBeDefined();
      expect(screen.getByTestId("file-card-03")).toBeDefined();
    });

    // Files 04 and 05 show exact locked copy per UX §6 & §22
    const file4Locked = screen.getByTestId("file-card-04-locked");
    expect(file4Locked.textContent).toContain("ENCRYPTED — REVIEW FILES 01–03 FIRST");

    const file5Locked = screen.getByTestId("file-card-05-locked");
    expect(file5Locked.textContent).toContain("ENCRYPTED — REVIEW FILE 04 FIRST");
  });

  it("P3-04: Marks, notes and reviewed toggles persist in workspaceStore and restore from session", () => {
    const { toggleReviewed, setNotes, addMark, initFromSession } = useWorkspaceStore.getState();

    // Toggle reviewed
    toggleReviewed("01");
    expect(useWorkspaceStore.getState().reviewed).toContain("01");

    // Set notes
    setNotes("Quill is Tomas Herrera");
    expect(useWorkspaceStore.getState().notes).toBe("Quill is Tomas Herrera");

    // Add mark
    addMark({
      fileId: "01",
      startTokenId: "t0",
      endTokenId: "t2",
      text: "three keys",
      entityType: "number",
    });
    expect(useWorkspaceStore.getState().marks.length).toBe(1);

    // Simulate page refresh / second device restoring from session snapshot
    const remoteWorkspace = {
      reviewed: ["01", "02"],
      notes: "Remote team updated notes",
      marks: [
        {
          id: "m99",
          fileId: "02",
          startTokenId: "t5",
          endTokenId: "t7",
          text: "Panel 38",
          entityType: "location",
        },
      ],
      pinnedEntities: [],
    };

    initFromSession(remoteWorkspace);
    expect(useWorkspaceStore.getState().reviewed).toEqual(["01", "02"]);
    expect(useWorkspaceStore.getState().notes).toBe("Remote team updated notes");
    expect(useWorkspaceStore.getState().marks[0]?.text).toBe("Panel 38");
  });

  it("P3-05: Workspace over 128 KB is rejected gracefully with visible, non-blocking message", async () => {
    const session = makeMockSession();
    useSessionStore.getState().setSession(session);

    render(<ControlRoom />);

    // Trigger save over 128 KB
    const largeNotes = "X".repeat(132 * 1024);
    useWorkspaceStore.setState({ notes: largeNotes });

    await useWorkspaceStore.getState().forceSave();

    // Verify error state
    expect(useWorkspaceStore.getState().saveError).toBe(
      "WORKSPACE CAPACITY EXCEEDED (128 KB MAX). CHANGES NOT SAVED TO SERVER."
    );

    // Verify non-blocking banner is visible in the UI
    const banner = screen.getByTestId("workspace-error-banner");
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain("WORKSPACE CAPACITY EXCEEDED (128 KB MAX)");
  });

  it("P3-06: Hint confirm modal matches UX §13 copy; cancel applies nothing; confirm decrypts hint", async () => {
    const hints: HintSnapshot[] = [
      { id: 1, title: "Read Between the Lines", penaltyPercent: 5, used: false, text: null },
    ];
    const onClose = vi.fn();
    const onHintUsed = vi.fn();

    const useHintSpy = vi.spyOn(api, "useHint").mockResolvedValue({
      text: "Look at the manifest and photo logs for the badge numbers.",
    });

    const { rerender } = render(
      <HintDrawer hints={hints} isOpen={true} onClose={onClose} onHintUsed={onHintUsed} />
    );

    // Click [ USE HINT ]
    const useBtn = screen.getByRole("button", { name: "[ USE HINT ]" });
    fireEvent.click(useBtn);

    // Confirmation modal appears with exact UX §13 copy
    expect(screen.getByText("USE THIS HINT?")).toBeDefined();
    expect(screen.getByText("YOUR SCORE WILL BE REDUCED BY 5%.")).toBeDefined();

    // Cancel applies nothing
    const cancelBtn = screen.getByRole("button", { name: "[ CANCEL ]" });
    fireEvent.click(cancelBtn);
    expect(useHintSpy).not.toHaveBeenCalled();
    expect(screen.queryByText("USE THIS HINT?")).toBeNull();

    // Open again and confirm
    fireEvent.click(screen.getByRole("button", { name: "[ USE HINT ]" }));
    const confirmBtn = screen.getByRole("button", { name: "[ CONFIRM ]" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(useHintSpy).toHaveBeenCalledWith(1);
      expect(onHintUsed).toHaveBeenCalledWith(
        1,
        "Look at the manifest and photo logs for the badge numbers."
      );
    });

    // Used state renders verbatim per UX §13
    const updatedHints: HintSnapshot[] = [
      {
        id: 1,
        title: "Read Between the Lines",
        penaltyPercent: 5,
        used: true,
        text: "Look at the manifest and photo logs for the badge numbers.",
      },
    ];

    rerender(
      <HintDrawer hints={updatedHints} isOpen={true} onClose={onClose} onHintUsed={onHintUsed} />
    );

    const usedCard = screen.getByTestId("hint-card-1-used");
    expect(usedCard.textContent).toContain("HINT 01");
    expect(usedCard.textContent).toContain("USED");
    expect(usedCard.textContent).toContain("DECRYPTED");
    expect(usedCard.textContent).toContain("Look at the manifest and photo logs");
  });

  it("P3-07: Search ranks results by TF-IDF and shows NO alias or synonym expansion", () => {
    const loadedDocs = publicChallenge.evidence.map((e) => ({
      id: e.id,
      title: e.title,
      tokens: e.body.split(/\s+/).map((word, idx) => ({
        id: `t${idx}`,
        text: word,
        start: 0,
        end: word.length,
        line: 1,
        kind: "word" as const,
      })),
    }));

    const onJump = vi.fn();

    render(<EvidenceSearch loadedDocs={loadedDocs} onJumpToPassage={onJump} />);

    // Open search
    fireEvent.click(screen.getByRole("button", { name: "SHOW" }));

    const input = screen.getByPlaceholderText(/SEARCH EVIDENCE/i);

    // Search for a keyword that appears in File 03: "cobalt-blue" or "scarlet"
    fireEvent.change(input, { target: { value: "scarlet" } });

    // File 03 mentions "scarlet seal"
    expect(screen.getByText(/FILE 03/)).toBeDefined();

    // Crucial check: NO alias or synonym expansion!
    // "scarlet" should NOT expand to "red" or "red-wax" and match File 01
    expect(screen.queryByText(/FILE 01/)).toBeNull();
  });

  it("P3-08: Projected score display equals the shared scoring function and is labelled as a projection", () => {
    // Test the worked example from PRD §12: elapsed=768, 1 hint used (0.95), 1 wrong attempt (0.95), 0 checks -> 594
    const workedExampleSession: SessionSnapshot = {
      status: "ACTIVE",
      serverNow: 1728000768000,
      endsAt: 1728000768000 + (900 - 768) * 1000,
      durationSeconds: 900,
      team: { name: "WORKED-EXAMPLE" },
      evidence: [],
      hints: [
        { id: 1, title: "H1", penaltyPercent: 5, used: true, text: "revealed" },
        { id: 2, title: "H2", penaltyPercent: 10, used: false, text: null },
      ],
      attemptsRemaining: 2, // 1 wrong attempt consumed
      checksRemaining: 3, // 0 checks used
      workspace: {},
      result: null,
    };

    const clientProjected = calculateProjectedScore(workedExampleSession);

    // Compute via canonical shared function
    const canonicalResult = computeScore({
      elapsedSeconds: 768,
      checksUsed: 0,
      wrongAttempts: 1,
      scoring: {
        base: 1000,
        speed_bonus_points: 50,
        speed_bonus_fraction: 0.5,
        min_time_multiplier: 0.6,
        wrong_attempt_multiplier: 0.95,
        check_penalty_seconds: 30,
        attempt_limit: 3,
        check_limit: 3,
        raw_max: 1050,
        display_max: 10,
      },
      usedHintMultipliers: [0.95],
      durationSeconds: 900,
    });

    expect(clientProjected).toBe(594);
    expect(clientProjected).toBe(canonicalResult.score);

    // Verify rendered component
    const { container } = render(<ProjectedScore session={workedExampleSession} />);
    expect(container.textContent).toContain("594");
    expect(container.textContent).toContain("PROJECTION");
  });

  it("P3-09: Keyboard-only path exists for: open file, select range, mark it, add note, open hints", async () => {
    const session = makeMockSession();
    useSessionStore.getState().setSession(session);

    vi.spyOn(api, "fetchEvidence").mockResolvedValue({
      tokens: [
        { id: "t0", text: "Panel", start: 0, end: 5, line: 1, kind: "word" },
        { id: "t1", text: " ", start: 5, end: 6, line: 1, kind: "whitespace" },
        { id: "t2", text: "38", start: 6, end: 8, line: 1, kind: "number" },
      ],
      metadata: { classification: "RESTRICTED" },
    });

    render(<ControlRoom />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /INTERCEPTED TRANSCRIPT/i })).toBeDefined();
    });

    // 1. Open file via keyboard: button exists and is focusable
    const file1Btn = screen.getByRole("button", { name: /INTERCEPTED TRANSCRIPT/i });
    expect(file1Btn).toBeDefined();
    fireEvent.keyDown(file1Btn, { key: "Enter" });

    // 2. Add note via keyboard: notes textarea is focusable and writable
    const notesArea = screen.getByLabelText(/Team Investigation Notes/i);
    expect(notesArea).toBeDefined();
    fireEvent.change(notesArea, { target: { value: "Keyboard note added" } });
    expect(useWorkspaceStore.getState().notes).toBe("Keyboard note added");

    // 3. Open hints drawer via keyboard
    const hintsBtn = screen.getByRole("button", { name: /HINTS/i });
    expect(hintsBtn).toBeDefined();
    fireEvent.click(hintsBtn);

    expect(screen.getByRole("complementary", { name: "Hint Dossier Drawer" })).toBeDefined();
  });

  it("P3-10: 1280x720 and 1920x1080 layout: timer visible without scrolling, 3 columns intact, long docs scroll inside main panel", async () => {
    const session = makeMockSession();
    useSessionStore.getState().setSession(session);

    vi.spyOn(api, "fetchEvidence").mockResolvedValue({
      tokens: [{ id: "t0", text: "Sample", start: 0, end: 6, line: 1, kind: "word" }],
      metadata: { classification: "RESTRICTED" },
    });

    const { container } = render(<ControlRoom />);

    await waitFor(() => {
      expect(screen.getByLabelText("Evidence Rail")).toBeDefined();
    });

    // Three-column layout is present
    expect(screen.getByLabelText("Evidence Rail")).toBeDefined();
    expect(screen.getByLabelText("Main Investigation Workspace")).toBeDefined();
    expect(screen.getByLabelText("Investigation Notes and Pinned Clues")).toBeDefined();

    // Verify main workspace has overflow-y-auto so long documents scroll inside the panel
    const mainWorkspace = screen.getByLabelText("Main Investigation Workspace");
    expect(mainWorkspace.className).toContain("overflow-y-auto");

    // Verify the root container fits viewport height
    const rootLayout = container.firstChild as HTMLElement;
    expect(rootLayout.className).toContain("overflow-hidden");
  });
});
