import type { Token } from "./tokenise.js";
import { splitTerms } from "./normalise.js";
import { isStopword } from "./stopwords.js";

export interface IndexableDocument {
  id: string;
  tokens: Token[];
}

export interface SearchMatch {
  docId: string;
  score: number;
  matchedTerms: string[];
  matchedTokenIds: string[];
}

interface DocStats {
  id: string;
  tokens: Token[];
  termCounts: Map<string, number>;
  termToTokenIds: Map<string, string[]>;
  totalTerms: number;
}

/**
 * Pure TF-IDF index for deterministic lexical document search.
 * Strictly lexical: performs NO alias expansion and NO synonym expansion.
 */
export class TfIdfIndex {
  private docs: DocStats[] = [];
  private docFrequencies: Map<string, number> = new Map();

  constructor(documents?: IndexableDocument[]) {
    if (documents) {
      for (const doc of documents) {
        this.addDocument(doc);
      }
    }
  }

  /**
   * Adds an evidence document's tokens to the index.
   */
  public addDocument(doc: IndexableDocument): void {
    const termCounts = new Map<string, number>();
    const termToTokenIds = new Map<string, string[]>();
    let totalTerms = 0;

    for (const token of doc.tokens) {
      if (token.kind !== "word" && token.kind !== "number") {
        continue;
      }

      const terms = splitTerms(token.text);
      for (const term of terms) {
        if (!term || isStopword(term)) {
          continue;
        }

        totalTerms++;
        termCounts.set(term, (termCounts.get(term) ?? 0) + 1);

        const existingIds = termToTokenIds.get(term) ?? [];
        if (!existingIds.includes(token.id)) {
          existingIds.push(token.id);
        }
        termToTokenIds.set(term, existingIds);
      }
    }

    // Update document frequencies for unique terms in this doc
    for (const term of termCounts.keys()) {
      this.docFrequencies.set(
        term,
        (this.docFrequencies.get(term) ?? 0) + 1
      );
    }

    this.docs.push({
      id: doc.id,
      tokens: doc.tokens,
      termCounts,
      termToTokenIds,
      totalTerms,
    });
  }

  /**
   * Performs ranked TF-IDF search for a query string.
   * Query terms are normalised and stopword-filtered.
   * Strictly lexical: no synonyms, no alias resolution.
   */
  public search(query: string, limit?: number): SearchMatch[] {
    const rawTerms = splitTerms(query);

    if (rawTerms.length === 0) {
      return [];
    }

    // Filter stopwords, but fall back to raw terms if all query terms were stopwords
    let queryTerms = rawTerms.filter((t) => !isStopword(t));
    if (queryTerms.length === 0) {
      queryTerms = rawTerms;
    }

    const n = this.docs.length;
    if (n === 0) {
      return [];
    }

    const results: SearchMatch[] = [];

    for (const doc of this.docs) {
      let docScore = 0;
      const matchedTerms: string[] = [];
      const matchedTokenIds: string[] = [];

      for (const term of queryTerms) {
        const count = doc.termCounts.get(term) ?? 0;
        if (count > 0) {
          // Term Frequency: relative to doc length
          const tf = count / Math.max(1, doc.totalTerms);
          // Inverse Document Frequency: smooth formula
          const df = this.docFrequencies.get(term) ?? 1;
          const idf = Math.log((n + 1) / (df + 1)) + 1;

          docScore += tf * idf;
          matchedTerms.push(term);

          const tokenIds = doc.termToTokenIds.get(term);
          if (tokenIds) {
            for (const tid of tokenIds) {
              if (!matchedTokenIds.includes(tid)) {
                matchedTokenIds.push(tid);
              }
            }
          }
        }
      }

      if (docScore > 0) {
        results.push({
          docId: doc.id,
          score: docScore,
          matchedTerms,
          matchedTokenIds,
        });
      }
    }

    // Rank descending by score
    results.sort((a, b) => b.score - a.score);

    return limit !== undefined ? results.slice(0, limit) : results;
  }
}
