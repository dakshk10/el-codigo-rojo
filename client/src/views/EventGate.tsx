import React, { useState } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { api, ApiError } from "../api/client.js";
import { useSessionStore } from "../store/sessionStore.js";

interface EventGateProps {
  onSuccess: () => void;
}

export const EventGate: React.FC<EventGateProps> = ({ onSuccess }) => {
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setEventCodeVerified = useSessionStore(
    (state) => state.setEventCodeVerified
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) {
      setError("ACCESS DENIED");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.verifyEventCode(accessCode.trim());
      setEventCodeVerified(true);
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 429) {
        setError("TOO MANY ATTEMPTS. TRY AGAIN LATER.");
      } else {
        setError("ACCESS DENIED");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-panel border border-line p-8 shadow-2xl relative">
        {/* Classification corner stamp */}
        <div className="absolute top-4 right-4 text-[10px] font-mono border border-red-text text-red-text px-1.5 py-0.5 tracking-widest uppercase">
          RESTRICTED
        </div>

        {/* Header per UX §4 */}
        <div className="mb-8">
          <p className="font-mono text-xs text-muted tracking-widest uppercase mb-1">
            CODEVERSE 2.0
          </p>
          <h2 className="font-mono text-sm text-paper tracking-wider uppercase">
            PHASE 1 // THE ROYAL MINT
          </h2>
        </div>

        {/* Section title & instructions */}
        <div className="mb-6">
          <h1 className="font-display text-2xl text-paper tracking-wider mb-2 flex items-center gap-2">
            <Lock className="w-5 h-5 text-red-bright" />
            RESTRICTED ACCESS
          </h1>
          <p className="font-mono text-xs text-muted uppercase tracking-wider leading-relaxed">
            ENTER THE OPERATION CODE GIVEN AT THE VENUE
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="access-code" className="sr-only">
              ACCESS CODE
            </label>
            <input
              id="access-code"
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="ACCESS CODE"
              autoComplete="off"
              disabled={loading}
              className="w-full bg-bg border border-line px-4 py-3 font-mono text-sm text-paper placeholder-muted focus:outline-none focus:border-red-bright focus:ring-1 focus:ring-red-bright uppercase tracking-widest"
            />
            {error && (
              <div
                role="alert"
                className="mt-2 flex items-center gap-1.5 text-xs font-mono text-red-text"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red hover:bg-red-bright disabled:opacity-50 text-[#F5F0E6] font-display text-lg py-3 tracking-widest uppercase transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-bright"
          >
            {loading ? "VERIFYING..." : "CONTINUE"}
          </button>
        </form>
      </div>
    </div>
  );
};
