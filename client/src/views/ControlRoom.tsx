import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { Token } from "shared";
import { useSessionStore } from "../store/sessionStore.js";
import { useWorkspaceStore } from "../store/workspaceStore.js";
import { api } from "../api/client.js";
import { EvidenceRail } from "../components/evidence/EvidenceRail.js";
import { MetadataDrawer } from "../components/evidence/MetadataDrawer.js";
import { EvidenceSearch } from "../components/evidence/EvidenceSearch.js";
import { TokenizedDocument } from "../components/evidence/TokenizedDocument.js";
import { NotesAndPinsPanel } from "../components/workspace/NotesAndPinsPanel.js";
import { HintDrawer } from "../components/hints/HintDrawer.js";

interface LoadedDoc {
  id: string;
  title: string;
  tokens: Token[];
  metadata: Record<string, string>;
}

export const ControlRoom: React.FC = () => {
  const { session, fetchSession } = useSessionStore();
  const {
    notes,
    reviewed,
    toggleReviewed,
    marks,
    addMark,
    removeMark,
    addPinnedEntity,
    setNotes,
    initFromSession,
  } = useWorkspaceStore();

  const [selectedFileId, setSelectedFileId] = useState<string>("01");
  const [loadedDocs, setLoadedDocs] = useState<Record<string, LoadedDoc>>({});
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [jumpTokenId, setJumpTokenId] = useState<string | null>(null);
  const [isHintDrawerOpen, setIsHintDrawerOpen] = useState(false);

  // Initialize workspace from session snapshot once on load / refresh
  useEffect(() => {
    if (session?.workspace && Object.keys(session.workspace).length > 0) {
      initFromSession(session.workspace);
    }
  }, [session?.workspace, initFromSession]);

  // Load document tokens for a given file
  const loadDocument = useCallback(
    async (fileId: string) => {
      if (loadedDocs[fileId]) return;

      setIsLoadingDoc(true);
      try {
        const res = await api.fetchEvidence(fileId);
        const evMeta = session?.evidence.find((e) => e.id === fileId);
        const title = evMeta?.title ?? `FILE ${fileId}`;

        setLoadedDocs((prev) => ({
          ...prev,
          [fileId]: {
            id: fileId,
            title,
            tokens: res.tokens,
            metadata: res.metadata,
          },
        }));

        // Refresh session snapshot to reflect that server marked this file as opened
        void fetchSession();
      } catch {
        // Document locked or network error
      } finally {
        setIsLoadingDoc(false);
      }
    },
    [fetchSession, loadedDocs, session?.evidence]
  );

  // Load initial document 01 on mount
  useEffect(() => {
    void loadDocument("01");
  }, [loadDocument]);

  const handleSelectFile = (fileId: string) => {
    setSelectedFileId(fileId);
    setJumpTokenId(null);
    void loadDocument(fileId);
  };

  const handleJumpToPassage = (fileId: string, tokenId: string) => {
    setSelectedFileId(fileId);
    setJumpTokenId(tokenId);
    void loadDocument(fileId);
  };

  const activeDoc = loadedDocs[selectedFileId];
  const activeEvidenceMeta = session?.evidence.find(
    (e) => e.id === selectedFileId
  );
  const fileMarks = marks.filter((m) => m.fileId === selectedFileId);

  const loadedDocsList = useMemo(() => Object.values(loadedDocs), [loadedDocs]);

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] max-h-[calc(100vh-57px)] overflow-hidden bg-bg text-paper font-sans">
      {/* Three Column Investigation Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Evidence Rail */}
        <div className="w-64 lg:w-72 shrink-0 h-full border-r border-line flex flex-col">
          <EvidenceRail
            evidenceList={session?.evidence ?? []}
            selectedId={selectedFileId}
            reviewedIds={reviewed}
            onSelect={handleSelectFile}
            onToggleReviewed={toggleReviewed}
          />
        </div>

        {/* Center Column: Main Workspace */}
        <main
          aria-label="Main Investigation Workspace"
          className="flex-1 h-full overflow-y-auto p-4 lg:p-6 flex flex-col bg-bg"
        >
          {/* Mission Directive Banner */}
          <div className="mb-4 p-3 border border-line bg-panel flex items-center justify-between gap-4 rounded-sm">
            <div>
              <p className="font-mono text-[10px] uppercase text-muted tracking-widest">
                MISSION DIRECTIVE // ACTIVE OPERATION
              </p>
              <p className="font-mono text-xs text-paper font-semibold">
                THE ROYAL MINT HAS BEEN SEALED. THE PROFESSOR LEFT A PATH. FOLLOW IT.
              </p>
            </div>
            <div className="shrink-0 font-mono text-[10px] text-amber border border-amber/40 px-2 py-0.5 bg-amber/10">
              OPERATIONAL
            </div>
          </div>

          {/* Lexical Search UI */}
          <EvidenceSearch
            loadedDocs={loadedDocsList}
            onJumpToPassage={handleJumpToPassage}
          />

          {/* Active Evidence Viewer */}
          <section className="flex-1 border border-line bg-panel p-5 lg:p-6 rounded-sm shadow-xl flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-line gap-2">
              <div>
                <span className="font-mono text-xs text-red-text uppercase font-bold tracking-widest">
                  CLASSIFIED EVIDENCE // FILE {selectedFileId}
                </span>
                <h2 className="font-display text-2xl tracking-wider text-paper uppercase mt-0.5">
                  {activeEvidenceMeta?.title ?? "SELECT DOSSIER"}
                </h2>
              </div>

              {activeEvidenceMeta?.unlocked && (
                <button
                  type="button"
                  id="btn-reviewed-active"
                  onClick={() => toggleReviewed(selectedFileId)}
                  className={`self-start sm:self-auto text-xs font-mono px-3 py-1 border transition-colors ${
                    reviewed.includes(selectedFileId)
                      ? "border-green/40 text-green bg-green/10"
                      : "border-line text-muted hover:text-paper"
                  }`}
                >
                  {reviewed.includes(selectedFileId)
                    ? "✓ MARKED AS REVIEWED"
                    : "MARK AS REVIEWED"}
                </button>
              )}
            </div>

            {/* Metadata Drawer */}
            {activeDoc && <MetadataDrawer metadata={activeDoc.metadata} />}

            {/* Document Content */}
            <div className="flex-1 mt-2">
              {isLoadingDoc ? (
                <div className="py-12 text-center font-mono text-xs text-muted">
                  DECRYPTING DOSSIER CHANNELS...
                </div>
              ) : activeDoc ? (
                <div className="bg-bg/60 p-4 border border-line/60 rounded-xs font-mono text-xs leading-relaxed text-paper">
                  <TokenizedDocument
                    tokens={activeDoc.tokens}
                    marks={fileMarks}
                    jumpToTokenId={jumpTokenId}
                    onMark={(draft) => {
                      addMark({ ...draft, fileId: selectedFileId });
                      addPinnedEntity({
                        fileId: selectedFileId,
                        text: draft.text,
                        type: draft.entityType,
                      });
                    }}
                    onLink={(draft) => {
                      addPinnedEntity({
                        fileId: selectedFileId,
                        text: draft.text,
                        type: "event",
                      });
                    }}
                    onNote={(draft) => {
                      const newNotes = `${notes ? `${notes}\n\n` : ""}[FILE ${selectedFileId} NOTE]: "${draft.text}"`;
                      setNotes(newNotes);
                    }}
                    onRemoveMark={removeMark}
                  />
                </div>
              ) : (
                <div className="py-12 text-center font-mono text-xs text-muted">
                  Select an unlocked dossier from the left rail to view evidence.
                </div>
              )}
            </div>
          </section>
        </main>

        {/* Right Column: Pinned Clues & Team Notes */}
        <div className="w-72 lg:w-80 shrink-0 h-full border-l border-line flex flex-col">
          <NotesAndPinsPanel
            onJumpToMark={(fileId, tokenId) => handleJumpToPassage(fileId, tokenId)}
          />
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <footer className="border-t border-line bg-panel px-4 py-2 flex items-center justify-between shrink-0 font-mono text-xs z-20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-open-hints"
            onClick={() => setIsHintDrawerOpen(true)}
            className="px-3 py-1.5 bg-red hover:bg-red-bright text-paper font-bold tracking-wider uppercase rounded-xs transition-colors"
          >
            HINTS (
            {session?.hints.filter((h) => !h.used).length ?? 0} AVAILABLE)
          </button>
        </div>

        <div className="flex items-center gap-3 text-muted">
          <button
            type="button"
            disabled
            className="px-2.5 py-1 border border-line text-muted/50 cursor-not-allowed uppercase"
            title="Available in Phase 4"
          >
            EVIDENCE BOARD
          </button>
          <button
            type="button"
            disabled
            className="px-2.5 py-1 border border-line text-muted/50 cursor-not-allowed uppercase"
            title="Available in Phase 4"
          >
            CIPHER TERMINAL
          </button>
          <button
            type="button"
            disabled
            className="px-2.5 py-1 border border-line text-muted/50 cursor-not-allowed uppercase"
            title="Available in Phase 4"
          >
            VAULT
          </button>
        </div>
      </footer>

      {/* Hint Drawer */}
      <HintDrawer
        hints={session?.hints ?? []}
        isOpen={isHintDrawerOpen}
        onClose={() => setIsHintDrawerOpen(false)}
        onHintUsed={() => {
          void fetchSession();
        }}
      />
    </div>
  );
};
