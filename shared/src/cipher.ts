/**
 * Digit shift cipher with wrap-around (PRD §12, verify-challenge §7).
 * Each digit d → (d + shift) % modulus.
 * Values are zero-padded to 2 digits before shifting.
 */

export interface CipherInput {
  value: number;
  shift: number;
  wrapModulus: number;
}

/** Shift a single non-negative integer by `shift`, digit by digit, with wrap. */
export function shiftValue(input: CipherInput): string {
  const { value, shift, wrapModulus } = input;
  const padded = String(value).padStart(2, "0");
  return padded
    .split("")
    .map((c) => String((Number(c) + shift) % wrapModulus))
    .join("");
}

export interface OrderInput {
  /** Map of label → shifted string, e.g. { door: "61", witness: "58", metal: "70" } */
  values: Record<string, string>;
  /** Ordered labels, e.g. ["door", "witness", "metal"] */
  ordering: string[];
}

/** Concatenate shifted values in the specified order to produce the final code. */
export function buildCode(input: OrderInput): string {
  return input.ordering.map((k) => {
    const v = input.values[k];
    if (v === undefined) throw new Error(`Missing value for ordering key: ${k}`);
    return v;
  }).join("");
}
