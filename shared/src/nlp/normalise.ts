/**
 * Text normalisation utilities for deterministic NLP search and matching.
 * Lowercases text, cleans punctuation, and normalises whitespace.
 */

/**
 * Normalise a string by converting to lowercase, replacing punctuation with spaces,
 * and collapsing whitespace.
 */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalise a word token for index lookup.
 * Strips leading/trailing non-alphanumeric characters and lowercases.
 */
export function normaliseWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/^[^\w]+|[^\w]+$/g, "")
    .trim();
}

/**
 * Splits a token's text into constituent alphanumeric terms.
 * Handles hyphenated words (e.g. "red-wax" -> ["red", "wax"]).
 */
export function splitTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\w]+/)
    .filter((w) => w.length > 0);
}
