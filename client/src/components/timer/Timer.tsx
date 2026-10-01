import React, { useEffect, useState, useRef } from "react";
import { Clock, AlertTriangle, AlertOctagon } from "lucide-react";
import { useSessionStore } from "../../store/sessionStore.js";

export type TimerState = "normal" | "warning" | "critical" | "expired";

interface TimerProps {
  onShowToast?: (message: string) => void;
  onExpire?: () => void;
}

export function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function getTimerState(remainingSeconds: number): TimerState {
  if (remainingSeconds <= 0) return "expired";
  if (remainingSeconds <= 60) return "critical"; // 01:00 - 00:01
  if (remainingSeconds <= 300) return "warning"; // 05:00 - 01:01
  return "normal"; // 15:00 - 05:01
}

export const Timer: React.FC<TimerProps> = ({ onShowToast, onExpire }) => {
  const { session, serverNowAtFetch, perfNowAtFetch, serverOffset } =
    useSessionStore();

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (!session || !session.endsAt) {
      return session?.durationSeconds ?? 900;
    }
    const perfNow =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsed = perfNow - perfNowAtFetch;
    const currentServerTime = serverNowAtFetch
      ? serverNowAtFetch + elapsed
      : Date.now() + serverOffset;
    return Math.max(0, Math.ceil((session.endsAt - currentServerTime) / 1000));
  });

  const [announcement, setAnnouncement] = useState<string>("");
  const toasted10Ref = useRef(false);
  const announcedThresholdsRef = useRef<Set<number>>(new Set());
  const expiredHandledRef = useRef(false);

  useEffect(() => {
    if (!session?.endsAt) {
      setRemainingSeconds(session?.durationSeconds ?? 900);
      return;
    }

    const updateTimer = () => {
      const perfNow =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsed = perfNow - perfNowAtFetch;
      const currentServerTime = serverNowAtFetch
        ? serverNowAtFetch + elapsed
        : Date.now() + serverOffset;
      const rem = Math.max(0, Math.ceil((session.endsAt! - currentServerTime) / 1000));

      setRemainingSeconds(rem);

      // Check 10:00 toast
      if (rem <= 600 && !toasted10Ref.current && rem > 0) {
        toasted10Ref.current = true;
        onShowToast?.("10:00 REMAINING");
      }

      // Check Assistive Tech announcements ONLY at the four thresholds:
      // 10:00 (600), 05:00 (300), 01:00 (60), 00:00 (0)
      if (rem === 600 && !announcedThresholdsRef.current.has(600)) {
        announcedThresholdsRef.current.add(600);
        setAnnouncement("10:00 REMAINING");
      } else if (rem === 300 && !announcedThresholdsRef.current.has(300)) {
        announcedThresholdsRef.current.add(300);
        setAnnouncement("05:00 REMAINING — WARNING");
      } else if (rem === 60 && !announcedThresholdsRef.current.has(60)) {
        announcedThresholdsRef.current.add(60);
        setAnnouncement("01:00 REMAINING — CRITICAL");
      } else if (rem === 0 && !announcedThresholdsRef.current.has(0)) {
        announcedThresholdsRef.current.add(0);
        setAnnouncement("00:00 — VAULT SEALED");
        if (!expiredHandledRef.current) {
          expiredHandledRef.current = true;
          onExpire?.();
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 250);

    return () => clearInterval(interval);
  }, [
    session?.endsAt,
    session?.durationSeconds,
    serverNowAtFetch,
    perfNowAtFetch,
    serverOffset,
    onShowToast,
    onExpire,
  ]);

  const state = getTimerState(remainingSeconds);
  const formatted = formatTime(remainingSeconds);

  // Warning pulse rule: subtle pulse every 30s during warning state (05:00 to 01:01)
  const is30sPulse =
    state === "warning" && remainingSeconds % 30 < 2 && remainingSeconds > 60;

  return (
    <div className="flex items-center gap-2">
      {/* Screen reader announcement region: updates ONLY at 4 thresholds */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>

      {/* Focusable, accessible timer display container */}
      <div
        tabIndex={0}
        role="timer"
        aria-label={`Mission Timer: ${formatted}, status ${state}`}
        className={`px-3 py-1.5 border font-mono flex items-center gap-2 select-none transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-red-bright ${
          state === "expired"
            ? "border-red-text/50 bg-red-text/10 text-red-text"
            : state === "critical"
            ? "border-red-text bg-panel text-red-text animate-pulse-critical"
            : state === "warning"
            ? `border-amber/60 bg-panel text-amber ${is30sPulse ? "animate-pulse-subtle" : ""}`
            : "border-line bg-panel text-paper"
        }`}
      >
        {state === "critical" ? (
          <AlertOctagon className="w-4 h-4 text-red-text animate-pulse" />
        ) : state === "warning" ? (
          <AlertTriangle className="w-4 h-4 text-amber" />
        ) : (
          <Clock className="w-4 h-4 text-muted" />
        )}

        <span className="text-sm font-bold tracking-widest tabular-nums">
          {formatted}
        </span>

        {/* Textual status indicator so state is never conveyed by colour alone */}
        <span className="text-[10px] uppercase tracking-wider font-sans font-semibold px-1 py-0.5 rounded bg-bg/60">
          {state === "critical"
            ? "CRITICAL"
            : state === "warning"
            ? "WARNING"
            : state === "expired"
            ? "EXPIRED"
            : "ACTIVE"}
        </span>
      </div>
    </div>
  );
};
