import type { Token } from "./tokenise.js";

export type EntityType =
  | "person"
  | "alias"
  | "location"
  | "date"
  | "number"
  | "event";

export interface EntityDraft {
  startTokenId: string;
  endTokenId: string;
  text: string;
  type: EntityType;
}

/**
 * Returns an ordered slice of tokens inclusive of startTokenId and endTokenId.
 * Handles selection in either direction (start before end or end before start).
 */
export function getTokensInRange(
  tokens: Token[],
  startTokenId: string,
  endTokenId: string
): Token[] {
  const startIndex = tokens.findIndex((t) => t.id === startTokenId);
  const endIndex = tokens.findIndex((t) => t.id === endTokenId);

  if (startIndex === -1 || endIndex === -1) {
    return [];
  }

  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);

  return tokens.slice(from, to + 1);
}

/**
 * Reconstructs the exact plain text spanned by a token range.
 */
export function getTextFromRange(
  tokens: Token[],
  startTokenId: string,
  endTokenId: string
): string {
  const range = getTokensInRange(tokens, startTokenId, endTokenId);
  return range.map((t) => t.text).join("");
}

/**
 * Creates an entity draft from a token range and player-selected entity type.
 * Throws if startTokenId or endTokenId are not found in the token array.
 */
export function createEntityDraft(
  tokens: Token[],
  startTokenId: string,
  endTokenId: string,
  type: EntityType
): EntityDraft {
  const text = getTextFromRange(tokens, startTokenId, endTokenId);
  if (!text) {
    throw new Error(
      `Invalid token range: ${startTokenId} to ${endTokenId} not found in token set`
    );
  }

  return {
    startTokenId,
    endTokenId,
    text: text.trim(),
    type,
  };
}
