import React, { useEffect, useState } from "react";
import { useSessionStore } from "./store/sessionStore.js";
import { EventGate } from "./views/EventGate.js";
import { TeamEntry } from "./views/TeamEntry.js";
import { Briefing } from "./views/Briefing.js";
import { Timer } from "./components/timer/Timer.js";
import { ReconnectBanner } from "./components/common/ReconnectBanner.js";
import { ToastContainer, type ToastMessage } from "./components/common/Toast.js";

export const App: React.FC = () => {
  const {
    session,
    eventCodeVerified,
    setEventCodeVerified,
    isReconnecting,
    startPolling,
  } = useSessionStore();

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, setTick] = useState<number>(0);

  // Initialize event verification from sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("event_code_verified");
      if (stored === "true") {
        setEventCodeVerified(true);
      }
    }
  }, [setEventCodeVerified]);

  // Start session polling and listen to hash change
  useEffect(() => {
    const stopPolling = startPolling();

    const handleHashChange = () => {
      setTick((t) => t + 1);
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      stopPolling();
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [startPolling]);

  const addToast = (message: string) => {
    setToasts((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, message },
    ]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleEventSuccess = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("event_code_verified", "true");
    }
    setEventCodeVerified(true);
  };

  // Determine which screen to render
  const renderContent = () => {
    if (!eventCodeVerified) {
      return <EventGate onSuccess={handleEventSuccess} />;
    }

    if (!session) {
      return (
        <TeamEntry
          onSuccess={(status) => {
            if (status === "NOT_STARTED") {
              window.location.hash = "#briefing";
            } else {
              window.location.hash = "#control";
            }
          }}
        />
      );
    }

    if (session.status === "NOT_STARTED") {
      return (
        <Briefing
          onStart={() => {
            window.location.hash = "#control";
          }}
        />
      );
    }

    // Active or terminal session view (Phase 2 shell)
    return (
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-panel border border-line p-8 shadow-2xl relative">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-line pb-6 mb-6">
            <div>
              <p className="font-mono text-xs text-muted tracking-widest uppercase mb-1">
                OPERATION ACTIVE // VAULT LEVEL
              </p>
              <h2 className="font-display text-3xl tracking-wider text-paper">
                CONTROL ROOM
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted">TEAM:</span>
              <span className="font-mono text-xs font-bold text-paper border border-line px-2.5 py-1 bg-bg">
                {session.team.name}
              </span>
            </div>
          </div>

          <div className="p-6 bg-bg border border-line font-mono text-sm space-y-4">
            <p className="text-amber">
              [PHASE 2 WORKSPACE SHELL] Operation begun. Autorun timer active.
            </p>
            <p className="text-muted text-xs">
              Evidence documents and investigation tools unlock in Phase 3.
            </p>
          </div>
        </div>
      </main>
    );
  };

  const showTopBar = session && session.status !== "NOT_STARTED";

  return (
    <div className="min-h-screen bg-bg text-paper flex flex-col font-sans">
      <ReconnectBanner isReconnecting={isReconnecting} />

      {/* Top Header Bar when session is in play */}
      {showTopBar && (
        <header className="border-b border-line bg-panel px-6 py-3 flex items-center justify-between z-30 sticky top-0">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl tracking-widest text-paper">
              EL CÓDIGO ROJO
            </h1>
            <span className="hidden sm:inline font-mono text-xs text-muted border-l border-line pl-3">
              PHASE 1 // ROYAL MINT
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Timer onShowToast={addToast} />
          </div>
        </header>
      )}

      {/* Main View */}
      <div className="flex-1">{renderContent()}</div>

      {/* Toast container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
