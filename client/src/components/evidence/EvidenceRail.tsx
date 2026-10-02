import React from "react";
import type { EvidenceSnapshot } from "shared";
import { ClassifiedFileCard } from "./ClassifiedFileCard.js";

export interface EvidenceRailProps {
  evidenceList: EvidenceSnapshot[];
  selectedId: string | null;
  reviewedIds: string[];
  onSelect: (id: string) => void;
  onToggleReviewed: (id: string) => void;
}

export const EvidenceRail: React.FC<EvidenceRailProps> = ({
  evidenceList,
  selectedId,
  reviewedIds,
  onSelect,
  onToggleReviewed,
}) => {
  return (
    <aside
      aria-label="Evidence Rail"
      className="w-full flex flex-col h-full bg-bg border-r border-line"
    >
      <div className="p-3 border-b border-line bg-panel flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted font-bold">
          EVIDENCE DOSSIERS
        </h2>
        <span className="font-mono text-[10px] text-amber">
          {evidenceList.filter((e) => e.unlocked).length} / {evidenceList.length} UNLOCKED
        </span>
      </div>

      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
        {evidenceList.map((item) => (
          <ClassifiedFileCard
            key={item.id}
            evidence={item}
            isSelected={item.id === selectedId}
            isReviewed={reviewedIds.includes(item.id)}
            onSelect={onSelect}
            onToggleReviewed={onToggleReviewed}
          />
        ))}
      </div>
    </aside>
  );
};
