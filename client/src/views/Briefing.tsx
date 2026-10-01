import React, { useState } from "react";
import { ShieldAlert, Play } from "lucide-react";
import { useSessionStore } from "../store/sessionStore.js";

interface BriefingProps {
  onStart: () => void;
}

export const Briefing: React.FC<BriefingProps> = ({ onStart }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startSession = useSessionStore((state) => state.startSession);

  const handleBeginHeist = async () => {
    setLoading(true);
    setError(null);
    try {
      await startSession();
      onStart();
    } catch {
      setError("FAILED TO COMMENCE OPERATION. TRY AGAIN.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      {/* Central classified red file / case dossier per UX §5 */}
      <div className="w-full max-w-xl bg-panel border-2 border-red p-8 shadow-2xl relative">
        {/* Classification watermark / stamp */}
        <div className="absolute top-4 right-4 text-xs font-mono border-2 border-red-text text-red-text px-2 py-0.5 tracking-widest uppercase font-bold rotate-2">
          TOP SECRET // EYES ONLY
        </div>

        {/* Header */}
        <div className="mb-6 border-b border-line pb-4">
          <p className="font-mono text-xs text-muted tracking-widest uppercase mb-1">
            CODEVERSE 2.0
          </p>
          <h2 className="font-mono text-sm text-paper tracking-wider uppercase">
            PHASE 1 // THE ROYAL MINT
          </h2>
        </div>

        {/* Main Title */}
        <div className="mb-6">
          <h1 className="font-display text-4xl text-paper tracking-widest mb-1">
            EL CÓDIGO ROJO
          </h1>
          <p className="font-mono text-xs text-red-text tracking-widest uppercase">
            THE PROFESSOR LEFT ONE KEY.
            <br />
            FIND IT BEFORE THE TIMER RUNS OUT.
          </p>
        </div>

        {/* Briefing Copy */}
        <div className="mb-8 p-4 bg-bg border border-line font-mono text-sm text-paper/90 leading-relaxed space-y-4">
          <p>The Royal Mint vault has been isolated.</p>
          <p>
            Five evidence files.
            <br />
            One hidden chain.
            <br />
            One final access code.
          </p>
          <p className="text-paper font-semibold">
            Read carefully.
            <br />
            Connect the clues.
            <br />
            Crack the code.
          </p>
        </div>

        {/* Mission Metadata */}
        <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-bg border border-line font-mono">
          <div>
            <p className="text-xs text-muted tracking-wider uppercase mb-1">
              DURATION
            </p>
            <p className="text-lg font-bold text-paper">15:00</p>
          </div>
          <div>
            <p className="text-xs text-muted tracking-wider uppercase mb-1">
              OBJECTIVE
            </p>
            <p className="text-lg font-bold text-amber">BREACH THE VAULT</p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 p-3 bg-red/10 border border-red/40 flex items-center gap-2 text-xs font-mono text-red-text"
          >
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleBeginHeist}
          disabled={loading}
          className="w-full bg-red hover:bg-red-bright disabled:opacity-50 text-[#F5F0E6] font-display text-xl py-4 tracking-widest uppercase transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-bright flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>{loading ? "TRANSMITTING..." : "BEGIN HEIST"}</span>
        </button>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="font-mono text-[11px] text-muted tracking-widest uppercase">
            EXTERNAL SEARCH IS NOT REQUIRED.
          </p>
        </div>
      </div>
    </div>
  );
};
