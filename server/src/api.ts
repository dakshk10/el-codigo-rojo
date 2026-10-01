/**
 * Vercel Functions entry point.
 * The Express app is exported as default — Vercel detects it and routes requests to it.
 * Approach confirmed: Vercel Node runtime supports exporting an Express app directly.
 */
import { validateChallenge } from "./challenge.js";
import { getDb } from "./db.js";
import { buildApp } from "./app.js";

// Validate challenge files at cold start — refuse to serve if invalid
validateChallenge();

const db = getDb();
const app = buildApp(db);

export default app;
