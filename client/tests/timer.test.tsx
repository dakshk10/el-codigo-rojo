import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  Timer,
  formatTime,
  getTimerState,
} from "../src/components/timer/Timer.js";
import { useSessionStore } from "../src/store/sessionStore.js";
import type { SessionSnapshot } from "shared";

function makeMockSession(
  endsAt: number | null,
  durationSeconds = 900
): SessionSnapshot {
  return {
    status: "ACTIVE",
    serverNow: Date.now(),
    endsAt,
    durationSeconds,
    team: { name: "TEST-TEAM" },
    evidence: [],
    hints: [],
    attemptsRemaining: 3,
    checksRemaining: 3,
    workspace: {},
    result: null,
  };
}

describe("Timer Component (P2-04, P2-05, P2-06)", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "Date",
        "performance",
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formatTime formats seconds into mm:ss accurately", () => {
    expect(formatTime(900)).toBe("15:00");
    expect(formatTime(600)).toBe("10:00");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(9)).toBe("00:09");
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(-10)).toBe("00:00");
  });

  it("getTimerState returns correct state for thresholds", () => {
    expect(getTimerState(900)).toBe("normal");
    expect(getTimerState(600)).toBe("normal"); // 10:00 is normal + toast
    expect(getTimerState(301)).toBe("normal");
    expect(getTimerState(300)).toBe("warning"); // 05:00 is warning
    expect(getTimerState(61)).toBe("warning");
    expect(getTimerState(60)).toBe("critical"); // 01:00 is critical
    expect(getTimerState(1)).toBe("critical");
    expect(getTimerState(0)).toBe("expired");
  });

  it("P2-04: Timer derives from endsAt + server offset and is immune to browser clock manipulation", () => {
    const serverNow = 1000000;
    // Suppose client clock is 2 hours behind: clientNow = serverNow - 7200000
    const clientNow = serverNow - 7200000;
    vi.setSystemTime(clientNow);

    const endsAt = serverNow + 900000; // 15 mins from serverNow
    const session = makeMockSession(endsAt);
    session.serverNow = serverNow;

    act(() => {
      useSessionStore.getState().setSession(session);
    });

    render(<Timer />);

    // Display should be 15:00
    expect(screen.getByText("15:00")).toBeDefined();

    // Now advance time by 60 seconds (simulating real time passing)
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(screen.getByText("14:00")).toBeDefined();

    // Now artificially change system clock forward by 30 minutes without advancing real timers
    // (simulating user changing their computer's system clock)
    vi.setSystemTime(Date.now() + 1800000);

    // Trigger timer tick
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // The display must still be 14:00 (not jump to 00:00 or negative) because monotonic clock is used
    expect(screen.getByText("14:00")).toBeDefined();
  });

  it("P2-05: Thresholds trigger correctly (10:00 toast, 05:00 warning, 01:00 critical, 00:00 expired)", () => {
    const serverNow = 2000000;
    vi.setSystemTime(serverNow);

    // Set endsAt to exactly 601 seconds remaining
    const endsAt = serverNow + 601000;
    const session = makeMockSession(endsAt);
    session.serverNow = serverNow;

    act(() => {
      useSessionStore.getState().setSession(session);
    });

    const onShowToast = vi.fn();
    const onExpire = vi.fn();

    render(<Timer onShowToast={onShowToast} onExpire={onExpire} />);

    // At 601s (10:01): normal state, toast not called
    expect(screen.getByText("10:01")).toBeDefined();
    expect(screen.getByText("ACTIVE")).toBeDefined();
    expect(onShowToast).not.toHaveBeenCalled();

    // Advance 1s to 600s (10:00) -> 10:00 toast called once
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("10:00")).toBeDefined();
    expect(onShowToast).toHaveBeenCalledWith("10:00 REMAINING");
    expect(onShowToast).toHaveBeenCalledTimes(1);

    // Advance to 300s (05:00) -> warning state
    act(() => {
      vi.advanceTimersByTime(300000);
    });
    expect(screen.getByText("05:00")).toBeDefined();
    expect(screen.getByText("WARNING")).toBeDefined();

    // Advance to 60s (01:00) -> critical state
    act(() => {
      vi.advanceTimersByTime(240000);
    });
    expect(screen.getByText("01:00")).toBeDefined();
    expect(screen.getByText("CRITICAL")).toBeDefined();

    // Advance to 0s (00:00) -> expired state
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(screen.getByText("00:00")).toBeDefined();
    expect(screen.getByText("EXPIRED")).toBeDefined();
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("P2-06: Announces to assistive tech ONLY at the four thresholds, not each second", () => {
    const serverNow = 3000000;
    vi.setSystemTime(serverNow);

    // Start at 602 seconds remaining
    const endsAt = serverNow + 602000;
    const session = makeMockSession(endsAt);
    session.serverNow = serverNow;

    act(() => {
      useSessionStore.getState().setSession(session);
    });

    const { container } = render(<Timer />);

    const liveRegion = container.querySelector('[role="status"][aria-live="polite"]');
    expect(liveRegion).not.toBeNull();

    // At 602s: no announcement yet
    expect(liveRegion?.textContent).toBe("");

    // Advance 1s to 601s: still no announcement
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(liveRegion?.textContent).toBe("");

    // Advance 1s to 600s (10:00): Announcement 1 fires
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(liveRegion?.textContent).toBe("10:00 REMAINING");

    // Advance 5 seconds (599, 598, 597, 596, 595): live region text MUST NOT change every second!
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(liveRegion?.textContent).toBe("10:00 REMAINING");

    // Advance to 300s (05:00): Announcement 2 fires
    act(() => {
      vi.advanceTimersByTime(295000);
    });
    expect(liveRegion?.textContent).toBe("05:00 REMAINING — WARNING");

    // Advance 5 seconds: still unchanged
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(liveRegion?.textContent).toBe("05:00 REMAINING — WARNING");

    // Advance to 60s (01:00): Announcement 3 fires
    act(() => {
      vi.advanceTimersByTime(235000);
    });
    expect(liveRegion?.textContent).toBe("01:00 REMAINING — CRITICAL");

    // Advance to 0s (00:00): Announcement 4 fires
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(liveRegion?.textContent).toBe("00:00 — VAULT SEALED");
  });
});
