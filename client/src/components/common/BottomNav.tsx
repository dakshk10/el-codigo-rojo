import React, { useState } from "react";
import { useSessionStore } from "../../store/sessionStore.js";
import { HintDrawer } from "../hints/HintDrawer.js";

interface BottomNavProps {
  currentView: "control" | "board" | "cipher" | "vault";
  onNavigate: (view: "control" | "board" | "cipher" | "vault") => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onNavigate }) => {
  const { session } = useSessionStore();
  const [isHintDrawerOpen, setIsHintDrawerOpen] = useState(false);

  const availableHints = session?.hints.filter((h) => !h.used).length ?? 0;

  return (
    <>
      <footer className="border-t border-line bg-panel px-4 py-2 flex items-center justify-between shrink-0 font-mono text-xs z-20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-open-hints"
            onClick={() => setIsHintDrawerOpen(true)}
            className="px-3 py-1.5 bg-red hover:bg-red-bright text-paper font-bold tracking-wider uppercase rounded-xs transition-colors"
          >
            HINTS ({availableHints} AVAILABLE)
          </button>
        </div>

        <nav aria-label="Game navigation" className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            id="nav-dossier"
            onClick={() => onNavigate("control")}
            className={`px-2.5 py-1 border uppercase transition-colors rounded-xs ${
              currentView === "control"
                ? "border-red-text bg-red/10 text-red-text font-bold"
                : "border-line text-paper/80 hover:border-muted hover:text-paper"
            }`}
          >
            DOSSIER
          </button>

          <button
            type="button"
            id="nav-board"
            onClick={() => onNavigate("board")}
            className={`px-2.5 py-1 border uppercase transition-colors rounded-xs ${
              currentView === "board"
                ? "border-red-text bg-red/10 text-red-text font-bold"
                : "border-line text-paper/80 hover:border-muted hover:text-paper"
            }`}
          >
            EVIDENCE BOARD
          </button>

          <button
            type="button"
            id="nav-cipher"
            onClick={() => onNavigate("cipher")}
            className={`px-2.5 py-1 border uppercase transition-colors rounded-xs ${
              currentView === "cipher"
                ? "border-red-text bg-red/10 text-red-text font-bold"
                : "border-line text-paper/80 hover:border-muted hover:text-paper"
            }`}
          >
            CIPHER TERMINAL
          </button>

          <button
            type="button"
            id="nav-vault"
            onClick={() => onNavigate("vault")}
            className={`px-2.5 py-1 border uppercase transition-colors rounded-xs ${
              currentView === "vault"
                ? "border-red-text bg-red/10 text-red-text font-bold"
                : "border-line text-paper/80 hover:border-muted hover:text-paper"
            }`}
          >
            VAULT
          </button>
        </nav>
      </footer>

      {/* Hint Drawer */}
      <HintDrawer
        hints={session?.hints ?? []}
        isOpen={isHintDrawerOpen}
        onClose={() => setIsHintDrawerOpen(false)}
      />
    </>
  );
};
