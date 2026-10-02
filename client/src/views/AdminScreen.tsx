import React, { useEffect, useState, useRef, useCallback } from "react";

interface LeaderboardRow {
  teamName: string;
  status: string;
  score: number | null;
  completionTimeSeconds: number | null;
  hintsUsed: number;
  wrongAttempts: number;
  checksUsed: number;
  timeRemainingSeconds: number | null;
}

function formatSeconds(s: number | null): string {
  if (s === null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    NOT_STARTED: "text-muted border-muted",
    ACTIVE: "text-amber border-amber",
    SOLVED: "text-green border-green",
    EXPIRED: "text-red-text border-red-text",
    LOCKED_OUT: "text-red-text border-red-text",
  };
  const cls = colours[status] ?? "text-muted border-muted";
  return (
    <span
      className={`font-mono text-[11px] border px-1.5 py-0.5 ${cls}`}
    >
      {status}
    </span>
  );
}

export const AdminScreen: React.FC = () => {
  const [token, setToken] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("admin_token") ?? "";
    }
    return "";
  });
  const [tokenInput, setTokenInput] = useState("");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLeaderboard = useCallback(async (t: string) => {
    if (!t) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/leaderboard", {
        headers: { "x-admin-token": t },
      });
      if (!res.ok) {
        if (res.status === 401) {
          setError("INVALID TOKEN");
          setToken("");
          sessionStorage.removeItem("admin_token");
        } else {
          setError("FETCH FAILED");
        }
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { leaderboard: LeaderboardRow[] };
      setRows(data.leaderboard);
      setError(null);
    } catch {
      setError("NETWORK ERROR");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token) return;
    void fetchLeaderboard(token);
    intervalRef.current = setInterval(() => void fetchLeaderboard(token), 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, fetchLeaderboard]);

  // Focus cancel button when reset dialog opens
  useEffect(() => {
    if (resetTarget && cancelRef.current) {
      cancelRef.current.focus();
    }
  }, [resetTarget]);

  function handleTokenSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = tokenInput.trim();
    if (!t) return;
    sessionStorage.setItem("admin_token", t);
    setToken(t);
    setTokenInput("");
  }

  async function handleReset(teamName: string) {
    setResetPending(true);
    try {
      const res = await fetch(
        `/api/admin/reset/${encodeURIComponent(teamName)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-token": token,
          },
          body: JSON.stringify({ confirm: true }),
        },
      );
      if (!res.ok) {
        setError("RESET FAILED");
      } else {
        await fetchLeaderboard(token);
      }
    } catch {
      setError("NETWORK ERROR");
    }
    setResetPending(false);
    setResetTarget(null);
  }

  function handleExport() {
    const url = `/api/admin/export.csv`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "results.csv";
    a.style.display = "none";
    a.setAttribute("data-fetch-header", `x-admin-token:${token}`);
    // Use fetch to add auth header
    fetch(url, { headers: { "x-admin-token": token } })
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => setError("EXPORT FAILED"));
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="bg-panel border border-line p-8 w-full max-w-sm space-y-6">
          <h1 className="font-display text-3xl tracking-widest text-paper">
            ADMIN ACCESS
          </h1>
          <p className="font-mono text-xs text-muted">
            LIVE OPERATIONS // ORGANISER ONLY
          </p>
          <form onSubmit={handleTokenSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-token-input"
                className="block font-mono text-xs text-muted mb-1 uppercase tracking-wider"
              >
                ORGANISER TOKEN
              </label>
              <input
                id="admin-token-input"
                type="password"
                autoComplete="off"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full bg-bg border border-line text-paper font-mono text-sm px-3 py-2 outline-none focus:border-paper"
                placeholder="Enter token"
              />
            </div>
            {error && (
              <p className="font-mono text-xs text-red-text" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              id="admin-login-btn"
              className="w-full bg-red border-0 text-paper font-display tracking-widest text-lg py-2 hover:brightness-110 transition-all"
            >
              ACCESS
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-paper font-mono p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h1 className="font-display text-3xl tracking-widest text-paper">
              LIVE OPERATIONS
            </h1>
            <p className="text-xs text-muted mt-1">
              EL CÓDIGO ROJO // PHASE 1 THE ROYAL MINT
            </p>
          </div>
          <div className="flex gap-3">
            <button
              id="admin-export-btn"
              onClick={handleExport}
              className="border border-line text-paper text-xs px-4 py-2 hover:border-paper transition-all tracking-widest"
            >
              EXPORT CSV
            </button>
            <button
              id="admin-refresh-btn"
              onClick={() => void fetchLeaderboard(token)}
              disabled={loading}
              className="border border-line text-paper text-xs px-4 py-2 hover:border-paper transition-all tracking-widest disabled:opacity-50"
            >
              {loading ? "LOADING..." : "REFRESH"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red/10 border border-red-text text-red-text px-4 py-3 text-xs" role="alert">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse" role="table" aria-label="Leaderboard">
            <thead>
              <tr className="border-b border-line text-muted uppercase tracking-widest">
                <th className="text-left py-2 pr-4">TEAM</th>
                <th className="text-left py-2 pr-4">STATUS</th>
                <th className="text-right py-2 pr-4">TIME REM.</th>
                <th className="text-right py-2 pr-4">SCORE</th>
                <th className="text-right py-2 pr-4">COMPLETION</th>
                <th className="text-right py-2 pr-4">HINTS</th>
                <th className="text-right py-2 pr-4">WRONG</th>
                <th className="text-right py-2 pr-4">CHECKS</th>
                <th className="text-right py-2">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted">
                    NO TEAMS YET
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.teamName}
                  className="border-b border-line/40 hover:bg-panel/50 transition-colors"
                >
                  <td className="py-2 pr-4 font-bold text-paper">{r.teamName}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-2 pr-4 text-right text-amber">
                    {r.status === "ACTIVE"
                      ? formatSeconds(r.timeRemainingSeconds)
                      : "—"}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {r.score !== null ? r.score : "—"}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {formatSeconds(r.completionTimeSeconds)}
                  </td>
                  <td className="py-2 pr-4 text-right">{r.hintsUsed}</td>
                  <td className="py-2 pr-4 text-right">{r.wrongAttempts}</td>
                  <td className="py-2 pr-4 text-right">{r.checksUsed}</td>
                  <td className="py-2 text-right">
                    <button
                      id={`reset-${r.teamName.replace(/\s+/g, "-")}`}
                      onClick={() => setResetTarget(r.teamName)}
                      className="text-red-text border border-red-text/40 px-2 py-0.5 text-[11px] hover:border-red-text transition-all tracking-wider"
                    >
                      RESET
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-muted">
          AUTO-REFRESH EVERY 10 SECONDS // ADMIN SESSION NOT PERSISTED // TOKEN IN SESSIONSTORAGE ONLY
        </p>
      </div>

      {/* Reset Confirmation Modal */}
      {resetTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          className="fixed inset-0 bg-bg/90 flex items-center justify-center z-50 p-4"
        >
          <div className="bg-panel border border-line p-8 max-w-sm w-full space-y-6">
            <h2
              id="reset-modal-title"
              className="font-display text-2xl tracking-widest text-red-text"
            >
              CONFIRM RESET
            </h2>
            <p className="text-sm text-paper">
              Reset session for{" "}
              <span className="font-bold">{resetTarget}</span>?
            </p>
            <p className="text-xs text-muted">
              This will return the team to NOT_STARTED. Their name and passcode
              are kept. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                ref={cancelRef}
                id="reset-cancel-btn"
                onClick={() => setResetTarget(null)}
                className="border border-line px-4 py-2 text-xs text-paper hover:border-paper tracking-widest"
              >
                CANCEL
              </button>
              <button
                id="reset-confirm-btn"
                onClick={() => void handleReset(resetTarget)}
                disabled={resetPending}
                className="bg-red border-0 px-4 py-2 text-xs text-paper tracking-widest hover:brightness-110 disabled:opacity-50"
              >
                {resetPending ? "RESETTING..." : "RESET SESSION"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
