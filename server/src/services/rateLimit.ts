import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "../db.js";

export type RateLimitScope = "event_code" | "team_entry" | "submit" | "check";

interface RateLimitConfig {
  windowSeconds: number;
  maxCount: number;
}

const LIMITS: Record<RateLimitScope, RateLimitConfig> = {
  event_code: { windowSeconds: 600, maxCount: 10 },
  team_entry: { windowSeconds: 600, maxCount: 10 },
  submit: { windowSeconds: 2, maxCount: 1 },
  check: { windowSeconds: 2, maxCount: 1 },
};

/**
 * Increment rate limit counter. Returns true if the request is allowed,
 * false if the limit is exceeded.
 * All state is in the database — safe for serverless.
 */
export async function checkRateLimit(
  db: Kysely<Database>,
  scope: RateLimitScope,
  key: string,
): Promise<boolean> {
  const limit = LIMITS[scope];
  const now = new Date();
  const windowStart = new Date(
    Math.floor(now.getTime() / (limit.windowSeconds * 1000)) *
      (limit.windowSeconds * 1000),
  );

  const result = await db
    .insertInto("rate_limits")
    .values({ scope, key, window_start: windowStart, count: 1 })
    .onConflict((oc) =>
      oc.columns(["scope", "key", "window_start"]).doUpdateSet({
        count: sql<number>`rate_limits.count + 1`,
      }),
    )
    .returning("count")
    .executeTakeFirstOrThrow();

  return result.count <= limit.maxCount;
}
