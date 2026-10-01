import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { EventGate } from "../src/views/EventGate.js";
import { TeamEntry } from "../src/views/TeamEntry.js";
import { Briefing } from "../src/views/Briefing.js";
import { App } from "../src/App.js";
import { api, ApiError } from "../src/api/client.js";
import { useSessionStore } from "../src/store/sessionStore.js";
import type { SessionSnapshot } from "shared";

describe("Views and Copy (P2-02, P2-03, P2-07)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    useSessionStore.setState({
      session: null,
      eventCodeVerified: false,
      isReconnecting: false,
      reconnectAttempt: 0,
    });
  });

  describe("P2-02: Event Access Code & Team Entry Screens", () => {
    it("Screen 00a matches UX §4 copy and neutral error message", async () => {
      const onSuccess = vi.fn();
      render(<EventGate onSuccess={onSuccess} />);

      // Verify exact header copy
      expect(screen.getByText("CODEVERSE 2.0")).toBeDefined();
      expect(screen.getByText("PHASE 1 // THE ROYAL MINT")).toBeDefined();
      expect(screen.getByText("RESTRICTED ACCESS")).toBeDefined();
      expect(
        screen.getByText("ENTER THE OPERATION CODE GIVEN AT THE VENUE")
      ).toBeDefined();

      const input = screen.getByPlaceholderText("ACCESS CODE");
      const button = screen.getByRole("button", { name: "CONTINUE" });

      // Wrong code test
      vi.spyOn(api, "verifyEventCode").mockRejectedValueOnce(
        new ApiError(403, "WRONG_EVENT_CODE", "Invalid access code.")
      );

      fireEvent.change(input, { target: { value: "WRONG-CODE" } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("ACCESS DENIED")).toBeDefined();
      });
      expect(onSuccess).not.toHaveBeenCalled();

      // Right code test
      vi.spyOn(api, "verifyEventCode").mockResolvedValueOnce({ ok: true });
      fireEvent.change(input, { target: { value: "VALID-EVENT-CODE" } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it("Screen 00b matches UX §4 copy, validation, and neutral error message", async () => {
      const onSuccess = vi.fn();
      render(<TeamEntry onSuccess={onSuccess} />);

      // Header & helper copy
      expect(screen.getByText("CODEVERSE 2.0")).toBeDefined();
      expect(screen.getByText("PHASE 1 // THE ROYAL MINT")).toBeDefined();
      expect(
        screen.getByText("RETURNING? ENTER THE SAME NAME AND PASSCODE TO RESUME.")
      ).toBeDefined();
      expect(
        screen.getByText("CHOOSE A PASSCODE YOUR WHOLE TEAM WILL REMEMBER.")
      ).toBeDefined();

      const nameInput = screen.getByLabelText("TEAM NAME");
      const passcodeInput = screen.getByLabelText("TEAM PASSCODE");
      const submitBtn = screen.getByRole("button", { name: /ENTER OPERATION/i });

      // Client validation: short name & short passcode
      fireEvent.change(nameInput, { target: { value: "AB" } });
      fireEvent.change(passcodeInput, { target: { value: "12" } });
      fireEvent.click(submitBtn);

      expect(
        screen.getByText(
          "TEAM NAME MUST BE 3–24 CHARACTERS (LETTERS, DIGITS, SPACES, HYPHENS)"
        )
      ).toBeDefined();
      expect(
        screen.getByText("PASSCODE MUST BE EXACTLY 4 DIGITS")
      ).toBeDefined();

      // Neutral error for wrong credentials (UX §4)
      vi.spyOn(api, "enterTeam").mockRejectedValueOnce(
        new ApiError(401, "UNAUTHORIZED", "Invalid team name or passcode.")
      );

      fireEvent.change(nameInput, { target: { value: "RESISTANCE-ALPHA" } });
      fireEvent.change(passcodeInput, { target: { value: "1234" } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText(
            "THAT TEAM NAME IS TAKEN, OR THE PASSCODE IS INCORRECT."
          )
        ).toBeDefined();
      });
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe("P2-03: Briefing Copy and BEGIN HEIST", () => {
    it("Screen 01 matches UX §5 copy verbatim and starts the timer", async () => {
      const onStart = vi.fn();
      const mockSession: SessionSnapshot = {
        status: "ACTIVE",
        serverNow: Date.now(),
        endsAt: Date.now() + 900000,
        durationSeconds: 900,
        team: { name: "RESISTANCE-ALPHA" },
        evidence: [],
        hints: [],
        attemptsRemaining: 3,
        checksRemaining: 3,
        workspace: {},
        result: null,
      };

      vi.spyOn(api, "startSession").mockResolvedValueOnce(mockSession);

      render(<Briefing onStart={onStart} />);

      // Verify exact UX §5 copy
      expect(screen.getByText("CODEVERSE 2.0")).toBeDefined();
      expect(screen.getByText("PHASE 1 // THE ROYAL MINT")).toBeDefined();
      expect(screen.getByText("EL CÓDIGO ROJO")).toBeDefined();
      expect(
        screen.getByText(/THE PROFESSOR LEFT ONE KEY\.\s*FIND IT BEFORE THE TIMER RUNS OUT\./)
      ).toBeDefined();
      expect(
        screen.getByText("The Royal Mint vault has been isolated.")
      ).toBeDefined();
      expect(
        screen.getByText(/Five evidence files\.\s*One hidden chain\.\s*One final access code\./)
      ).toBeDefined();
      expect(
        screen.getByText(/Read carefully\.\s*Connect the clues\.\s*Crack the code\./)
      ).toBeDefined();
      expect(screen.getByText("DURATION")).toBeDefined();
      expect(screen.getByText("15:00")).toBeDefined();
      expect(screen.getByText("OBJECTIVE")).toBeDefined();
      expect(screen.getByText("BREACH THE VAULT")).toBeDefined();
      expect(
        screen.getByText("EXTERNAL SEARCH IS NOT REQUIRED.")
      ).toBeDefined();

      const beginBtn = screen.getByRole("button", { name: /BEGIN HEIST/i });
      fireEvent.click(beginBtn);

      await waitFor(() => {
        expect(api.startSession).toHaveBeenCalledTimes(1);
        expect(onStart).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("P2-07: Refresh restores view and timer; killing network shows reconnect banner", () => {
    it("shows SIGNAL LOST // RECONNECTING when network fails and recovers when restored", async () => {
      const mockSession: SessionSnapshot = {
        status: "ACTIVE",
        serverNow: Date.now(),
        endsAt: Date.now() + 850000,
        durationSeconds: 900,
        team: { name: "TEST-TEAM" },
        evidence: [],
        hints: [],
        attemptsRemaining: 3,
        checksRemaining: 3,
        workspace: {},
        result: null,
      };

      // Initially logged in and verified
      sessionStorage.setItem("event_code_verified", "true");
      useSessionStore.getState().setSession(mockSession);
      useSessionStore.setState({ eventCodeVerified: true });

      // First poll succeeds
      vi.spyOn(api, "fetchSession").mockResolvedValueOnce(mockSession);

      render(<App />);

      // Should show control room shell and timer
      expect(screen.getByText("CONTROL ROOM")).toBeDefined();
      expect(screen.getByText("TEST-TEAM")).toBeDefined();

      // Now simulate network failure during poll
      vi.spyOn(api, "fetchSession").mockRejectedValueOnce(
        new Error("Network Error")
      );

      // Trigger fetchSession failure
      await act(async () => {
        await useSessionStore.getState().fetchSession();
      });

      // Banner should be visible with verbatim copy
      expect(
        screen.getByText("SIGNAL LOST // RECONNECTING")
      ).toBeDefined();

      // Now simulate network recovery
      vi.spyOn(api, "fetchSession").mockResolvedValueOnce(mockSession);
      await act(async () => {
        await useSessionStore.getState().fetchSession();
      });

      // Banner should disappear
      expect(
        screen.queryByText("SIGNAL LOST // RECONNECTING")
      ).toBeNull();
    });
  });
});
