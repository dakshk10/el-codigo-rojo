import React from "react";
import { useSessionStore } from "../store/sessionStore.js";

function formatSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const ResultScreen: React.FC = () => {
  const { session } = useSessionStore();
  const status = session?.status;
  const result = session?.result;

  const isSuccess = status === "SOLVED";
  const isExpired = status === "EXPIRED";
  const isLockout = status === "LOCKED_OUT";

  const elapsedSeconds = result?.elapsedSeconds ?? 0;
  const hintsUsed = result?.hintsUsed ?? 0;
  const wrongAttempts = result?.wrongAttempts ?? 0;
  const checksUsed = result?.checksUsed ?? 0;
  const speedBonus = result?.speedBonus ?? 0;
  const finalAttempts = wrongAttempts + (isSuccess ? 1 : 0);

  // Success shows server score (normalised 0-10 or raw); failure shows 0
  const displayScore = isSuccess ? result?.score ?? 0 : 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] bg-bg p-4 font-mono text-paper select-none">
      <div className="max-w-xl w-full bg-panel border border-line p-8 sm:p-10 rounded shadow-2xl space-y-8 text-center">
        {/* Header and Subtitles */}
        <div className="space-y-3">
          {isSuccess && (
            <>
              <h1 className="font-display text-4xl sm:text-5xl tracking-widest text-green">
                VAULT BREACHED
              </h1>
              <div className="text-paper font-semibold tracking-wider text-sm space-y-1">
                <div>THE RED CODE WAS CRACKED.</div>
                <div className="text-muted text-xs">THE CREW GOT THROUGH.</div>
              </div>
            </>
          )}

          {isExpired && (
            <>
              <h1 className="font-display text-4xl sm:text-5xl tracking-widest text-amber">
                VAULT SEALED
              </h1>
              <div className="text-paper font-semibold tracking-wider text-sm space-y-1">
                <div>THE ROYAL MINT HAS LOCKED DOWN.</div>
                <div className="text-muted text-xs">THE WINDOW IS CLOSED.</div>
              </div>
            </>
          )}

          {isLockout && (
            <>
              <h1 className="font-display text-4xl sm:text-5xl tracking-widest text-red-text">
                SECURITY LOCKOUT
              </h1>
              <div className="text-paper font-semibold tracking-wider text-sm space-y-1">
                <div>MAXIMUM ATTEMPTS EXCEEDED.</div>
                <div className="text-muted text-xs">ACCESS TERMINATED.</div>
              </div>
            </>
          )}
        </div>

        {/* Primary Score Box */}
        <div className="bg-bg border border-line p-6 rounded space-y-2">
          <div className="text-muted text-xs tracking-widest uppercase font-bold">
            FINAL SCORE
          </div>
          <div
            data-testid="final-score"
            className={`font-display text-6xl tracking-wider ${
              isSuccess ? "text-paper" : "text-muted"
            }`}
          >
            {displayScore}
          </div>
          {isSuccess && (
            <div className="text-muted text-[11px] tracking-wider uppercase">
              SCALE: 0 – 10 // CANONICAL EVENT SCORE
            </div>
          )}
        </div>

        {/* Key Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
          <div className="bg-bg p-3 border border-line/60 rounded">
            <div className="text-[10px] text-muted uppercase font-bold">
              COMPLETION TIME
            </div>
            <div className="font-bold text-sm text-paper mt-1">
              {formatSeconds(elapsedSeconds)}
            </div>
          </div>

          <div className="bg-bg p-3 border border-line/60 rounded">
            <div className="text-[10px] text-muted uppercase font-bold">
              HINTS USED
            </div>
            <div className="font-bold text-sm text-paper mt-1">
              {hintsUsed}
            </div>
          </div>

          <div className="bg-bg p-3 border border-line/60 rounded">
            <div className="text-[10px] text-muted uppercase font-bold">
              FINAL ATTEMPTS
            </div>
            <div className="font-bold text-sm text-paper mt-1">
              {finalAttempts}
            </div>
          </div>

          <div className="bg-bg p-3 border border-line/60 rounded">
            <div className="text-[10px] text-muted uppercase font-bold">
              CHECKS USED
            </div>
            <div className="font-bold text-sm text-paper mt-1">
              {checksUsed}
            </div>
          </div>
        </div>

        {/* Score Breakdown (Success only) */}
        {isSuccess && (
          <div className="border-t border-line pt-4 text-xs text-muted space-y-2 text-left">
            <div className="font-bold text-paper text-[11px] uppercase tracking-wider mb-2">
              SCORING BREAKDOWN
            </div>
            <div className="flex justify-between">
              <span>TIME FACTOR</span>
              <span className="text-paper">{formatSeconds(elapsedSeconds)}</span>
            </div>
            <div className="flex justify-between">
              <span>HINTS APPLIED</span>
              <span className="text-paper">{hintsUsed}</span>
            </div>
            <div className="flex justify-between">
              <span>WRONG ATTEMPTS</span>
              <span className="text-paper">{wrongAttempts}</span>
            </div>
            <div className="flex justify-between">
              <span>CHECKS PENALTY</span>
              <span className="text-paper">{checksUsed} (+{checksUsed * 30}s)</span>
            </div>
            {speedBonus > 0 && (
              <div className="flex justify-between text-green font-bold">
                <span>SPEED BONUS</span>
                <span>+{speedBonus} PTS</span>
              </div>
            )}
          </div>
        )}

        {/* Submission Status */}
        <div className="border-t border-line pt-4 flex items-center justify-between text-xs text-muted">
          <span className="uppercase tracking-wider">SUBMISSION STATUS</span>
          <span className="text-paper font-bold uppercase tracking-wider border border-line px-2 py-0.5 bg-bg">
            {isSuccess ? "RECORDED" : "CLOSED"}
          </span>
        </div>
      </div>
    </div>
  );
};
