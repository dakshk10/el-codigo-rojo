export type SessionStatus =
  | "NOT_STARTED"
  | "ACTIVE"
  | "SOLVED"
  | "EXPIRED"
  | "LOCKED_OUT";

export interface HintSnapshot {
  id: number;
  title: string;
  penaltyPercent: number;
  used: boolean;
  text: string | null;
}

export interface EvidenceSnapshot {
  id: string;
  ordinal: number;
  title: string;
  unlocked: boolean;
  opened: boolean;
}

export interface ResultSnapshot {
  score: number;
  elapsedSeconds: number;
  hintsUsed: number;
  wrongAttempts: number;
  checksUsed: number;
  speedBonus: number;
}

export interface SessionSnapshot {
  status: SessionStatus;
  serverNow: number;
  endsAt: number | null;
  durationSeconds: number;
  team: { name: string };
  evidence: EvidenceSnapshot[];
  hints: HintSnapshot[];
  attemptsRemaining: number;
  checksRemaining: number;
  workspace: Record<string, unknown>;
  result: ResultSnapshot | null;
}
