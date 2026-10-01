/**
 * Safely parse a JSONB column value.
 * Real pg returns strings; PGlite returns already-parsed values.
 */
export function parseJsonb<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}
