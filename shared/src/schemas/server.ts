import { z } from "zod";

const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  initials: z.string(),
  role: z.string(),
  badge: z.string(),
  alias: z.string().nullable(),
});

const VoiceSchema = z.object({
  callsign: z.string(),
  carries_key: z.boolean(),
  on_channel: z.boolean().optional(),
  note: z.string().optional(),
});

const AliasCluSchema = z.object({
  alias: z.string(),
  initials: z.string(),
  role: z.string(),
  took_swap: z.boolean(),
});

const TargetDateRuleSchema = z.object({
  kind: z.string(),
  month: z.string(),
  weekday: z.string(),
  n: z.number().int().positive(),
});

const SwapSchema = z.object({
  id: z.string(),
  date: z.string(),
  covers: z.string(),
  cover_by: z.string(),
});

const AssignmentSchema = z.object({
  date: z.string(),
  panel: z.number().int(),
  person: z.string().nullable(),
});

const FrameSchema = z.object({
  tag: z.number().int(),
  date: z.string(),
  badge: z.string().nullable(),
  location: z.string().nullable(),
});

const LotSchema = z.object({
  lot: z.number().int(),
  series: z.string(),
  casting: z.number().int().nullable(),
  seal: z.string().nullable(),
  status: z.string(),
});

const CipherSchema = z.object({
  type: z.literal("digit_shift"),
  shift_source: z.string(),
  wrap_modulus: z.number().int().positive(),
  explanation_clue_id: z.string(),
});

const SolutionSchema = z.object({
  extracted_values: z.object({
    door: z.number().int(),
    witness: z.number().int(),
    metal: z.number().int(),
  }),
  transformed_values: z.object({
    door: z.string(),
    witness: z.string(),
    metal: z.string(),
  }),
  shift: z.number().int().nonnegative(),
  final_code: z.string().regex(/^\d{6}$/),
});

const NeedleSchema = z.object({
  evidence: z.string(),
  text: z.string(),
});

const HintSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  multiplier: z.number().positive().max(1),
  text: z.string(),
});

const ScoringSchema = z.object({
  base: z.number().int().positive(),
  min_time_multiplier: z.number().positive().max(1),
  wrong_attempt_multiplier: z.number().positive().max(1),
  speed_bonus_points: z.number().int().nonnegative(),
  speed_bonus_fraction: z.number().positive().max(1),
  check_limit: z.number().int().positive(),
  check_penalty_seconds: z.number().int().nonnegative(),
  attempt_limit: z.number().int().positive(),
  raw_max: z.number().positive().default(1050),
  display_max: z.number().positive().default(10),
});

export const ServerChallengeSchema = z.object({
  challenge_id: z.string(),
  _warning: z.string(),
  people: z.array(PersonSchema),
  voices: z.array(VoiceSchema),
  alias_clue: AliasCluSchema,
  target_date_rule: TargetDateRuleSchema,
  swaps: z.array(SwapSchema),
  assignments: z.array(AssignmentSchema),
  frames: z.array(FrameSchema),
  lots: z.array(LotSchema),
  seal_synonyms: z.record(z.array(z.string())),
  cipher: CipherSchema,
  ordering: z.array(z.string()),
  solution: SolutionSchema,
  needles: z.array(NeedleSchema),
  hints: z.array(HintSchema),
  scoring: ScoringSchema,
});

export type ServerChallenge = z.infer<typeof ServerChallengeSchema>;
export type Hint = z.infer<typeof HintSchema>;
export type Scoring = z.infer<typeof ScoringSchema>;
