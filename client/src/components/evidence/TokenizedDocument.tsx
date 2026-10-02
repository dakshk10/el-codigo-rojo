import React, { useState, useRef, useEffect, useCallback } from "react";
import type { Token, EntityType } from "shared";
import { getTokensInRange, getTextFromRange } from "shared";

export interface MarkData {
  id: string;
  startTokenId: string;
  endTokenId: string;
  text: string;
  entityType?: EntityType;
}

export interface TokenizedDocumentProps {
  tokens: Token[];
  marks?: MarkData[];
  onMark?: (draft: {
    startTokenId: string;
    endTokenId: string;
    text: string;
    entityType: EntityType;
  }) => void;
  onLink?: (draft: {
    startTokenId: string;
    endTokenId: string;
    text: string;
  }) => void;
  onNote?: (draft: {
    startTokenId: string;
    endTokenId: string;
    text: string;
  }) => void;
  onRemoveMark?: (markId: string) => void;
  jumpToTokenId?: string | null;
}

const ENTITY_TYPES: { type: EntityType; label: string }[] = [
  { type: "person", label: "PERSON" },
  { type: "alias", label: "ALIAS" },
  { type: "location", label: "LOCATION" },
  { type: "date", label: "DATE" },
  { type: "number", label: "NUMBER" },
  { type: "event", label: "EVENT" },
];

