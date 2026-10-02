import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { EntityType } from "shared";

const TYPE_COLORS: Record<EntityType, string> = {
  person: "text-amber border-amber/40 bg-amber/10",
  alias: "text-red-text border-red-text/40 bg-red/10",
  location: "text-green border-green/40 bg-green/10",
  date: "text-paper border-paper/40 bg-paper/10",
  number: "text-amber border-amber/40 bg-amber/10",
  event: "text-muted border-muted/40 bg-muted/10",
};

export interface EvidenceCardData {
  label: string;
  entityType: EntityType;
  onDelete?: (id: string) => void;
}

export const EvidenceCardNode: React.FC<NodeProps> = ({ id, data }) => {
  const cardData = data as unknown as EvidenceCardData;
  const entityType = cardData.entityType || "event";
  const badgeClass = TYPE_COLORS[entityType] || TYPE_COLORS.event;

  return (
    <div className="bg-panel border border-line rounded p-3 min-w-[160px] max-w-[240px] shadow-lg font-mono text-xs select-none">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted !w-2.5 !h-2.5 !border-line"
      />

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span
          className={`px-1.5 py-0.5 border text-[10px] uppercase font-bold tracking-wider rounded-xs ${badgeClass}`}
        >
          {entityType}
        </span>
        {cardData.onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              cardData.onDelete?.(id);
            }}
            className="text-muted hover:text-red-text text-[11px] px-1"
            title="Remove card"
          >
            ×
          </button>
        )}
      </div>

      <div className="text-paper font-medium text-xs break-words leading-snug">
        {cardData.label}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted !w-2.5 !h-2.5 !border-line"
      />
    </div>
  );
};
