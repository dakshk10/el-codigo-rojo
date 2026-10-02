import React, { useState, useEffect } from "react";
import { useSessionStore } from "../store/sessionStore.js";
import { useWorkspaceStore } from "../store/workspaceStore.js";
import { api, ApiError } from "../api/client.js";
import { Modal } from "../components/common/Modal.js";
import { BottomNav } from "../components/common/BottomNav.js";

export const CipherTerminal: React.FC = () => {
  const { session, fetchSession } = useSessionStore();
  const { cipherScratchpad, setCipherScratchpad } = useWorkspaceStore();

  const [cipherInstruction, setCipherInstruction] = useState<string | null>(null);
  const [val1, setVal1] = useState("");
  const [val2, setVal2] = useState("");
  const [val3, setVal3] = useState("");

  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<"VALID" | "NOT_VALID" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [hasConfirmedPenalty, setHasConfirmedPenalty] = useState(false);

  const checksRemaining = session?.checksRemaining ?? 3;
  const isExhausted = checksRemaining <= 0;

  // Load File 05 text if unlocked
  useEffect(() => {
    const file05 = session?.evidence.find((e) => e.id === "05");
    if (file05?.unlocked) {
      api
        .fetchEvidence("05")
        .then((res) => {
          const fullText = res.tokens.map((t) => t.text).join("");
          setCipherInstruction(fullText);
        })
        .catch(() => {
          setCipherInstruction("Failed to load cipher directive from evidence file 05.");
        });
    } else {
      setCipherInstruction(null);
    }
  }, [session?.evidence]);

  const handleExecuteCheck = async () => {
    setShowConfirmModal(false);
    setHasConfirmedPenalty(true);
    setIsChecking(true);
    setErrorMessage(null);
    setCheckResult(null);

    try {
      const res = await api.checkTransformation([val1.trim(), val2.trim(), val3.trim()]);
      setCheckResult(res.valid ? "VALID" : "NOT_VALID");
      fetchSession();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403 || err.code === "EXHAUSTED") {
          setErrorMessage("NO CHECKS REMAINING. LIMIT REACHED.");
        } else if (err.status === 429) {
          setErrorMessage("RATE LIMITED. PLEASE WAIT A MOMENT BEFORE RETRYING.");
        } else {
          setErrorMessage(err.message || "CHECK FAILED.");
        }
      } else {
        setErrorMessage("NETWORK ERROR OCCURRED.");
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleCheckClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (isExhausted || isChecking) return;
    if (!val1.trim() || !val2.trim() || !val3.trim()) {
      setErrorMessage("PLEASE ENTER ALL THREE TWO-DIGIT VALUES.");
      return;
    }

    if (!hasConfirmedPenalty) {
      setShowConfirmModal(true);
    } else {
      void handleExecuteCheck();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)] bg-bg p-4 lg:p-6 overflow-y-auto font-mono text-xs text-paper">
      {/* Terminal Container */}
      <div className="max-w-4xl w-full mx-auto bg-[#070707] border border-line p-6 rounded shadow-2xl space-y-6 relative overflow-hidden">
        {/* Terminal Header */}
        <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-red-text font-bold tracking-widest text-sm flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 bg-red-bright animate-pulse" />
              ROYAL MINT SECURITY TERMINAL
            </div>
            <div className="text-muted text-[11px] tracking-wider mt-0.5">
              CIPHER MODULE // RED KEY
            </div>
          </div>
          <div className="text-right">
            <span className="border border-line/80 px-2.5 py-1 bg-panel text-[11px] text-paper">
              CHECKS REMAINING: <span className="font-bold text-amber">{checksRemaining}</span>
            </span>
          </div>
        </div>

        {/* Content: File 05 Cipher Instruction */}
        <div className="border border-line/80 bg-panel/60 p-4 rounded space-y-2">
          <div className="text-muted text-[11px] tracking-wider uppercase font-bold flex items-center justify-between">
            <span>CIPHER INSTRUCTION // EVIDENCE 05</span>
            {!cipherInstruction && (
              <span className="text-red-text text-[10px]">LOCKED // REQUIRES DOSSIER FILE 05</span>
            )}
          </div>
          <div className="text-paper/90 whitespace-pre-wrap leading-relaxed text-xs">
            {cipherInstruction ||
              "[CIPHER DIRECTIVE ENCRYPTED. UNLOCK FILE 05 IN THE INVESTIGATION DOSSIER TO DISPLAY INSTRUCTIONS.]"}
          </div>
        </div>

        {/* Scratchpad */}
        <div className="space-y-2">
          <div className="text-muted text-[11px] tracking-wider uppercase font-bold flex items-center justify-between">
            <label htmlFor="terminal-scratchpad">
              INVESTIGATION SCRATCHPAD <span className="text-muted/60 font-normal">(PRIVATE WORKING // SAVES TO SESSION)</span>
            </label>
            <span className="text-[10px] text-muted">AUTOSAVED</span>
          </div>
          <textarea
            id="terminal-scratchpad"
            value={cipherScratchpad}
            onChange={(e) => setCipherScratchpad(e.target.value)}
            rows={4}
            placeholder="Record intermediate values, permutation hypotheses, working..."
            className="w-full bg-bg border border-line p-3 font-mono text-xs text-paper focus:border-red-text focus:outline-none rounded-xs resize-y"
          />
        </div>

        {/* Transformation Check Tool */}
        <div className="border border-line/90 bg-panel/80 p-5 rounded space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-paper uppercase tracking-wider text-xs">
              CHECK TRANSFORMATION
            </h3>
            <span
              className={`text-[11px] font-bold ${
                isExhausted ? "text-red-text" : "text-amber"
              }`}
            >
              {isExhausted ? "0 CHECKS REMAINING" : `${checksRemaining} CHECKS REMAINING`}
            </span>
          </div>

          <p className="text-muted text-[11px] leading-relaxed">
            Enter the three two-digit transformed values in any order. The security terminal evaluates
            the set as a whole without revealing individual correctness.
          </p>

          <form onSubmit={handleCheckClick} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="check-val-1" className="text-muted block text-[10px] mb-1">
                  VALUE 1 (2 DIGITS)
                </label>
                <input
                  id="check-val-1"
                  type="text"
                  maxLength={2}
                  value={val1}
                  disabled={isExhausted || isChecking}
                  onChange={(e) => setVal1(e.target.value.replace(/\D/g, ""))}
                  placeholder="00"
                  className="w-full bg-bg border border-line p-2 text-center text-sm font-bold text-paper focus:border-red-text focus:outline-none rounded-xs disabled:opacity-40"
                />
              </div>

              <div>
                <label htmlFor="check-val-2" className="text-muted block text-[10px] mb-1">
                  VALUE 2 (2 DIGITS)
                </label>
                <input
                  id="check-val-2"
                  type="text"
                  maxLength={2}
                  value={val2}
                  disabled={isExhausted || isChecking}
                  onChange={(e) => setVal2(e.target.value.replace(/\D/g, ""))}
                  placeholder="00"
                  className="w-full bg-bg border border-line p-2 text-center text-sm font-bold text-paper focus:border-red-text focus:outline-none rounded-xs disabled:opacity-40"
                />
              </div>

              <div>
                <label htmlFor="check-val-3" className="text-muted block text-[10px] mb-1">
                  VALUE 3 (2 DIGITS)
                </label>
                <input
                  id="check-val-3"
                  type="text"
                  maxLength={2}
                  value={val3}
                  disabled={isExhausted || isChecking}
                  onChange={(e) => setVal3(e.target.value.replace(/\D/g, ""))}
                  placeholder="00"
                  className="w-full bg-bg border border-line p-2 text-center text-sm font-bold text-paper focus:border-red-text focus:outline-none rounded-xs disabled:opacity-40"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isExhausted || isChecking || !val1 || !val2 || !val3}
              className="w-full py-2.5 bg-paper hover:bg-paper/90 text-ink font-bold uppercase tracking-widest rounded-xs disabled:opacity-40 transition-colors"
            >
              {isChecking ? "EVALUATING VALUES..." : "CHECK TRANSFORMATION"}
            </button>
          </form>

          {/* Feedback Display */}
          {checkResult && (
            <div
              className={`p-3 border rounded text-center font-bold tracking-widest text-sm ${
                checkResult === "VALID"
                  ? "border-green/80 bg-green/10 text-green"
                  : "border-red-bright/80 bg-red/10 text-red-text"
              }`}
            >
              {checkResult === "VALID"
                ? "TRANSFORMATION VALID"
                : "TRANSFORMATION NOT VALID"}
            </div>
          )}

          {errorMessage && (
            <div className="p-3 border border-red/60 bg-red/10 text-red-text text-center text-xs">
              {errorMessage}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal before first check use */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="CONFIRM TRANSFORMATION CHECK"
      >
        <div className="space-y-4 font-mono text-xs">
          <p className="text-paper leading-relaxed">
            EACH TRANSFORMATION CHECK ADDS 30 SECONDS TO YOUR EFFECTIVE SCORING TIME.
          </p>
          <p className="text-amber text-[11px]">
            THE COUNTDOWN CLOCK IS NOT AFFECTED, BUT YOUR FINAL PROJECTED SCORE WILL REFLECT THE PENALTY.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 border border-line text-paper uppercase hover:bg-line rounded-xs"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={handleExecuteCheck}
              className="px-4 py-2 bg-red hover:bg-red-bright text-paper font-bold uppercase rounded-xs"
            >
              CONFIRM CHECK
            </button>
          </div>
        </div>
      </Modal>

      {/* Bottom Navigation */}
      <BottomNav
        currentView="cipher"
        onNavigate={(view) => {
          window.location.hash = `#${view}`;
        }}
      />
    </div>
  );
};
