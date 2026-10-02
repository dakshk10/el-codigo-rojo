import React, { useState, useEffect, useRef } from "react";
import type { HintSnapshot } from "shared";
import { api } from "../../api/client.js";

export interface HintDrawerProps {
  hints: HintSnapshot[];
  isOpen: boolean;
  onClose: () => void;
  onHintUsed?: (hintId: number, text: string) => void;
}

export const HintDrawer: React.FC<HintDrawerProps> = ({
  hints,
  isOpen,
  onClose,
  onHintUsed,
}) => {
  const [confirmingHint, setConfirmingHint] = useState<HintSnapshot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap for confirmation modal
  useEffect(() => {
    if (confirmingHint) {
      cancelBtnRef.current?.focus();
    }
  }, [confirmingHint]);

  if (!isOpen) return null;

  const handleUseHintClick = (hint: HintSnapshot) => {
    setConfirmingHint(hint);
    setError(null);
  };

  const handleCancel = () => {
    setConfirmingHint(null);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!confirmingHint) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.useHint(confirmingHint.id);
      onHintUsed?.(confirmingHint.id, res.text);
      setConfirmingHint(null);
    } catch {
      setError("Failed to decrypt hint. Check network and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <aside
      aria-label="Hint Dossier Drawer"
      className="fixed inset-y-0 right-0 w-full sm:w-96 bg-panel border-l border-line shadow-2xl z-50 flex flex-col font-sans"
    >
      {/* Header */}
      <div className="p-4 border-b border-line bg-bg flex items-center justify-between">
        <div>
          <span className="font-mono text-[10px] text-muted tracking-widest uppercase">
            ASSISTANCE CHANNELS
          </span>
          <h2 className="font-display text-xl tracking-wider text-paper">
            PROFESSOR&apos;S HINTS
          </h2>
        </div>
        <button
          type="button"
          id="btn-close-hints"
          onClick={onClose}
          className="px-2 py-1 text-muted hover:text-paper text-sm font-mono border border-line hover:border-muted rounded-xs"
          aria-label="Close hints drawer"
        >
          ✕
        </button>
      </div>

      {/* Body: Hint Cards */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <p className="font-mono text-xs text-muted leading-relaxed">
          The Professor will not give you the answer. Only the next step. Each decrypted hint applies an irreversible scoring penalty.
        </p>

        {hints.map((hint) => {
          const ordinal = hint.id < 10 ? `0${hint.id}` : `${hint.id}`;

          if (hint.used) {
            return (
              <div
                key={hint.id}
                data-testid={`hint-card-${hint.id}-used`}
                className="p-4 border border-green/50 bg-bg space-y-2 rounded-sm"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-paper font-bold tracking-wider">
                    HINT {ordinal}
                  </span>
                  <span className="text-[10px] text-green border border-green/40 px-1.5 py-0.5 bg-green/10 uppercase tracking-widest font-semibold">
                    USED
                  </span>
                </div>
                <div className="text-xs font-mono text-muted tracking-wide uppercase">
                  DECRYPTED
                </div>
                <p className="font-mono text-xs text-paper bg-panel p-3 border border-line whitespace-pre-wrap leading-relaxed">
                  {hint.text ?? "DECRYPTED CONTENT AVAILABLE"}
                </p>
              </div>
            );
          }

          return (
            <div
              key={hint.id}
              data-testid={`hint-card-${hint.id}`}
              className="p-4 border border-line bg-bg hover:border-muted transition-colors space-y-3 rounded-sm"
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-paper font-bold tracking-wider">
                  HINT {ordinal}
                </span>
                <span className="text-xs text-red-text font-bold">
                  Penalty: -{hint.penaltyPercent}%
                </span>
              </div>

              <h3 className="font-display text-base tracking-wide text-paper uppercase">
                {hint.title}
              </h3>

              <button
                type="button"
                id={`btn-use-hint-${hint.id}`}
                onClick={() => handleUseHintClick(hint)}
                className="w-full py-2 px-3 bg-panel border border-red/60 hover:bg-red hover:text-paper text-red-text font-mono text-xs font-bold tracking-wider uppercase rounded-xs transition-colors"
              >
                [ USE HINT ]
              </button>
            </div>
          );
        })}
      </div>

      {/* Exact UX §13 Confirmation Modal */}
      {confirmingHint && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hint-modal-title"
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
        >
          <div className="bg-panel border border-red-bright max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <h3
              id="hint-modal-title"
              className="font-display text-2xl tracking-widest text-paper"
            >
              USE THIS HINT?
            </h3>

            <p className="font-mono text-sm text-red-text font-semibold">
              YOUR SCORE WILL BE REDUCED BY {confirmingHint.penaltyPercent}%.
            </p>

            {error && (
              <p className="font-mono text-xs text-red-text bg-red/10 p-2 border border-red/30">
                {error}
              </p>
            )}

            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                ref={cancelBtnRef}
                type="button"
                id="btn-cancel-hint"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="px-4 py-2 bg-line hover:bg-bg border border-line text-paper font-mono text-xs tracking-wider uppercase font-bold transition-colors"
              >
                [ CANCEL ]
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                id="btn-confirm-hint"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red hover:bg-red-bright text-paper font-mono text-xs tracking-wider uppercase font-bold transition-colors"
              >
                {isSubmitting ? "DECRYPTING..." : "[ CONFIRM ]"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
