import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PublicChallengeSchema, ServerChallengeSchema } from "shared";
import type { PublicChallenge, ServerChallenge } from "shared";

let _public: PublicChallenge | null = null;
let _server: ServerChallenge | null = null;

function load(): { pub: PublicChallenge; srv: ServerChallenge } {
  if (_public && _server) return { pub: _public, srv: _server };

  // server/src/challenge.ts → go up 3 levels: src → server → repo root
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

  const pubRaw = JSON.parse(readFileSync(resolve(root, "challenge/public.json"), "utf8"));
  const srvRaw = JSON.parse(readFileSync(resolve(root, "challenge/server.json"), "utf8"));

  const pubResult = PublicChallengeSchema.safeParse(pubRaw);
  if (!pubResult.success) {
    throw new Error(
      `challenge/public.json failed schema validation: ${pubResult.error.message}`,
    );
  }

  const srvResult = ServerChallengeSchema.safeParse(srvRaw);
  if (!srvResult.success) {
    throw new Error(
      `challenge/server.json failed schema validation: ${srvResult.error.message}`,
    );
  }

  _public = pubResult.data;
  _server = srvResult.data;
  return { pub: _public, srv: _server };
}

/** Returns the validated public challenge. Throws if schema validation fails. */
export function getPublicChallenge(): PublicChallenge {
  return load().pub;
}

/** Returns the validated server challenge. Throws if schema validation fails. SERVER ONLY. */
export function getServerChallenge(): ServerChallenge {
  return load().srv;
}

/** Reset cached challenge (for testing). */
export function resetChallenge(): void {
  _public = null;
  _server = null;
  _teams = null;
}

let _teams: Record<string, string> | null = null;

/** Load and return challenge/teams.json team ID map. */
export function getTeamsMap(): Record<string, string> {
  if (_teams !== null) return _teams;
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  try {
    const raw = readFileSync(resolve(root, "challenge/teams.json"), "utf8");
    _teams = JSON.parse(raw);
  } catch {
    _teams = {};
  }
  return _teams!;
}

/** Set or override teams map (for testing). */
export function setTeamsMapForTesting(map: Record<string, string> | null): void {
  _teams = map;
}

/** Load and validate both challenge files — call at startup. */
export function validateChallenge(): void {
  load();
  getTeamsMap();
}

