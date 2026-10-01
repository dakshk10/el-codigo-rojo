export type TokenKind = "word" | "number" | "punctuation" | "whitespace";

export interface Token {
  id: string;
  text: string;
  start: number;
  end: number;
  line: number;
  kind: TokenKind;
}

const TOKEN_RE = /(\d+)|([A-Za-z\u00C0-\u024F'-]+)|(\s+)|([^\w\s])/g;

/**
 * Tokenise a plain-text body into stable Token objects.
 * Token ids are positional (t0, t1, …) and stable across runs for the same input.
 * Whitespace tokens are included so the original text is reconstructable.
 */
export function tokenise(body: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  let match: RegExpExecArray | null;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(body)) !== null) {
    const text = match[0];
    const start = match.index;
    const end = start + text.length;

    let kind: TokenKind;
    if (match[1] !== undefined) {
      kind = "number";
    } else if (match[2] !== undefined) {
      kind = "word";
    } else if (match[3] !== undefined) {
      kind = "whitespace";
    } else {
      kind = "punctuation";
    }

    tokens.push({ id: `t${index}`, text, start, end, line, kind });
    index++;

    // Track line numbers
    for (const ch of text) {
      if (ch === "\n") line++;
    }
  }

  return tokens;
}
