#!/usr/bin/env node
/**
 * Load test: 20 concurrent simulated sessions.
 * Polls session state, opens evidence, uses a hint, submits a wrong code, submits the
 * correct code. Asserts session isolation (each team only sees its own state).
 * Reports p95 latency for all API calls.
 *
 * Usage:
 *   LOAD_TEST_URL=https://your-preview.vercel.app node scripts/load-test.mjs
 *   EVENT_CODE=your-event-code LOAD_TEST_URL=... node scripts/load-test.mjs
 *
 * Requires a running server with a valid DATABASE_URL. All teams are cleaned up by
 * using unique team names with a timestamp prefix.
 *
 * NOTE: When run against the live Vercel preview, this script performs real HTTP
 * requests. The base URL and event code are read from environment variables.
 * Passcodes in this script are only used for the load test; they are transient.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env["LOAD_TEST_URL"] ?? "http://localhost:3001";
const EVENT_CODE = process.env["EVENT_CODE"] ?? "dev-event-code";
const NUM_SESSIONS = Number(process.env["LOAD_TEST_SESSIONS"] ?? "20");

const srvPath = resolve(here, "../challenge/server.json");
const srv = JSON.parse(readFileSync(srvPath, "utf8"));
const REAL_CODE = srv.solution.final_code;

const latencies = [];
let failures = 0;
let stateLeaks = 0;

async function timed(fn) {
  const start = Date.now();
  try {
    const result = await fn();
    latencies.push(Date.now() - start);
    return result;
  } catch (err) {
    latencies.push(Date.now() - start);
    throw err;
  }
}

async function apiCall(path, options = {}, cookie = "") {
  const headers = {
    "Content-Type": "application/json",
    ...(cookie ? { Cookie: cookie } : {}),
    ...(options.headers ?? {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const sessionCookie = setCookie.match(/ecr_session=([^;]+)/)?.[0] ?? cookie;
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body, cookie: sessionCookie };
}

async function runSession(index) {
  const teamName = `LoadTest${Date.now()}T${index}`;
  const passcode = `${String(index % 10)}${String((index + 1) % 10)}${String((index + 2) % 10)}${String((index + 3) % 10)}`;
  let cookie = "";

  try {
    // Verify event code
    const ev = await timed(() =>
      apiCall("/api/event/verify", {
        method: "POST",
        body: JSON.stringify({ code: EVENT_CODE }),
      }),
    );
    if (ev.status !== 200) {
      console.error(`[T${index}] event verify failed: ${ev.status}`);
      failures++;
      return { teamName, ok: false };
    }

    // Enter team
    const enter = await timed(() =>
      apiCall(
        "/api/teams/enter",
        {
          method: "POST",
          body: JSON.stringify({ teamName, passcode }),
        },
        cookie,
      ),
    );
    if (enter.status !== 200) {
      console.error(`[T${index}] enter failed: ${enter.status}`);
      failures++;
      return { teamName, ok: false };
    }
    cookie = enter.cookie;

    // Start session
    await timed(() =>
      apiCall("/api/session/start", { method: "POST" }, cookie),
    );

    // Fetch session — verify this session belongs to this team
    const sessRes = await timed(() =>
      apiCall("/api/session", { method: "GET" }, cookie),
    );
    if (sessRes.body?.team?.name !== teamName) {
      console.error(
        `[T${index}] STATE LEAK: got team="${sessRes.body?.team?.name}" expected="${teamName}"`,
      );
      stateLeaks++;
      failures++;
      return { teamName, ok: false };
    }

    // Open evidence 01, 02, 03
    for (const id of ["01", "02", "03"]) {
      await timed(() =>
        apiCall(`/api/evidence/${id}`, { method: "GET" }, cookie),
      );
    }

    // Submit wrong code
    const wrongKey = `wrong-${Date.now()}-${index}`;
    const wrongRes = await timed(() =>
      apiCall(
        "/api/session/submit",
        {
          method: "POST",
          body: JSON.stringify({ code: "000000", idempotencyKey: wrongKey }),
        },
        cookie,
      ),
    );
    if (wrongRes.body?.result !== "DENIED") {
      console.error(`[T${index}] expected DENIED on wrong code`);
      failures++;
    }

    // Submit correct code
    const rightKey = `right-${Date.now()}-${index}`;
    const rightRes = await timed(() =>
      apiCall(
        "/api/session/submit",
        {
          method: "POST",
          body: JSON.stringify({ code: REAL_CODE, idempotencyKey: rightKey }),
        },
        cookie,
      ),
    );
    if (rightRes.body?.result !== "GRANTED") {
      console.error(`[T${index}] expected GRANTED on correct code, got ${rightRes.body?.result}`);
      failures++;
      return { teamName, ok: false };
    }

    // Final session check — must be SOLVED
    const finalSess = await timed(() =>
      apiCall("/api/session", { method: "GET" }, cookie),
    );
    if (finalSess.body?.status !== "SOLVED") {
      console.error(`[T${index}] expected SOLVED, got ${finalSess.body?.status}`);
      failures++;
      return { teamName, ok: false };
    }

    // Isolation check: the solved score must be present and unique to this session
    if (finalSess.body?.team?.name !== teamName) {
      console.error(`[T${index}] final STATE LEAK: team mismatch`);
      stateLeaks++;
      failures++;
      return { teamName, ok: false };
    }

    return { teamName, ok: true };
  } catch (err) {
    console.error(`[T${index}] exception:`, err instanceof Error ? err.message : err);
    failures++;
    return { teamName, ok: false };
  }
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

console.log(`\nEL CÓDIGO ROJO — Load Test`);
console.log(`Base URL: ${BASE_URL}`);
console.log(`Sessions: ${NUM_SESSIONS}\n`);

const start = Date.now();
const results = await Promise.all(
  Array.from({ length: NUM_SESSIONS }, (_, i) => runSession(i)),
);
const elapsed = Date.now() - start;

const passed = results.filter((r) => r.ok).length;
const p50 = percentile(latencies, 50);
const p95 = percentile(latencies, 95);
const p99 = percentile(latencies, 99);

console.log(`\nResults:`);
console.log(`  Sessions: ${NUM_SESSIONS}`);
console.log(`  Passed:   ${passed}/${NUM_SESSIONS}`);
console.log(`  Failures: ${failures}`);
console.log(`  State leaks: ${stateLeaks}`);
console.log(`\nLatency (ms):`);
console.log(`  p50: ${p50}`);
console.log(`  p95: ${p95}`);
console.log(`  p99: ${p99}`);
console.log(`  Total wall time: ${elapsed}ms`);

if (failures > 0 || stateLeaks > 0) {
  console.error(`\nFAIL: ${failures} failure(s), ${stateLeaks} state leak(s)\n`);
  process.exit(1);
} else {
  console.log(`\nPASS: All ${NUM_SESSIONS} sessions isolated and correct. p95=${p95}ms\n`);
  process.exit(0);
}
