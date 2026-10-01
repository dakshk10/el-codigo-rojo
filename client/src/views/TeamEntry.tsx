import React, { useState } from "react";
import { AlertCircle, Shield } from "lucide-react";
import { api, ApiError } from "../api/client.js";
import { useSessionStore } from "../store/sessionStore.js";

interface TeamEntryProps {
  onSuccess: (status: string) => void;
}

export const TeamEntry: React.FC<TeamEntryProps> = ({ onSuccess }) => {
  const [teamName, setTeamName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    let valid = true;
    setNameError(null);
    setPasscodeError(null);
    setGeneralError(null);

    const trimmedName = teamName.trim();
    if (!/^[A-Za-z0-9 -]{3,24}$/.test(trimmedName)) {
      setNameError(
        "TEAM NAME MUST BE 3–24 CHARACTERS (LETTERS, DIGITS, SPACES, HYPHENS)"
      );
      valid = false;
    }

    if (!/^\d{4}$/.test(passcode)) {
      setPasscodeError("PASSCODE MUST BE EXACTLY 4 DIGITS");
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setGeneralError(null);

    try {
      await api.enterTeam(teamName.trim(), passcode);
      const snapshot = await api.fetchSession();
      useSessionStore.getState().setSession(snapshot);
      onSuccess(snapshot.status);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          // UX §4 requirement: neutral message
          setGeneralError(
            "THAT TEAM NAME IS TAKEN, OR THE PASSCODE IS INCORRECT."
          );
        } else if (err.status === 429) {
          setGeneralError("TOO MANY ATTEMPTS. TRY AGAIN LATER.");
        } else {
          setGeneralError(err.message.toUpperCase());
        }
      } else {
        setGeneralError(
          "THAT TEAM NAME IS TAKEN, OR THE PASSCODE IS INCORRECT."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-panel border border-line p-8 shadow-2xl relative">
        {/* Classification stamp */}
        <div className="absolute top-4 right-4 text-[10px] font-mono border border-line text-muted px-1.5 py-0.5 tracking-widest uppercase">
          SECURE TERMINAL
        </div>

        {/* Header per UX §4 */}
        <div className="mb-6">
          <p className="font-mono text-xs text-muted tracking-widest uppercase mb-1">
            CODEVERSE 2.0
          </p>
          <h2 className="font-mono text-sm text-paper tracking-wider uppercase">
            PHASE 1 // THE ROYAL MINT
          </h2>
        </div>

        {/* Helper copy per UX §4 */}
        <div className="mb-6 p-3 bg-bg/80 border border-line text-xs font-mono text-muted space-y-1">
          <p>RETURNING? ENTER THE SAME NAME AND PASSCODE TO RESUME.</p>
          <p>CHOOSE A PASSCODE YOUR WHOLE TEAM WILL REMEMBER.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="team-name"
              className="block font-mono text-xs text-paper mb-1.5 uppercase tracking-wider"
            >
              TEAM NAME
            </label>
            <input
              id="team-name"
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="E.G. RESISTANCE-01"
              autoComplete="off"
              disabled={loading}
              className="w-full bg-bg border border-line px-4 py-2.5 font-mono text-sm text-paper placeholder-muted focus:outline-none focus:border-red-bright focus:ring-1 focus:ring-red-bright tracking-wider uppercase"
            />
            {nameError && (
              <div
                role="alert"
                className="mt-1.5 flex items-center gap-1.5 text-xs font-mono text-red-text"
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{nameError}</span>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="team-passcode"
              className="block font-mono text-xs text-paper mb-1.5 uppercase tracking-wider"
            >
              TEAM PASSCODE
            </label>
            <input
              id="team-passcode"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              autoComplete="off"
              disabled={loading}
              className="w-full bg-bg border border-line px-4 py-2.5 font-mono text-sm text-paper placeholder-muted focus:outline-none focus:border-red-bright focus:ring-1 focus:ring-red-bright tracking-widest text-center"
            />
            {passcodeError && (
              <div
                role="alert"
                className="mt-1.5 flex items-center gap-1.5 text-xs font-mono text-red-text"
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{passcodeError}</span>
              </div>
            )}
          </div>

          {generalError && (
            <div
              role="alert"
              className="p-3 bg-red/10 border border-red/40 flex items-start gap-2 text-xs font-mono text-red-text"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red hover:bg-red-bright disabled:opacity-50 text-[#F5F0E6] font-display text-lg py-3 tracking-widest uppercase transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-bright flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            <span>{loading ? "INITIALIZING..." : "ENTER OPERATION"}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
