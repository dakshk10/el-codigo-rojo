import React, { useState, useMemo } from "react";
import type { Token, SearchMatch } from "shared";
import { TfIdfIndex } from "shared";

export interface EvidenceSearchProps {
  loadedDocs: { id: string; title: string; tokens: Token[] }[];
  onJumpToPassage: (fileId: string, tokenId: string) => void;
}

export const EvidenceSearch: React.FC<EvidenceSearchProps> = ({
  loadedDocs,
  onJumpToPassage,
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Build TF-IDF index dynamically from unlocked & loaded evidence
  const index = useMemo(() => {
    const idx = new TfIdfIndex();
    for (const doc of loadedDocs) {
      idx.addDocument({ id: doc.id, tokens: doc.tokens });
    }
    return idx;
  }, [loadedDocs]);

  const results: SearchMatch[] = useMemo(() => {
    if (!query.trim()) return [];
    return index.search(query.trim());
  }, [index, query]);

  const getDocTitle = (id: string) => {
    const doc = loadedDocs.find((d) => d.id === id);
    return doc ? `FILE ${doc.id} // ${doc.title}` : `FILE ${id}`;
  };

  return (
    <div className="border border-line bg-panel mb-4 p-3 rounded-sm font-mono text-xs">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-muted">
          <span className="font-bold text-paper">EVIDENCE SEARCH</span>
          <span className="text-[10px] text-muted">[TF-IDF RANKED]</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-[10px] text-muted hover:text-paper uppercase tracking-wider"
        >
          {isOpen ? "HIDE" : "SHOW"}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              id="input-evidence-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SEARCH EVIDENCE (e.g. Quill, anniversary, panel)..."
              className="w-full bg-bg border border-line px-3 py-1.5 text-paper placeholder-muted focus:border-red-bright focus:outline-none rounded-sm font-mono text-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1.5 text-muted hover:text-paper"
              >
                ✕
              </button>
            )}
          </div>

          {query.trim() && (
            <div data-testid="search-results" className="space-y-2 mt-2">
              <div className="text-[11px] text-muted flex items-center justify-between">
                <span>{results.length} MATCHING PASSAGES FOUND</span>
                <span>SORTED BY TF-IDF WEIGHT</span>
              </div>

              {results.length === 0 ? (
                <p className="text-muted text-[11px] italic py-2">
                  No lexical matches found across loaded dossiers.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {results.map((match) => (
                    <div
                      key={match.docId}
                      className="p-2 border border-line/60 bg-bg hover:border-muted transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-paper text-xs">
                            {getDocTitle(match.docId)}
                          </span>
                          <span className="text-[10px] text-amber border border-amber/30 px-1 rounded-xs">
                            SCORE: {match.score.toFixed(3)}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted truncate">
                          TERMS: {match.matchedTerms.join(", ")}
                        </div>
                      </div>

                      {match.matchedTokenIds.length > 0 && (
                        <button
                          type="button"
                          id={`btn-jump-${match.docId}`}
                          onClick={() =>
                            onJumpToPassage(match.docId, match.matchedTokenIds[0]!)
                          }
                          className="shrink-0 px-2 py-1 bg-panel border border-line hover:border-red hover:text-red-bright text-paper text-[10px] tracking-wider uppercase font-semibold rounded-xs transition-colors"
                        >
                          JUMP →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
