import React, { useState } from "react";
import type { EntityType } from "shared";
import type { BoardNode, BoardEdge, PinnedEntity } from "../../store/workspaceStore.js";

const RELATION_TYPES = [
  "SEEN AT",
  "SCHEDULED ON",
  "MENTIONED BY",
  "CONNECTED TO",
] as const;

interface BoardSidebarProps {
  nodes: BoardNode[];
  edges: BoardEdge[];
  pinnedEntities: PinnedEntity[];
  onAddLink: (
    source: string,
    target: string,
    label: "SEEN AT" | "SCHEDULED ON" | "MENTIONED BY" | "CONNECTED TO"
  ) => void;
  onRemoveLink: (edgeId: string) => void;
  onAddCard: (label: string, entityType: EntityType) => void;
}

export const BoardSidebar: React.FC<BoardSidebarProps> = ({
  nodes,
  edges,
  pinnedEntities,
  onAddLink,
  onRemoveLink,
  onAddCard,
}) => {
  const [sourceId, setSourceId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  const [relation, setRelation] = useState<
    "SEEN AT" | "SCHEDULED ON" | "MENTIONED BY" | "CONNECTED TO"
  >("CONNECTED TO");

  const [newCardText, setNewCardText] = useState<string>("");
  const [newCardType, setNewCardType] = useState<EntityType>("person");

  const handleCreateLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !targetId || sourceId === targetId) return;
    onAddLink(sourceId, targetId, relation);
    setSourceId("");
    setTargetId("");
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardText.trim()) return;
    onAddCard(newCardText.trim(), newCardType);
    setNewCardText("");
  };

  const nodeMap = new Map(nodes.map((n) => [n.id, n.data.label]));

  return (
    <aside className="w-80 h-full border-l border-line bg-panel/90 flex flex-col font-mono text-xs overflow-y-auto p-4 space-y-5">
      {/* Links Counter */}
      <div className="border border-line/80 bg-bg p-3 rounded">
        <div className="text-muted text-[10px] tracking-widest uppercase">
          LINKS MADE
        </div>
        <div className="font-display text-2xl text-paper mt-0.5">
          {edges.length}
        </div>
      </div>

      {/* Non-Pointer Add Link Form */}
      <div className="border border-line/80 bg-bg/50 p-3 rounded space-y-3">
        <h3 className="font-bold tracking-wider text-paper uppercase text-[11px]">
          ADD LINK (KEYBOARD / NON-POINTER)
        </h3>
        <form onSubmit={handleCreateLink} className="space-y-2">
          <div>
            <label htmlFor="select-source" className="text-muted block text-[10px] uppercase mb-1">
              Source Card
            </label>
            <select
              id="select-source"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full bg-panel border border-line p-1.5 text-xs text-paper rounded-xs"
            >
              <option value="">-- Choose source --</option>
              {nodes.map((n) => (
                <option key={`src-${n.id}`} value={n.id}>
                  {n.data.label} ({n.data.entityType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="select-relation" className="text-muted block text-[10px] uppercase mb-1">
              Relationship Label
            </label>
            <select
              id="select-relation"
              value={relation}
              onChange={(e) =>
                setRelation(
                  e.target.value as "SEEN AT" | "SCHEDULED ON" | "MENTIONED BY" | "CONNECTED TO"
                )
              }
              className="w-full bg-panel border border-line p-1.5 text-xs text-paper rounded-xs"
            >
              {RELATION_TYPES.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="select-target" className="text-muted block text-[10px] uppercase mb-1">
              Target Card
            </label>
            <select
              id="select-target"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-panel border border-line p-1.5 text-xs text-paper rounded-xs"
            >
              <option value="">-- Choose target --</option>
              {nodes.map((n) => (
                <option key={`tgt-${n.id}`} value={n.id}>
                  {n.data.label} ({n.data.entityType})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={!sourceId || !targetId || sourceId === targetId}
            className="w-full mt-2 py-1.5 bg-paper text-ink font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-paper/90 rounded-xs transition-colors"
          >
            CONFIRM LINK
          </button>
        </form>
      </div>

      {/* Link List mirroring canvas */}
      <div className="space-y-2">
        <h3 className="font-bold tracking-wider text-muted uppercase text-[11px]">
          LINK LIST ({edges.length})
        </h3>
        {edges.length === 0 ? (
          <div className="text-muted/60 text-[11px] italic py-1">
            No connections drawn yet.
          </div>
        ) : (
          <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {edges.map((e) => {
              const srcLabel = nodeMap.get(e.source) ?? e.source;
              const tgtLabel = nodeMap.get(e.target) ?? e.target;
              return (
                <li
                  key={e.id}
                  className="bg-bg p-2 border border-line/60 rounded flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <span className="text-paper font-semibold">{srcLabel}</span>{" "}
                    <span className="text-red-text font-bold">[{e.label}]</span>{" "}
                    <span className="text-paper font-semibold">{tgtLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveLink(e.id)}
                    className="text-muted hover:text-red-text text-[11px] px-1"
                    title="Remove connection"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add Custom Card */}
      <div className="border border-line/80 bg-bg/50 p-3 rounded space-y-2">
        <h3 className="font-bold tracking-wider text-paper uppercase text-[11px]">
          ADD EVIDENCE CARD
        </h3>
        <form onSubmit={handleCreateCard} className="space-y-2">
          <input
            type="text"
            placeholder="Entity name / clue..."
            value={newCardText}
            onChange={(e) => setNewCardText(e.target.value)}
            className="w-full bg-panel border border-line p-1.5 text-xs text-paper rounded-xs"
          />
          <select
            value={newCardType}
            onChange={(e) => setNewCardType(e.target.value as EntityType)}
            className="w-full bg-panel border border-line p-1.5 text-xs text-paper rounded-xs"
          >
            <option value="person">PERSON</option>
            <option value="alias">ALIAS</option>
            <option value="location">LOCATION</option>
            <option value="date">DATE</option>
            <option value="number">NUMBER</option>
            <option value="event">EVENT</option>
          </select>
          <button
            type="submit"
            disabled={!newCardText.trim()}
            className="w-full py-1.5 bg-paper text-ink font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-paper/90 rounded-xs transition-colors"
          >
            ADD CARD
          </button>
        </form>
      </div>

      {/* Pinned Clues helper: Click to add to board */}
      {pinnedEntities.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold tracking-wider text-muted uppercase text-[11px]">
            PINNED DOSSIER CLUES
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {pinnedEntities.map((pin) => (
              <button
                key={pin.id}
                type="button"
                onClick={() => onAddCard(pin.text, pin.type)}
                className="px-2 py-1 bg-panel hover:bg-line border border-line/80 text-[10px] text-paper rounded-xs transition-colors"
                title="Click to drop card onto board"
              >
                + {pin.text} ({pin.type})
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
