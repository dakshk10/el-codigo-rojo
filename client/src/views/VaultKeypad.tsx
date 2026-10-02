import React, { useState, useEffect, useCallback, useId } from "react";
import { useSessionStore } from "../store/sessionStore.js";
import { api, ApiError } from "../api/client.js";
import { BottomNav } from "../components/common/BottomNav.js";

export const VaultKeypad: React.FC = () => {
  const { session, fetchSession } = useSessionStore();
  const [digits, setDigits] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "IDLE" | "DENIED" | "GRANTED";
    title?: string;
    subtitle?: string;
  }>({ type: "IDLE" });

  const attemptsRemaining = session?.attemptsRemaining ?? 3;
  const isLocked = attemptsRemaining <= 0 || isSubmitting;
  const uniquePrefix = useId();

  // Handle digit input
  const handleAddDigit = useCallback(
    (digit: string) => {
      if (isLocked || digits.length >= 6) return;
      setDigits((prev) => prev + digit);
      setFeedback({ type: "IDLE" });
    },
    [isLocked, digits.length]
  );

  const handleBackspace = useCallback(() => {
    if (isLocked) return;
    setDigits((prev) => prev.slice(0, -1));
    setFeedback({ type: "IDLE" });
  }, [isLocked]);

  const handleClear = useCallback(() => {
    if (isLocked) return;
    setDigits("");
    setFeedback({ type: "IDLE" });
  }, [isLocked]);

  // Submit code
  const handleSubmit = useCallback(async () => {
    if (isLocked || digits.length !== 6) return;

    setIsSubmitting(true);
    setFeedback({ type: "IDLE" });

    // Generate idempotency key for this attempt
    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const res = await api.submitCode(digits, idempotencyKey);

      if (res.result === "GRANTED") {
        setFeedback({
          type: "GRANTED",
          title: "ACCESS GRANTED",
          subtitle: "VAULT BREACHED",
        });

        // Refresh session to transition to SOLVED
        fetchSession();
      } else {
        // Denied
        setIsShaking(true);
        setFeedback({
          type: "DENIED",
          title: "ACCESS DENIED",
          subtitle: "SEQUENCE REJECTED",
        });
        setDigits("");

        // Timeout shake animation
        setTimeout(() => setIsShaking(false), 500);

        fetchSession();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        // Expired or session inactive
        fetchSession();
      } else {
        setFeedback({
          type: "DENIED",
          title: "TRANSMISSION ERROR",
          subtitle: "VERIFY SYSTEM CONNECTION",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [digits, isLocked, fetchSession]);

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in another input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleAddDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClear();
      } else if (e.key === "Enter") {
        e.preventDefault();
        void handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleAddDigit, handleBackspace, handleClear, handleSubmit]);

  // Render 6-digit display
  const displayChars = Array.from({ length: 6 }, (_, i) => digits[i] || "_");

  return (
    <div className="flex-1 flex flex-col justify-between min-h-[calc(100vh-80px)] bg-bg font-mono text-paper select-none">
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          className={`max-w-md w-full bg-panel border border-line p-6 sm:p-8 rounded shadow-2xl space-y-6 transition-transform motion-reduce:animate-none motion-reduce:transition-none ${
            isShaking ? "animate-shake" : ""
          }`}
        >
          {/* Keypad Header */}
          <div className="text-center space-y-1">
            <h2 className="font-display text-2xl tracking-widest text-paper">
              VAULT ACCESS TERMINAL
            </h2>
            <div className="text-xs text-muted uppercase tracking-wider">
              SECURITY KEYPAD // 6-DIGIT CODE
            </div>
          </div>

          {/* Attempts Remaining Display */}
          <div className="border border-line/80 bg-bg p-2 text-center rounded-xs">
            <span className="text-xs tracking-wider text-muted uppercase">
              ATTEMPTS REMAINING:{" "}
            </span>
            <span
              className={`font-bold text-sm ${
                attemptsRemaining <= 1 ? "text-red-text" : "text-amber"
              }`}
            >
              {attemptsRemaining}
            </span>
          </div>

          {/* 6-Digit Display */}
          <div className="bg-bg border border-line/90 p-4 rounded-xs text-center">
            <div data-testid="keypad-display" className="font-display text-4xl sm:text-5xl tracking-[0.4em] text-paper flex items-center justify-center">
              {displayChars.map((char, index) => (
                <span
                  key={`${uniquePrefix}-digit-${index}`}
                  className={char === "_" ? "text-muted/40" : "text-red-text"}
                >
                  {char}
                </span>
              ))}
            </div>
          </div>

          {/* Feedback Messages */}
          <div className="h-10 flex flex-col items-center justify-center text-center">
            {feedback.type === "DENIED" && (
              <div className="text-red-text font-bold tracking-widest text-xs animate-fade-in">
                <div>{feedback.title}</div>
                <div className="text-[10px] text-red-text/80">{feedback.subtitle}</div>
              </div>
            )}
            {feedback.type === "GRANTED" && (
              <div className="text-green font-bold tracking-widest text-xs animate-fade-in">
                <div>{feedback.title}</div>
                <div className="text-[10px] text-green/80">{feedback.subtitle}</div>
              </div>
            )}
          </div>

          {/* Keypad Grid (3x4) */}
          <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                disabled={isLocked || digits.length >= 6}
                onClick={() => handleAddDigit(num)}
                className="h-14 bg-bg hover:bg-line border border-line/80 text-xl font-display text-paper rounded-xs disabled:opacity-40 transition-colors flex items-center justify-center active:scale-95"
              >
                {num}
              </button>
            ))}

            {/* Bottom row: CLEAR, 0, BACKSPACE */}
            <button
              type="button"
              disabled={isLocked || digits.length === 0}
              onClick={handleClear}
              className="h-14 bg-bg hover:bg-line border border-line/80 text-[11px] font-bold text-muted hover:text-paper rounded-xs disabled:opacity-40 uppercase transition-colors flex items-center justify-center"
            >
              CLEAR
            </button>

            <button
              type="button"
              disabled={isLocked || digits.length >= 6}
              onClick={() => handleAddDigit("0")}
              className="h-14 bg-bg hover:bg-line border border-line/80 text-xl font-display text-paper rounded-xs disabled:opacity-40 transition-colors flex items-center justify-center active:scale-95"
            >
              0
            </button>

            <button
              type="button"
              disabled={isLocked || digits.length === 0}
              onClick={handleBackspace}
              className="h-14 bg-bg hover:bg-line border border-line/80 text-[11px] font-bold text-muted hover:text-paper rounded-xs disabled:opacity-40 uppercase transition-colors flex items-center justify-center"
            >
              BACKSPACE
            </button>
          </div>

          {/* Enter Code Button */}
          <button
            type="button"
            disabled={isLocked || digits.length !== 6}
            onClick={handleSubmit}
            className="w-full py-3 bg-red hover:bg-red-bright text-paper font-bold uppercase tracking-widest rounded-xs disabled:opacity-40 transition-colors shadow-lg text-sm"
          >
            {isSubmitting ? "TRANSMITTING TO VAULT..." : "ENTER CODE"}
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        currentView="vault"
        onNavigate={(view) => {
          window.location.hash = `#${view}`;
        }}
      />
    </div>
  );
};
