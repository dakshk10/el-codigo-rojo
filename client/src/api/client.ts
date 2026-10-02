import type { SessionSnapshot, Token } from "shared";

export class ApiError extends Error {
  public status: number;
  public code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = `Request failed with status ${res.status}`;

    try {
      const data = await res.json();
      if (data && typeof data === "object") {
        if (typeof data.error === "string") errorCode = data.error;
        if (typeof data.message === "string") errorMessage = data.message;
      }
    } catch {
      // response was not JSON
    }

    throw new ApiError(res.status, errorCode, errorMessage);
  }

  return (await res.json()) as T;
}

export interface EvidenceResponse {
  tokens: Token[];
  metadata: Record<string, string>;
}

export const api = {
  verifyEventCode: async (code: string): Promise<{ ok: boolean }> => {
    return request<{ ok: boolean }>("/api/event/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },

  enterTeam: async (
    teamName: string,
    passcode: string
  ): Promise<{ ok: boolean; created: boolean }> => {
    return request<{ ok: boolean; created: boolean }>("/api/teams/enter", {
      method: "POST",
      body: JSON.stringify({ teamName, passcode }),
    });
  },

  fetchSession: async (): Promise<SessionSnapshot> => {
    return request<SessionSnapshot>("/api/session", {
      method: "GET",
    });
  },

  startSession: async (): Promise<SessionSnapshot> => {
    return request<SessionSnapshot>("/api/session/start", {
      method: "POST",
    });
  },

  fetchEvidence: async (id: string): Promise<EvidenceResponse> => {
    return request<EvidenceResponse>(`/api/evidence/${id}`, {
      method: "GET",
    });
  },

  useHint: async (id: number): Promise<{ text: string }> => {
    return request<{ text: string }>(`/api/session/hints/${id}/use`, {
      method: "POST",
      body: JSON.stringify({ confirm: true }),
    });
  },

  putWorkspace: async (workspace: Record<string, unknown>): Promise<{ ok: boolean }> => {
    return request<{ ok: boolean }>("/api/session/workspace", {
      method: "PUT",
      body: JSON.stringify(workspace),
    });
  },

  checkTransformation: async (
    values: string[]
  ): Promise<{ valid: boolean; checksRemaining: number }> => {
    return request<{ valid: boolean; checksRemaining: number }>("/api/session/check", {
      method: "POST",
      body: JSON.stringify({ values }),
    });
  },

  submitCode: async (
    code: string,
    idempotencyKey: string
  ): Promise<{ result: "GRANTED" | "DENIED"; attemptsRemaining?: number }> => {
    return request<{ result: "GRANTED" | "DENIED"; attemptsRemaining?: number }>(
      "/api/session/submit",
      {
        method: "POST",
        body: JSON.stringify({ code, idempotencyKey }),
      }
    );
  },
};

