import React, { useMemo } from "react";
import type { SessionSnapshot } from "shared";

export interface ProjectedScoreProps {
  session: SessionSnapshot | null;
  serverOffset?: number;
}

/**
 * Pure client-side projected score computation implementing the exact canonical
 * formula (PRD §12).
 * Notice: This avoids bundling server.json keys into client static bundles (P2-10).
 */
export function calculateProjectedScore(session: SessionSnapshot | null): number {
  if (!session || !session.endsAt) {
    return 1000;
  }

  const durationSeconds = session.durationSeconds || 900;
  const now = session.serverNow;
  const remainingSeconds = Math.max(0, Math.floor((session.endsAt - now) / 1000));
  const elapsedSeconds = Math.min(
    durationSeconds,
    Math.max(0, durationSeconds - remainingSeconds)
  );

  const checksUsed = Math.max(0, 3 - session.checksRemaining);
  const wrongAttempts = Math.max(0, 3 - session.attemptsRemaining);

  const effective = Math.min(durationSeconds, elapsedSeconds + 30 * checksUsed);
  const timeMultiplier = Math.max(0.6, 1.0 - 0.4 * (effective / durationSeconds));

  const hintMultiplier = session.hints
    .filter((h) => h.used)
    .map((h) => (100 - h.penaltyPercent) / 100)
    .reduce((acc, m) => acc * m, 1.0);

  const attemptMultiplier = Math.pow(0.95, wrongAttempts);
  const rawScore = 1000 * timeMultiplier * hintMultiplier * attemptMultiplier;
  const speedBonus = effective < 0.5 * durationSeconds ? 50 : 0;

  return Math.round(rawScore) + speedBonus;
}

export const ProjectedScore: React.FC<ProjectedScoreProps> = ({ session }) => {
  const projectedScore = useMemo(() => calculateProjectedScore(session), [session]);

  return (
    <div
      data-testid="projected-score-display"
      className="flex items-center gap-1.5 font-mono text-xs text-muted border border-line px-2.5 py-1 bg-bg"
      title="Projected score based on current elapsed time, hints used, and attempts (subject to final server computation on submission)"
    >
      <span className="text-[10px] uppercase text-muted tracking-wider">
        PROJECTED SCORE:
      </span>
      <span className="font-bold text-paper text-sm">{projectedScore}</span>
      <span className="text-[10px] text-amber border border-amber/40 px-1 py-0.2 bg-amber/10 rounded-xs uppercase">
        PROJECTION
      </span>
    </div>
  );
};
