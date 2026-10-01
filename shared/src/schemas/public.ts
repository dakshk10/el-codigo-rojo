import { z } from "zod";

const EvidenceMetaSchema = z.object({
  source: z.string(),
  timestamp: z.string(),
  classification: z.string(),
  author: z.string(),
  location: z.string(),
});

const EvidenceSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  body: z.string(),
  metadata: EvidenceMetaSchema,
  unlock: z.object({
    requires_opened: z.array(z.string()),
  }),
});

export const PublicChallengeSchema = z.object({
  challenge_id: z.string(),
  title: z.string(),
  duration_seconds: z.number().int().positive(),
  evidence: z.array(EvidenceSchema).min(1),
});

export type PublicChallenge = z.infer<typeof PublicChallengeSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
