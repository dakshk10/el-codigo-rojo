import React from "react";
import type { EvidenceSnapshot } from "shared";

export interface ClassifiedFileCardProps {
  evidence: EvidenceSnapshot;
  isSelected: boolean;
  isReviewed: boolean;
  onSelect: (id: string) => void;
  onToggleReviewed: (id: string) => void;
}

export const ClassifiedFileCard: React.FC<ClassifiedFileCardProps> = ({
  evidence,
  isSelected,
  isReviewed,
  onSelect,
  onToggleReviewed,
}) => {
  const { id, ordinal, title, unlocked, opened } = evidence;

  // Exact locked copy from UX §6 & §22
  const getLockedCopy = () => {
    if (id === "04") {
      return "ENCRYPTED — REVIEW FILES 01–03 FIRST";
    }
    if (id === "05") {
      return "ENCRYPTED — REVIEW FILE 04 FIRST";
    }
    return "ENCRYPTED — ACCESS LOCKED";
  };

  if (!unlocked) {
    return (
      <div
        data-testid={`file-card-${id}-locked`}
        className="p-3 border border-line bg-panel/50 text-muted cursor-not-allowed opacity-75"
        aria-disabled="true"
      >
        <div className="flex items-center justify-between text-xs font-mono mb-1">
          <span className="font-bold text-muted">FILE {id}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted px-1.5 py-0.5 border border-line bg-bg">
            LOCKED
          </span>
        </div>
        <p className="font-mono text-xs text-red-text font-medium mt-1 leading-snug">
          {getLockedCopy()}
        </p>
      </div>
    );
  }

  // Determine state label: Completed / Opened / Unread
  let statusLabel = "UNREAD";
  let statusBadgeClass = "border-line text-muted bg-bg";

  if (isReviewed) {
    statusLabel = "COMPLETED";
    statusBadgeClass = "border-green/40 text-green bg-green/10";
  } else if (opened) {
    statusLabel = "OPENED";
    statusBadgeClass = "border-amber/40 text-amber bg-amber/10";
  }

  return (
    <div
      data-testid={`file-card-${id}`}
      className={`p-3 border transition-colors cursor-pointer ${
        isSelected
          ? "border-red-bright bg-panel shadow-md"
          : "border-line bg-panel hover:border-muted"
      }`}
      onClick={() => onSelect(id)}
    >
      <div className="flex items-center justify-between text-xs font-mono mb-1.5">
        <span className="font-bold text-paper tracking-wider">
          FILE {id}
        </span>
        <span
          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 border ${statusBadgeClass}`}
        >
          {statusLabel}
        </span>
      </div>

      <button
        type="button"
        id={`btn-file-${id}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(id);
        }}
        className="w-full text-left font-display text-sm tracking-wide text-paper hover:text-red-bright transition-colors uppercase block mb-2"
      >
        {ordinal < 10 ? `0${ordinal}` : ordinal} &nbsp;{title}
      </button>

      <div className="flex items-center justify-between pt-1 border-t border-line/60">
        <button
          type="button"
          id={`btn-reviewed-${id}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleReviewed(id);
          }}
          className={`text-[10px] font-mono tracking-wider px-2 py-0.5 border transition-colors ${
            isReviewed
              ? "border-green/40 text-green bg-green/10 hover:bg-green/20"
              : "border-line text-muted hover:text-paper hover:border-muted"
          }`}
          title="Toggle reviewed status"
        >
          {isReviewed ? "✓ REVIEWED" : "MARK AS REVIEWED"}
        </button>
      </div>
    </div>
  );
};
