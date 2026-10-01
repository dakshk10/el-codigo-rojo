import { create } from "zustand";
import type { SessionSnapshot } from "shared";
import { api, ApiError } from "../api/client.js";

interface SessionStore {
  // Session data
  session: SessionSnapshot | null;
  serverOffset: number;
  serverNowAtFetch: number;
  perfNowAtFetch: number;

  // Gate state
  eventCodeVerified: boolean;
  setEventCodeVerified: (verified: boolean) => void;

  // Network & polling state
  isLoading: boolean;
  isReconnecting: boolean;
  reconnectAttempt: number;
  error: string | null;

  // Actions
  setSession: (session: SessionSnapshot) => void;
  fetchSession: () => void;
  startSession: () => Promise<void>;
  startPolling: () => () => void;
}

const POLL_INTERVAL_MS = 15000;
const INITIAL_RETRY_MS = 2000;
const MAX_RETRY_MS = 15000;

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  serverOffset: 0,
  serverNowAtFetch: 0,
  perfNowAtFetch: 0,

  eventCodeVerified: false,
  setEventCodeVerified: (verified: boolean) => {
    set({ eventCodeVerified: verified });
  },

  isLoading: false,
  isReconnecting: false,
  reconnectAttempt: 0,
  error: null,

  setSession: (session: SessionSnapshot) => {
    const clientNow = Date.now();
    const serverOffset = session.serverNow - clientNow;
    const perfNow =
      typeof performance !== "undefined" ? performance.now() : clientNow;

    set({
      session,
      serverOffset,
      serverNowAtFetch: session.serverNow,
      perfNowAtFetch: perfNow,
      isReconnecting: false,
      reconnectAttempt: 0,
      error: null,
    });
  },

  fetchSession: async () => {
    try {
      const session = await api.fetchSession();
      get().setSession(session);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        // No session cookie yet, or logged out
        set({ session: null, isReconnecting: false });
        return;
      }
      // Network failure or 5xx -> signal reconnecting
      set({ isReconnecting: true });
    }
  },

  startSession: async () => {
    set({ isLoading: true, error: null });
    try {
      const session = await api.startSession();
      get().setSession(session);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        set({ error: err.message });
      } else {
        set({ error: "Failed to begin heist." });
      }
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  startPolling: () => {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const scheduleNext = (delayMs: number) => {
      if (cancelled) return;
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(async () => {
        await executePoll();
      }, delayMs);
    };

    const executePoll = async () => {
      if (cancelled) return;
      try {
        const session = await api.fetchSession();
        if (cancelled) return;
        get().setSession(session);
        // Successful fetch: schedule next standard poll
        scheduleNext(POLL_INTERVAL_MS);
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          // Not logged in, stop aggressive retries
          set({ session: null, isReconnecting: false });
          scheduleNext(POLL_INTERVAL_MS);
          return;
        }

        // Network error -> backoff retry
        const nextAttempt = get().reconnectAttempt + 1;
        const backoffDelay = Math.min(
          INITIAL_RETRY_MS * Math.pow(1.5, nextAttempt - 1),
          MAX_RETRY_MS
        );
        set({ isReconnecting: true, reconnectAttempt: nextAttempt });
        scheduleNext(backoffDelay);
      }
    };

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        void executePoll();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleFocus);
    }

    // Initial poll
    void executePoll();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("visibilitychange", handleFocus);
      }
    };
  },
}));
