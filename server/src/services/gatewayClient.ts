import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { config } from "../config.js";

export type GatewayEventType = "hint_used" | "wrong_attempt" | "solved";
export type GatewayEventStatus = "sent" | "queued" | "failed";

export interface GatewayEventPayload {
  event_id?: string;
  game_id?: string;
  type: GatewayEventType;
  points: number;
  team_id: string | null;
  meta?: {
    time_taken_seconds: number;
    attempts: number;
  };
}

export interface GatewayEventRecord {
  event_id: string;
  game_id: string;
  type: GatewayEventType;
  points: number;
  team_id: string | null;
  meta?: {
    time_taken_seconds: number;
    attempts: number;
  };
}

export interface GatewayLogLine {
  dispatched_at: string;
  event_id: string;
  type: GatewayEventType;
  team_id: string | null;
  status: GatewayEventStatus;
}

interface QueuedItem {
  record: GatewayEventRecord;
  delayMs: number;
  timer?: NodeJS.Timeout;
}

export interface GatewayClientOptions {
  baseUrl?: string;
  gameKey?: string;
  logPath?: string;
  fetchFn?: typeof fetch;
}

export class GatewayClient {
  private baseUrl: string;
  private gameKey: string;
  private logPath: string;
  private fetchFn: typeof fetch;
  private retryQueue: QueuedItem[] = [];

  constructor(options: GatewayClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? config.GATEWAY_BASE_URL;
    this.gameKey = options.gameKey ?? config.GATEWAY_GAME_KEY;
    this.logPath = options.logPath ?? config.GATEWAY_LOG_PATH;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  private resolveUrl(): string {
    const base = this.baseUrl.trim();
    if (!base) return "";
    if (base.endsWith("/api/events") || base.endsWith("/events")) {
      return base;
    }
    return `${base.replace(/\/+$/, "")}/api/events`;
  }

  private appendLog(entry: GatewayLogLine): void {
    try {
      const fullPath = resolve(process.cwd(), this.logPath);
      mkdirSync(dirname(fullPath), { recursive: true });
      appendFileSync(fullPath, JSON.stringify(entry) + "\n", "utf8");
    } catch (err) {
      console.error("Failed to write to gateway events log:", err);
    }
  }

  public getQueueLength(): number {
    return this.retryQueue.length;
  }

  public clearQueue(): void {
    for (const item of this.retryQueue) {
      if (item.timer) clearTimeout(item.timer);
    }
    this.retryQueue = [];
  }

  public async sendEvent(payload: GatewayEventPayload): Promise<GatewayEventStatus> {
    const record: GatewayEventRecord = {
      event_id: payload.event_id ?? randomUUID(),
      game_id: payload.game_id ?? "p1g1",
      type: payload.type,
      points: payload.points,
      team_id: payload.team_id,
      ...(payload.meta ? { meta: payload.meta } : {}),
    };

    return this.dispatchRecord(record);
  }

  private async dispatchRecord(
    record: GatewayEventRecord,
    currentDelayMs = 15000,
  ): Promise<GatewayEventStatus> {
    const url = this.resolveUrl();
    let status: GatewayEventStatus;
    let shouldQueue = false;

    if (!url) {
      status = "failed";
    } else {
      try {
        const res = await this.fetchFn(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Game-Key": this.gameKey,
          },
          body: JSON.stringify(record),
          signal: AbortSignal.timeout(3000),
        });

        if (res.ok || res.status === 409) {
          status = "sent";
        } else if ([401, 403, 404].includes(res.status)) {
          console.error(`Gateway configuration error (${res.status}): do not retry.`);
          status = "failed";
        } else if (res.status >= 500 && res.status < 600) {
          status = "queued";
          shouldQueue = true;
        } else {
          console.error(`Gateway error (${res.status}): do not retry.`);
          status = "failed";
        }
      } catch (err) {
        // Network failure or AbortError timeout
        status = "queued";
        shouldQueue = true;
      }
    }

    this.appendLog({
      dispatched_at: new Date().toISOString(),
      event_id: record.event_id,
      type: record.type,
      team_id: record.team_id,
      status,
    });

    if (shouldQueue) {
      this.enqueueRetry(record, currentDelayMs);
    }

    return status;
  }

  private enqueueRetry(record: GatewayEventRecord, delayMs: number): void {
    const item: QueuedItem = { record, delayMs };
    const timer = setTimeout(async () => {
      await this.processRetry(item);
    }, delayMs);
    timer.unref();
    item.timer = timer;
    this.retryQueue.push(item);
  }

  private async processRetry(item: QueuedItem): Promise<void> {
    // Remove from active queue
    const idx = this.retryQueue.indexOf(item);
    if (idx !== -1) {
      this.retryQueue.splice(idx, 1);
    }

    // Exponential backoff capped at 30 seconds
    const nextDelay = Math.min(item.delayMs * 2, 30000);
    await this.dispatchRecord(item.record, nextDelay);
  }

  public async retryAllPendingNow(): Promise<void> {
    const items = [...this.retryQueue];
    this.clearQueue();
    for (const item of items) {
      const nextDelay = Math.min(item.delayMs * 2, 30000);
      await this.dispatchRecord(item.record, nextDelay);
    }
  }
}

// Module singleton and testing helpers
let defaultGatewayClient = new GatewayClient();

export function getDefaultGatewayClient(): GatewayClient {
  return defaultGatewayClient;
}

export function setDefaultGatewayClient(client: GatewayClient): void {
  defaultGatewayClient.clearQueue();
  defaultGatewayClient = client;
}

/**
 * Fires a gateway event in a non-blocking background microtask with its own error boundary.
 * Never throws and never delays player-facing responses.
 */
export function sendGatewayEvent(payload: GatewayEventPayload): void {
  queueMicrotask(() => {
    defaultGatewayClient.sendEvent(payload).catch((err) => {
      console.error("Gateway background dispatch unexpected error:", err);
    });
  });
}
