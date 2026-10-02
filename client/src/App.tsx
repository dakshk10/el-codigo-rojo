import React, { useEffect, useState } from "react";
import { useSessionStore } from "./store/sessionStore.js";
import { EventGate } from "./views/EventGate.js";
import { TeamEntry } from "./views/TeamEntry.js";
import { Briefing } from "./views/Briefing.js";
import { ControlRoom } from "./views/ControlRoom.js";
import { Timer } from "./components/timer/Timer.js";
import { ProjectedScore } from "./components/scoring/ProjectedScore.js";
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

    // Active session view: Control Room (Phase 3)
    return <ControlRoom />;
  };

  const showTopBar = session && session.status !== "NOT_STARTED";

  return (
    <div className="min-h-screen bg-bg text-paper flex flex-col font-sans">
      <ReconnectBanner isReconnecting={isReconnecting} />

      {/* Top Header Bar when session is in play */}
      {showTopBar && (
        <header className="border-b border-line bg-panel px-6 py-2.5 flex items-center justify-between z-30 sticky top-0 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl tracking-widest text-paper">
              EL CÓDIGO ROJO
            </h1>
            <span className="hidden sm:inline font-mono text-xs text-muted border-l border-line pl-3">
              PHASE 1 // ROYAL MINT
            </span>
            <span className="font-mono text-xs text-muted border-l border-line pl-3">
              CONTROL ROOM
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-xs font-bold text-paper border border-line px-2.5 py-1 bg-bg">
              {session.team.name}
            </span>
            <ProjectedScore session={session} />
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
