import type { Scoring } from "./schemas/server.js";

export interface ScoreInput {
  elapsedSeconds: number;
  checksUsed: number;
  wrongAttempts: number;
  scoring: Scoring;
  /** Multipliers of hints actually used (e.g. [0.95, 0.90]) */
  usedHintMultipliers: number[];
  durationSeconds: number;
}

export interface ScoreResult {
  score: number;
  timeMultiplier: number;
  hintMultiplier: number;
  attemptMultiplier: number;
  speedBonus: number;
  effectiveSeconds: number;
}

/**
 * Canonical scoring formula (PRD §12).
 * Worked example: elapsed=768, durationSeconds=900, usedHintMultipliers=[0.95],
 * wrongAttempts=1, checksUsed=0 → score=594
 */
export function computeScore(input: ScoreInput): ScoreResult {
  const {
    elapsedSeconds,
    checksUsed,
    wrongAttempts,
    scoring,
    usedHintMultipliers,
    durationSeconds,
  } = input;

  const effective = Math.min(
    durationSeconds,
    elapsedSeconds + scoring.check_penalty_seconds * checksUsed,
  );

  const timeMultiplier = Math.max(
    scoring.min_time_multiplier,
    1.0 - 0.4 * (effective / durationSeconds),
  );

  const hintMultiplier = usedHintMultipliers.reduce((acc, m) => acc * m, 1.0);

  const attemptMultiplier = Math.pow(scoring.wrong_attempt_multiplier, wrongAttempts);

  const rawScore = scoring.base * timeMultiplier * hintMultiplier * attemptMultiplier;

  const speedBonus =
    effective < scoring.speed_bonus_fraction * durationSeconds
      ? scoring.speed_bonus_points
      : 0;

  const score = Math.round(rawScore) + speedBonus;

  return {
    score,
    timeMultiplier,
    hintMultiplier,
    attemptMultiplier,
    speedBonus,
    effectiveSeconds: effective,
  };
}
