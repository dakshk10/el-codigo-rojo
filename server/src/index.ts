/**
 * Local development server entry point.
 * Run with: npm run dev (uses tsx)
 * Or: vercel dev (closer to production environment)
 */
import { validateChallenge } from "./challenge.js";
import { getDb } from "./db.js";
import { buildApp } from "./app.js";
import { config } from "./config.js";

validateChallenge();

const db = getDb();
const app = buildApp(db);

app.listen(config.PORT, () => {
  process.stdout.write(`[server] listening on http://localhost:${config.PORT}\n`);
});
