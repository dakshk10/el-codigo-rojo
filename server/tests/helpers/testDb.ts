import { PGlite } from "@electric-sql/pglite";
import { PGliteDialect, Kysely } from "kysely";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "../../src/db.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  resolve(here, "../../migrations/001_initial.sql"),
  "utf8",
);

export async function createTestDb(): Promise<Kysely<Database>> {
  const pglite = new PGlite();
  const db = new Kysely<Database>({
    dialect: new PGliteDialect({ pglite }),
  });
  // Run migration
  await pglite.exec(migrationSql);
  return db;
}
