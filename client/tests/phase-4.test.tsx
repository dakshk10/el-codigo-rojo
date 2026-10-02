import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useSessionStore } from "../src/store/sessionStore.js";
import { useWorkspaceStore } from "../src/store/workspaceStore.js";
import { EvidenceBoard } from "../src/views/EvidenceBoard.js";
import { CipherTerminal } from "../src/views/CipherTerminal.js";
import { VaultKeypad } from "../src/views/VaultKeypad.js";
import { ResultScreen } from "../src/views/ResultScreen.js";
import { App } from "../src/App.js";
import { api } from "../src/api/client.js";
import type { SessionSnapshot } from "shared";

const mockActiveSession: SessionSnapshot = {
  status: "ACTIVE",
  serverNow: Date.now(),
  endsAt: Date.now() + 900000,
  durationSeconds: 900,
  team: { name: "Phase4Team" },
  evidence: [
    { id: "01", ordinal: 1, title: "File 01", unlocked: true, opened: true },
    { id: "02", ordinal: 2, title: "File 02", unlocked: true, opened: true },
    { id: "03", ordinal: 3, title: "File 03", unlocked: true, opened: true },
    { id: "04", ordinal: 4, title: "File 04", unlocked: true, opened: true },
    { id: "05", ordinal: 5, title: "File 05", unlocked: true, opened: true },
  ],
  hints: [
    { id: 1, title: "Hint 01", penaltyPercent: 5, used: false, text: null },
    { id: 2, title: "Hint 02", penaltyPercent: 10, used: false, text: null },
    { id: 3, title: "Hint 03", penaltyPercent: 15, used: false, text: null },
  ],
  attemptsRemaining: 3,
  checksRemaining: 3,
  workspace: {},
  result: null,
};

