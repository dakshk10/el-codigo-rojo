import { PGlite } from "@electric-sql/pglite";
import { PGliteDialect, Kysely } from "kysely";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "../../src/db.js";

const here = dirname(fileURLToPath(import.meta.url));
const migration001 = readFileSync(
  resolve(here, "../../migrations/001_initial.sql"),
  "utf8",
);
const migration002 = readFileSync(
  resolve(here, "../../migrations/002_gateway.sql"),
  "utf8",
);

export async function createTestDb(): Promise<Kysely<Database>> {
  const pglite = new PGlite();
  const db = new Kysely<Database>({
    dialect: new PGliteDialect({ pglite }),
  });
  // Run migrations in order
  await pglite.exec(migration001);
  await pglite.exec(migration002);
  return db;
}

