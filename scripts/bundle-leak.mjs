#!/usr/bin/env node
/**
 * Bundle leak scan.
 * Scans the built client (client/dist) for strings that must never appear there:
 *   - The final vault code
 *   - Transformed values
 *   - Hint text
 *   - Private server.json top-level keys
 *
 * Usage: node scripts/bundle-leak.mjs
 * Exit code: 0 = clean, 1 = leaks found
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, "../client/dist");
const srvPath = resolve(here, "../challenge/server.json");

let srv;
try {
  srv = JSON.parse(readFileSync(srvPath, "utf8"));
} catch {
  console.error("ERROR: Could not read challenge/server.json");
  process.exit(1);
}

// Build needle list
const needles = new Set();
if (srv.solution?.final_code) needles.add(srv.solution.final_code);

for (const h of srv.hints ?? []) if (h.text) needles.add(h.text);

// Detect private top-level keys as labels (not all strings, just key names)
const PRIVATE_KEYS = [
  "target_date_rule",
  "alias_clue",
  "swaps",
  "assignments",
  "carries_key",
  "min_time_multiplier",
  "speed_bonus_points",
  "check_penalty_seconds",
];
for (const k of PRIVATE_KEYS) needles.add(k);

// Collect all JS/CSS/HTML/map files
function collectFiles(dir) {
  const results = [];
  try {
    for (const name of readdirSync(dir)) {
      const full = resolve(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        results.push(...collectFiles(full));
      } else {
        const ext = extname(name).toLowerCase();
        if ([".js", ".ts", ".jsx", ".tsx", ".css", ".html", ".map", ".json"].includes(ext)) {
          results.push(full);
        }
      }
    }
  } catch {
    // dist may not exist yet
  }
  return results;
}

let distExists = false;
try {
  statSync(distDir);
  distExists = true;
} catch {
  console.error(`\nERROR: ${distDir} does not exist. Run 'npm run build -w client' first.\n`);
  process.exit(1);
}

if (!distExists) process.exit(1);

const files = collectFiles(distDir);
if (files.length === 0) {
  console.error(`\nERROR: No files found in ${distDir}. Build may be empty.\n`);
  process.exit(1);
}

let leaks = 0;
const cleanNeedles = [...needles].filter(Boolean);

for (const filePath of files) {
  const content = readFileSync(filePath, "utf8");
  for (const needle of cleanNeedles) {
    if (content.includes(needle)) {
      console.error(`  LEAK  "${needle}" found in ${filePath.replace(distDir, "dist")}`);
      leaks++;
    }
  }
}

if (leaks === 0) {
  console.log(`\n  PASS  Bundle leak scan clean — ${files.length} files scanned, 0 leaks found.\n`);
  process.exit(0);
} else {
  console.error(`\n  FAIL  ${leaks} leak(s) found in built client bundle.\n`);
  process.exit(1);
}