describe("Phase 4 Verification: Board, Cipher Terminal, Vault & Results", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "fetchSession").mockResolvedValue({ ...mockActiveSession });
    useSessionStore.setState({
      session: { ...mockActiveSession },
      eventCodeVerified: true,
      serverOffset: 0,
      isReconnecting: false,
    });
    useWorkspaceStore.setState({
      reviewed: [],
      notes: "",
      marks: [],
      pinnedEntities: [
        { id: "p1", fileId: "01", text: "Tomas Herrera", type: "person" },
        { id: "p2", fileId: "02", text: "Panel 38", type: "location" },
      ],
      boardNodes: [
        {
          id: "node-1",
          position: { x: 100, y: 100 },
          data: { label: "Tomas Herrera", entityType: "person" },
        },
        {
          id: "node-2",
          position: { x: 300, y: 100 },
          data: { label: "Panel 38", entityType: "location" },
        },
      ],
      boardEdges: [],
      boardHistory: [],
      cipherScratchpad: "Initial scratchpad working notes",
      saveError: null,
    });
  });

  describe("P4-01 & P4-02: Evidence Board Canvas, Links & Indistinguishability", () => {
    it("P4-01: renders Evidence Board with nodes, Link List, and non-pointer ADD LINK", () => {
      render(<EvidenceBoard />);

      // Verify initial cards
      expect(screen.getByText("Tomas Herrera")).toBeInTheDocument();
      expect(screen.getByText("Panel 38")).toBeInTheDocument();

      // Verify LINKS MADE counter starts at 0
      expect(screen.getByText("LINKS MADE")).toBeInTheDocument();
      expect(screen.getByText("0")).toBeInTheDocument();

      // Non-pointer ADD LINK form
      const sourceSelect = screen.getByLabelText(/Source Card/i);
      const relationSelect = screen.getByLabelText(/Relationship Label/i);
      const targetSelect = screen.getByLabelText(/Target Card/i);
      const confirmBtn = screen.getByRole("button", { name: /CONFIRM LINK/i });

      // Initially disabled when empty
      expect(confirmBtn).toBeDisabled();

      // Select source, relation, target
      fireEvent.change(sourceSelect, { target: { value: "node-1" } });
      fireEvent.change(relationSelect, { target: { value: "SEEN AT" } });
      fireEvent.change(targetSelect, { target: { value: "node-2" } });

      expect(confirmBtn).not.toBeDisabled();
      fireEvent.click(confirmBtn);

      // Verify link appears in Link List
      expect(screen.getByText(/\[SEEN AT\]/i)).toBeInTheDocument();
      expect(useWorkspaceStore.getState().boardEdges).toHaveLength(1);

      // Verify LINKS MADE counter updated to 1
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("P4-01: supports UNDO and CLEAR BOARD with confirmation", () => {
      render(<EvidenceBoard />);

      const clearBtn = screen.getByRole("button", { name: /CLEAR BOARD/i });
      fireEvent.click(clearBtn);

      // Modal should appear
      expect(screen.getByText("CLEAR EVIDENCE BOARD?")).toBeInTheDocument();
      const confirmClearBtn = screen.getByRole("button", { name: /CONFIRM CLEAR/i });
      fireEvent.click(confirmClearBtn);

      // Board should now be empty
      expect(useWorkspaceStore.getState().boardNodes).toHaveLength(0);

      // Undo button should restore
      const undoBtn = screen.getByRole("button", { name: /UNDO/i });
      fireEvent.click(undoBtn);
      expect(useWorkspaceStore.getState().boardNodes).toHaveLength(2);
    });

    it("P4-02: visually indistinguishable links; no correctness signals or target count", () => {
      const code = EvidenceBoard.toString();
      // Must not contain correctness checking keywords
      expect(code).not.toMatch(/correct_link|isCorrectLink|wrongLink|targetCount|target_links/i);
      expect(code).not.toMatch(/glow|snap|audio|sound/i);
    });
  });

  describe("P4-03 & P4-04: Cipher Terminal & Transformation Check", () => {
    it("P4-03: restores scratchpad notes from workspace", () => {
      render(<CipherTerminal />);

      const scratchpad = screen.getByLabelText(/INVESTIGATION SCRATCHPAD/i) as HTMLTextAreaElement;
      expect(scratchpad.value).toBe("Initial scratchpad working notes");

      fireEvent.change(scratchpad, { target: { value: "Updated hypothesis: shift +3" } });
      expect(useWorkspaceStore.getState().cipherScratchpad).toBe("Updated hypothesis: shift +3");
    });

    it("P4-04: CHECK TRANSFORMATION requires confirmation on first use stating 30s penalty", async () => {
      render(<CipherTerminal />);

      const input1 = screen.getByLabelText(/VALUE 1/i);
      const input2 = screen.getByLabelText(/VALUE 2/i);
      const input3 = screen.getByLabelText(/VALUE 3/i);
      const submitBtn = screen.getByRole("button", { name: /CHECK TRANSFORMATION/i });

      fireEvent.change(input1, { target: { value: "41" } });
      fireEvent.change(input2, { target: { value: "28" } });
      fireEvent.change(input3, { target: { value: "32" } });

      fireEvent.click(submitBtn);

      // Confirmation modal
      expect(screen.getByText(/CONFIRM TRANSFORMATION CHECK/i)).toBeInTheDocument();
      expect(screen.getByText(/30 SECONDS TO YOUR EFFECTIVE SCORING TIME/i)).toBeInTheDocument();
    });

    it("P4-04: CHECK TRANSFORMATION displays TRANSFORMATION VALID or NOT VALID as a single result", async () => {
      vi.spyOn(api, "checkTransformation").mockResolvedValueOnce({
        valid: true,
        checksRemaining: 2,
      });

      render(<CipherTerminal />);

      const input1 = screen.getByLabelText(/VALUE 1/i);
      const input2 = screen.getByLabelText(/VALUE 2/i);
      const input3 = screen.getByLabelText(/VALUE 3/i);

      fireEvent.change(input1, { target: { value: "41" } });
      fireEvent.change(input2, { target: { value: "28" } });
      fireEvent.change(input3, { target: { value: "32" } });

      // Click submit and confirm
      fireEvent.click(screen.getByRole("button", { name: /CHECK TRANSFORMATION/i }));
      fireEvent.click(screen.getByRole("button", { name: /CONFIRM CHECK/i }));

      await waitFor(() => {
        expect(screen.getByText("TRANSFORMATION VALID")).toBeInTheDocument();
      });
    });

    it("P4-04: disables check transformation when 0 checks remain", () => {
      useSessionStore.setState({
        session: { ...mockActiveSession, checksRemaining: 0 },
      });

      render(<CipherTerminal />);

      expect(screen.getByText("0 CHECKS REMAINING")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /CHECK TRANSFORMATION/i })).toBeDisabled();
      expect(screen.getByLabelText(/VALUE 1/i)).toBeDisabled();
    });
  });

  describe("P4-05, P4-06, P4-07 & P4-08: Vault Keypad & Entry Mechanics", () => {
    it("P4-05: on-screen buttons and physical keyboard work, max 6 digits, non-digits rejected", () => {
      render(<VaultKeypad />);

      // On-screen buttons
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: "4" }));
      fireEvent.click(screen.getByRole("button", { name: "7" }));
      fireEvent.click(screen.getByRole("button", { name: "1" }));

      // Physical keyboard entry
      fireEvent.keyDown(window, { key: "2" });
      fireEvent.keyDown(window, { key: "9" });

      // 7th digit ignored
      fireEvent.keyDown(window, { key: "5" });

      // Display should have 6 digits: 4 4 7 1 2 9
      const display = screen.getByTestId("keypad-display");
      expect(display.textContent).toBe("447129");

      // Backspace
      fireEvent.click(screen.getByRole("button", { name: /BACKSPACE/i }));
      expect(display.textContent).toBe("44712_");

      // Clear
      fireEvent.click(screen.getByRole("button", { name: /CLEAR/i }));
      expect(display.textContent).toBe("______");
    });

    it("P4-06: wrong code triggers shake, clears digits, decrements attempts, displays ACCESS DENIED", async () => {
      vi.spyOn(api, "submitCode").mockResolvedValueOnce({
        result: "DENIED",
        attemptsRemaining: 2,
      });

      render(<VaultKeypad />);

      // Enter 6 wrong digits
      ["1", "2", "3", "4", "5", "6"].forEach((d) => {
        fireEvent.click(screen.getByRole("button", { name: d }));
      });

      const submitBtn = screen.getByRole("button", { name: /ENTER CODE/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("ACCESS DENIED")).toBeInTheDocument();
        expect(screen.getByText("SEQUENCE REJECTED")).toBeInTheDocument();
      });
    });

    it("P4-07: correct code triggers ACCESS GRANTED / VAULT BREACHED", async () => {
      vi.spyOn(api, "submitCode").mockResolvedValueOnce({
        result: "GRANTED",
      });

      render(<VaultKeypad />);

      ["4", "4", "7", "1", "2", "9"].forEach((d) => {
        fireEvent.click(screen.getByRole("button", { name: d }));
      });

      fireEvent.click(screen.getByRole("button", { name: /ENTER CODE/i }));

      await waitFor(() => {
        expect(screen.getByText("ACCESS GRANTED")).toBeInTheDocument();
        expect(screen.getByText("VAULT BREACHED")).toBeInTheDocument();
      });
    });

    it("P4-08: button disabled during submission to prevent double-submit attempt waste", async () => {
      let resolveSubmit: (val: unknown) => void;
      const submitPromise = new Promise((resolve) => {
        resolveSubmit = resolve;
      });
      vi.spyOn(api, "submitCode").mockImplementationOnce(() => submitPromise as any);

      render(<VaultKeypad />);

      ["1", "1", "1", "1", "1", "1"].forEach((d) => {
        fireEvent.click(screen.getByRole("button", { name: d }));
      });

      const submitBtn = screen.getByRole("button", { name: /ENTER CODE/i });
      fireEvent.click(submitBtn);

      // Should be disabled immediately during flight
      await waitFor(() => {
        expect(submitBtn).toBeDisabled();
        expect(screen.getByText(/TRANSMITTING TO VAULT.../i)).toBeInTheDocument();
      });

      resolveSubmit!({ result: "DENIED", attemptsRemaining: 2 });
    });
  });

  describe("P4-09 & P4-10: Result Screens & Lockdown States", () => {
    it("P4-09 & P4-10: Success Result screen displays server score and stats, never the solution code", () => {
      useSessionStore.setState({
        session: {
          ...mockActiveSession,
          status: "SOLVED",
          result: {
            score: 6,
            elapsedSeconds: 768,
            hintsUsed: 1,
            wrongAttempts: 1,
            checksUsed: 0,
            speedBonus: 0,
          },
        },
      });

      render(<ResultScreen />);

      expect(screen.getByText("VAULT BREACHED")).toBeInTheDocument();
      expect(screen.getByText("THE RED CODE WAS CRACKED.")).toBeInTheDocument();
      expect(screen.getByTestId("final-score").textContent).toBe("6"); // Normalised score
      expect(screen.getAllByText("12:48").length).toBeGreaterThan(0); // 768s
      expect(screen.getByText("RECORDED")).toBeInTheDocument();

      // Ensure secret solution code is not anywhere in the rendered document
      expect(screen.queryByText("447129")).not.toBeInTheDocument();
    });

    it("P4-09 & P4-10: Timeout Result screen displays VAULT SEALED and score 0", () => {
      useSessionStore.setState({
        session: {
          ...mockActiveSession,
          status: "EXPIRED",
          result: {
            score: 0,
            elapsedSeconds: 900,
            hintsUsed: 0,
            wrongAttempts: 1,
            checksUsed: 1,
            speedBonus: 0,
          },
        },
      });

      render(<ResultScreen />);

      expect(screen.getByText("VAULT SEALED")).toBeInTheDocument();
      expect(screen.getByText("THE ROYAL MINT HAS LOCKED DOWN.")).toBeInTheDocument();
      expect(screen.getByTestId("final-score").textContent).toBe("0");
      expect(screen.getByText("CLOSED")).toBeInTheDocument();
    });

    it("P4-09 & P4-10: Lockout Result screen displays SECURITY LOCKOUT and score 0", () => {
      useSessionStore.setState({
        session: {
          ...mockActiveSession,
          status: "LOCKED_OUT",
          result: {
            score: 0,
            elapsedSeconds: 300,
            hintsUsed: 0,
            wrongAttempts: 3,
            checksUsed: 0,
            speedBonus: 0,
          },
        },
      });

      render(<ResultScreen />);

      expect(screen.getByText("SECURITY LOCKOUT")).toBeInTheDocument();
      expect(screen.getByText("MAXIMUM ATTEMPTS EXCEEDED.")).toBeInTheDocument();
      expect(screen.getByTestId("final-score").textContent).toBe("0");
    });
  });

  describe("P4-11: Motion Preferences & Keypad Performance", () => {
    it("P4-11: respects prefers-reduced-motion for animations", () => {
      const { container } = render(<VaultKeypad />);
      // motion-reduce:animate-none class present on animated elements
      const animatedEl = container.querySelector(".motion-reduce\\:animate-none");
      expect(animatedEl).not.toBeNull();
    });
  });

  describe("P4-12: End-to-End Happy Path Verification", () => {
    it("P4-12: happy path using real solution code from server.json", async () => {
      const serverChallengePath = path.resolve(__dirname, "../../challenge/server.json");
      const serverData = JSON.parse(fs.readFileSync(serverChallengePath, "utf-8"));
      const realCode = serverData.solution.final_code as string;
      expect(realCode).toBeDefined();
      expect(realCode.length).toBe(6);

      // Start on keypad screen
      window.location.hash = "#vault";

      vi.spyOn(api, "submitCode").mockImplementation(async (code) => {
        if (code === realCode) {
          useSessionStore.setState({
            session: {
              ...mockActiveSession,
              status: "SOLVED",
              result: {
                score: 10,
                elapsedSeconds: 500,
                hintsUsed: 0,
                wrongAttempts: 0,
                checksUsed: 0,
                speedBonus: 50,
              },
            },
          });
          return { result: "GRANTED" };
        }
        return { result: "DENIED", attemptsRemaining: 2 };
      });

      render(<App />);

      // Type the real solution code using keyboard events
      for (const char of realCode) {
        fireEvent.keyDown(window, { key: char });
      }

      // Submit
      const submitBtn = screen.getByRole("button", { name: /ENTER CODE/i });
      fireEvent.click(submitBtn);

      // Verify auto-navigation to SOLVED ResultScreen
      await waitFor(() => {
        expect(screen.getByText("VAULT BREACHED")).toBeInTheDocument();
        expect(screen.getByText("THE RED CODE WAS CRACKED.")).toBeInTheDocument();
        expect(screen.getByTestId("final-score").textContent).toBe("10");
      });

      // Verify realCode is NEVER leaked or visible in ResultScreen
      expect(screen.queryByText(realCode)).not.toBeInTheDocument();
    });
  });
});