export const TokenizedDocument: React.FC<TokenizedDocumentProps> = ({
  tokens,
  marks = [],
  onMark,
  onLink,
  onNote,
  onRemoveMark,
  jumpToTokenId,
}) => {
  const [startIndex, setStartIndex] = useState<number | null>(null);
  const [endIndex, setEndIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [menuStep, setMenuStep] = useState<"actions" | "entity" | null>(null);
  const [cursorIndex, setCursorIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Jump to token if requested
  useEffect(() => {
    if (!jumpToTokenId) return;
    const targetIdx = tokens.findIndex((t) => t.id === jumpToTokenId);
    if (targetIdx !== -1) {
      setCursorIndex(targetIdx);
      const el = document.getElementById(`token-${jumpToTokenId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [jumpToTokenId, tokens]);

  const clearSelection = useCallback(() => {
    setStartIndex(null);
    setEndIndex(null);
    setMenuStep(null);
  }, []);

  const hasSelection = startIndex !== null && endIndex !== null;
  const rangeStart = hasSelection ? Math.min(startIndex, endIndex) : null;
  const rangeEnd = hasSelection ? Math.max(startIndex, endIndex) : null;

  const getSelectedText = () => {
    if (rangeStart === null || rangeEnd === null) return "";
    return getTextFromRange(
      tokens,
      tokens[rangeStart]!.id,
      tokens[rangeEnd]!.id
    ).trim();
  };

  const handleTokenMouseDown = (index: number) => {
    setStartIndex(index);
    setEndIndex(index);
    setCursorIndex(index);
    setIsDragging(true);
    setMenuStep(null);
  };

  const handleTokenMouseEnter = (index: number) => {
    if (isDragging && startIndex !== null) {
      setEndIndex(index);
      setCursorIndex(index);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      if (hasSelection) {
        setMenuStep("actions");
      }
    }
  };

  const handleTokenClick = (index: number, e: React.MouseEvent) => {
    if (e.shiftKey && startIndex !== null) {
      setEndIndex(index);
      setCursorIndex(index);
      setMenuStep("actions");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (tokens.length === 0) return;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIdx = Math.min(tokens.length - 1, cursorIndex + 1);
      setCursorIndex(nextIdx);
      if (e.shiftKey) {
        if (startIndex === null) setStartIndex(cursorIndex);
        setEndIndex(nextIdx);
        setMenuStep("actions");
      } else if (!hasSelection) {
        setStartIndex(null);
        setEndIndex(null);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIdx = Math.max(0, cursorIndex - 1);
      setCursorIndex(prevIdx);
      if (e.shiftKey) {
        if (startIndex === null) setStartIndex(cursorIndex);
        setEndIndex(prevIdx);
        setMenuStep("actions");
      } else if (!hasSelection) {
        setStartIndex(null);
        setEndIndex(null);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      if (hasSelection) {
        e.preventDefault();
        setMenuStep("actions");
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      clearSelection();
    }
  };

  const handleActionClick = (action: "MARK" | "LINK" | "NOTE") => {
    if (rangeStart === null || rangeEnd === null) return;
    const startToken = tokens[rangeStart]!;
    const endToken = tokens[rangeEnd]!;
    const text = getSelectedText();

    if (action === "MARK") {
      setMenuStep("entity");
    } else if (action === "LINK") {
      onLink?.({ startTokenId: startToken.id, endTokenId: endToken.id, text });
      clearSelection();
    } else if (action === "NOTE") {
      onNote?.({ startTokenId: startToken.id, endTokenId: endToken.id, text });
      clearSelection();
    }
  };

  const handleEntitySelect = (type: EntityType) => {
    if (rangeStart === null || rangeEnd === null) return;
    const startToken = tokens[rangeStart]!;
    const endToken = tokens[rangeEnd]!;
    const text = getSelectedText();

    onMark?.({
      startTokenId: startToken.id,
      endTokenId: endToken.id,
      text,
      entityType: type,
    });
    clearSelection();
  };

  // Find if a token is inside any mark
  const findMarkForToken = (token: Token) => {
    return marks.find((m) => {
      const range = getTokensInRange(tokens, m.startTokenId, m.endTokenId);
      return range.some((t) => t.id === token.id);
    });
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label="Tokenized Evidence Document"
      className="relative select-none outline-none focus:ring-1 focus:ring-line"
      onMouseUp={handleMouseUp}
      onKeyDown={handleKeyDown}
    >
      {/* Floating Action Menu */}
      {menuStep && hasSelection && (
        <div
          data-testid="token-selection-menu"
          className="sticky top-2 z-20 mx-auto w-fit mb-3 bg-panel border border-red/60 shadow-2xl p-2 rounded flex flex-wrap items-center gap-2 text-xs font-mono"
        >
          {menuStep === "actions" && (
            <>
              <span className="text-muted pr-2 border-r border-line">
                SELECTION [{getSelectedText().slice(0, 16)}...]
              </span>
              <button
                type="button"
                id="btn-action-mark"
                onClick={() => handleActionClick("MARK")}
                className="px-2.5 py-1 bg-red hover:bg-red-bright text-paper font-bold tracking-wider rounded-sm transition-colors"
              >
                MARK
              </button>
              <button
                type="button"
                id="btn-action-link"
                onClick={() => handleActionClick("LINK")}
                className="px-2.5 py-1 bg-line hover:bg-panel text-paper font-semibold tracking-wider rounded-sm transition-colors border border-line"
              >
                LINK
              </button>
              <button
                type="button"
                id="btn-action-note"
                onClick={() => handleActionClick("NOTE")}
                className="px-2.5 py-1 bg-line hover:bg-panel text-paper font-semibold tracking-wider rounded-sm transition-colors border border-line"
              >
                NOTE
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="px-1.5 py-1 text-muted hover:text-paper"
                title="Dismiss"
              >
                ✕
              </button>
            </>
          )}

          {menuStep === "entity" && (
            <>
              <span className="text-muted pr-2 border-r border-line">
                CHOOSE ENTITY TYPE:
              </span>
              {ENTITY_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  id={`btn-entity-${type}`}
                  onClick={() => handleEntitySelect(type)}
                  className="px-2 py-1 bg-bg hover:bg-red/20 text-paper border border-line hover:border-red font-mono text-xs rounded-sm transition-colors"
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMenuStep("actions")}
                className="px-1.5 py-1 text-muted hover:text-paper"
                title="Back"
              >
                ←
              </button>
            </>
          )}
        </div>
      )}

      {/* Render Document Tokens */}
      <div className="whitespace-pre-wrap leading-relaxed">
        {tokens.map((token, idx) => {
          const isSelected =
            rangeStart !== null &&
            rangeEnd !== null &&
            idx >= rangeStart &&
            idx <= rangeEnd;

          const isCursor = idx === cursorIndex;
          const mark = findMarkForToken(token);
          const isMarkStart = mark && mark.startTokenId === token.id;
          const isMarkEnd = mark && mark.endTokenId === token.id;

          let className = "inline transition-colors duration-75 cursor-text ";

          if (isSelected) {
            className += "bg-red/30 text-paper ";
          } else if (mark) {
            className += "border-b border-red-bright text-paper ";
          }

          if (isCursor) {
            className += "ring-1 ring-amber/50 ";
          }

          return (
            <React.Fragment key={token.id}>
              {isMarkStart && (
                <span className="text-red-text font-bold select-none">[</span>
              )}
              <span
                id={`token-${token.id}`}
                data-token-id={token.id}
                data-token-kind={token.kind}
                className={className}
                onMouseDown={() => handleTokenMouseDown(idx)}
                onMouseEnter={() => handleTokenMouseEnter(idx)}
                onClick={(e) => handleTokenClick(idx, e)}
              >
                {token.text}
              </span>
              {isMarkEnd && (
                <span className="text-red-text font-bold select-none inline-flex items-center gap-1">
                  ]
                  {mark.entityType && (
                    <span className="text-[10px] uppercase font-mono px-1 py-0.2 bg-red/20 text-red-text border border-red/40 rounded-xs select-none">
                      {mark.entityType}
                    </span>
                  )}
                  {onRemoveMark && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveMark(mark.id);
                      }}
                      className="text-[10px] text-muted hover:text-red-text px-0.5 select-none"
                      title="Remove mark"
                      aria-label="Remove mark"
                    >
                      ✕
                    </button>
                  )}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
