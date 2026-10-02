import React, { useState } from "react";
import type { EntityType } from "shared";
import { useWorkspaceStore } from "../../store/workspaceStore.js";

export interface NotesAndPinsPanelProps {
  onJumpToMark?: (fileId: string, tokenId: string) => void;
}

export const NotesAndPinsPanel: React.FC<NotesAndPinsPanelProps> = ({
  onJumpToMark,
}) => {
  const {
    notes,
    setNotes,
    marks,
    removeMark,
    pinnedEntities,
    removePinnedEntity,
    isSaving,
    saveError,
    dismissSaveError,
  } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<"notes" | "clues">("notes");

  // Group entities by type
  const entityCountByType = marks.reduce<Record<string, number>>((acc, m) => {
    const t = m.entityType ?? "untyped";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <aside
      aria-label="Investigation Notes and Pinned Clues"
      className="w-full flex flex-col h-full bg-bg border-l border-line font-mono text-xs"
    >
      {/* Non-blocking workspace save error banner (P3-05) */}
      {saveError && (
        <div
          data-testid="workspace-error-banner"
          className="p-2.5 bg-red/20 border-b border-red-bright text-red-text text-[11px] flex items-start justify-between gap-2"
        >
          <span>⚠ {saveError}</span>
          <button
            type="button"
            onClick={dismissSaveError}
            className="text-paper hover:text-red-text px-1"
            title="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-line bg-panel">
        <button
          type="button"
          id="tab-notes"
          onClick={() => setActiveTab("notes")}
          className={`flex-1 py-2.5 px-3 text-center uppercase tracking-wider font-bold transition-colors ${
            activeTab === "notes"
              ? "text-paper border-b-2 border-red-bright bg-bg"
              : "text-muted hover:text-paper"
          }`}
        >
          TEAM NOTES
        </button>
        <button
          type="button"
          id="tab-clues"
          onClick={() => setActiveTab("clues")}
          className={`flex-1 py-2.5 px-3 text-center uppercase tracking-wider font-bold transition-colors ${
            activeTab === "clues"
              ? "text-paper border-b-2 border-red-bright bg-bg"
              : "text-muted hover:text-paper"
          }`}
        >
          PINNED CLUES ({marks.length + pinnedEntities.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col">
        {activeTab === "notes" && (
          <div className="flex-1 flex flex-col space-y-2">
            <div className="flex items-center justify-between text-[10px] text-muted">
              <span>SYNCED TO TEAM WORKSPACE</span>
              <span className="font-semibold text-amber">
                {isSaving ? "SAVING..." : "SAVED"}
              </span>
            </div>

            <textarea
              id="textarea-team-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record cross-reference reasoning, suspect aliases, roster changes, numbers, and theories here..."
              className="w-full flex-1 min-h-[220px] p-3 bg-panel border border-line focus:border-red-bright focus:outline-none text-paper placeholder-muted leading-relaxed font-mono text-xs resize-none rounded-sm"
              aria-label="Team Investigation Notes"
            />
            <div className="text-[10px] text-muted flex justify-between">
              <span>Auto-saved continuously</span>
              <span>{notes.length} characters</span>
            </div>
          </div>
        )}

        {activeTab === "clues" && (
          <div className="space-y-4">
            {/* Entity Summary Badges */}
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-line/60">
              {(
                ["person", "alias", "location", "date", "number", "event"] as EntityType[]
              ).map((type) => (
                <span
                  key={type}
                  className="text-[10px] uppercase font-mono px-1.5 py-0.5 border border-line bg-panel text-muted"
                >
                  {type}: {entityCountByType[type] ?? 0}
                </span>
              ))}
            </div>

            {/* List of Marked Clues */}
            <div className="space-y-2">
              <h3 className="text-muted font-bold text-[11px] uppercase tracking-wider">
                EXTRACTED EVIDENCE MARKS ({marks.length})
              </h3>

              {marks.length === 0 ? (
                <p className="text-muted text-[11px] italic py-2">
                  No text marked yet. Select any text in a dossier and click MARK to pin it.
                </p>
              ) : (
                <div className="space-y-2">
                  {marks.map((mark) => (
                    <div
                      key={mark.id}
                      className="p-2 border border-line bg-panel hover:border-muted transition-colors rounded-xs flex items-start justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-bold text-amber">
                            FILE {mark.fileId}
                          </span>
                          {mark.entityType && (
                            <span className="text-[9px] uppercase px-1 py-0.2 bg-red/20 text-red-text border border-red/40 rounded-xs">
                              {mark.entityType}
                            </span>
                          )}
                        </div>
                        <div
                          className="text-paper text-xs cursor-pointer hover:underline truncate"
                          onClick={() =>
                            onJumpToMark?.(mark.fileId, mark.startTokenId)
                          }
                          title="Click to jump to document passage"
                        >
                          &ldquo;{mark.text}&rdquo;
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeMark(mark.id)}
                        className="text-muted hover:text-red-text text-xs p-1"
                        title="Remove mark"
                        aria-label="Remove mark"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* List of Pinned Entities */}
            {pinnedEntities.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-line/60">
                <h3 className="text-muted font-bold text-[11px] uppercase tracking-wider">
                  PINNED ENTITIES ({pinnedEntities.length})
                </h3>
                <div className="space-y-1.5">
                  {pinnedEntities.map((pin) => (
                    <div
                      key={pin.id}
                      className="p-1.5 border border-line bg-panel flex items-center justify-between text-xs"
                    >
                      <span className="text-paper font-semibold truncate">
                        {pin.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePinnedEntity(pin.id)}
                        className="text-muted hover:text-red-text text-xs ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
