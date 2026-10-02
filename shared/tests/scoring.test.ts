import { describe, it, expect } from "vitest";
import { computeScore, normaliseScore } from "../src/scoring.js";
import type { Scoring } from "../src/schemas/server.js";

const scoring: Scoring = {
  base: 1000,
  min_time_multiplier: 0.6,
  wrong_attempt_multiplier: 0.95,
  speed_bonus_points: 50,
  speed_bonus_fraction: 0.5,
  check_limit: 3,
  check_penalty_seconds: 30,
  attempt_limit: 3,
  raw_max: 1050,
  display_max: 10,
};

describe("scoring", () => {
  it("worked example: 768s, Hint1, 1 wrong, 0 checks → 594", () => {
    const result = computeScore({
      elapsedSeconds: 768,
      checksUsed: 0,
      wrongAttempts: 1,
      scoring,
      usedHintMultipliers: [0.95],
      durationSeconds: 900,
    });
    expect(result.score).toBe(594);
    expect(result.speedBonus).toBe(0);
  });

  it("clamps time multiplier at 0.60 when elapsed = duration", () => {
    const result = computeScore({
      elapsedSeconds: 900,
      checksUsed: 0,
      wrongAttempts: 0,
      scoring,
      usedHintMultipliers: [],
      durationSeconds: 900,
    });
    expect(result.timeMultiplier).toBe(0.6);
  });

  it("speed bonus applied when effective < 0.5 × duration (< 450 s)", () => {
    const result = computeScore({
      elapsedSeconds: 449,
      checksUsed: 0,
      wrongAttempts: 0,
      scoring,
      usedHintMultipliers: [],
      durationSeconds: 900,
    });
    expect(result.speedBonus).toBe(50);
  });

  it("no speed bonus at exactly 450 s", () => {
    const result = computeScore({
      elapsedSeconds: 450,
      checksUsed: 0,
      wrongAttempts: 0,
      scoring,
      usedHintMultipliers: [],
      durationSeconds: 900,
    });
    expect(result.speedBonus).toBe(0);
  });

  it("cumulative hint multipliers ≈ 0.727 for all three hints", () => {
    const result = computeScore({
      elapsedSeconds: 0,
      checksUsed: 0,
      wrongAttempts: 0,
      scoring,
      usedHintMultipliers: [0.95, 0.9, 0.85],
      durationSeconds: 900,
    });
    // 0.95 * 0.90 * 0.85 ≈ 0.72675
    expect(result.hintMultiplier).toBeCloseTo(0.72675, 4);
  });

  it("check penalty adds to effective seconds", () => {
    const withCheck = computeScore({
      elapsedSeconds: 400,
      checksUsed: 1,
      wrongAttempts: 0,
      scoring,
      usedHintMultipliers: [],
      durationSeconds: 900,
    });
    const noCheck = computeScore({
      elapsedSeconds: 400,
      checksUsed: 0,
      wrongAttempts: 0,
      scoring,
      usedHintMultipliers: [],
      durationSeconds: 900,
    });
    expect(withCheck.effectiveSeconds).toBe(430);
    expect(withCheck.score).toBeLessThan(noCheck.score);
  });

  it("effective seconds capped at duration", () => {
    const result = computeScore({
      elapsedSeconds: 890,
      checksUsed: 3,
      wrongAttempts: 0,
      scoring,
      usedHintMultipliers: [],
      durationSeconds: 900,
    });
    expect(result.effectiveSeconds).toBe(900);
  });

  describe("normaliseScore", () => {
    it("normalises 1050 to 10", () => {
      expect(normaliseScore(1050)).toBe(10);
      expect(normaliseScore(1050, scoring)).toBe(10);
    });

    it("normalises 594 to 6", () => {
      expect(normaliseScore(594)).toBe(6);
      expect(normaliseScore(594, scoring)).toBe(6);
    });

    it("normalises 0 to 0", () => {
      expect(normaliseScore(0)).toBe(0);
      expect(normaliseScore(0, scoring)).toBe(0);
    });

    it("clamps scores outside range [0, 10]", () => {
      expect(normaliseScore(-10)).toBe(0);
      expect(normaliseScore(2000)).toBe(10);
    });
  });
});

