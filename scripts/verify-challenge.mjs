#!/usr/bin/env node
// Deterministic verification of the challenge content.
// Solves the puzzle from structured facts, proves each elimination step is unique,
// checks the facts are actually present in the player-visible text, and checks hint safety.
// Usage: node scripts/verify-challenge.mjs [publicPath] [serverPath]
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pubPath = process.argv[2] ?? resolve(here, "../challenge/public.json");
const srvPath = process.argv[3] ?? resolve(here, "../challenge/server.json");
const pub = JSON.parse(readFileSync(pubPath, "utf8"));
const srv = JSON.parse(readFileSync(srvPath, "utf8"));

let failures = 0;
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`); };
const check = (cond, m) => (cond ? pass(m) : fail(m));
const one = (arr, m) => { check(arr.length === 1, `${m} -> exactly one candidate (${arr.length})`); return arr[0]; };

const body = Object.fromEntries(pub.evidence.map((e) => [e.id, e.body]));

console.log("\n[1] Alias resolution: Quill");
const a = srv.alias_clue;
const byInitials = srv.people.filter((p) => p.initials === a.initials);
check(byInitials.length >= 3, `initials ${a.initials} are shared by ${byInitials.length} people (alias is ambiguous on initials alone)`);
const byRole = byInitials.filter((p) => p.role === a.role);
const quill = one(byRole, "initials + role resolves the alias");
const swapCover = srv.swaps.filter((s) => s.cover_by === quill.id);
check(swapCover.length === 1 && swapCover[0].date === "2026-10-08", "swap register independently points to the same person");

console.log("\n[2] Target date: second Thursday of October 2026");
const rule = srv.target_date_rule;
const days = [];
for (let d = 1; d <= 31; d++) {
  const dt = new Date(Date.UTC(2026, 9, d));
  if (dt.getUTCMonth() === 9 && dt.getUTCDay() === 4) days.push(dt.toISOString().slice(0, 10));
}
const targetDate = days[rule.n - 1];
check(targetDate === "2026-10-08", `second Thursday = ${targetDate}`);
check(days[0] === "2026-10-01", "masthead THURSDAY 1 OCTOBER 2026 is consistent with the calendar");

console.log("\n[3] Door: panel Quill stood at on the target date");
const cover = one(srv.swaps.filter((s) => s.date === targetDate && s.cover_by === quill.id), "swap covering on target date");
const posts = srv.assignments.filter((x) => x.date === targetDate && x.person === cover.covers);
const post = one(posts, "post belonging to the person Quill covered");
const own = srv.assignments.filter((x) => x.date === targetDate && x.person === quill.id);
check(own.length === 0, "Quill has no panel listed under his own name that night (his regular post is a trap)");
const door = post.panel;

console.log("\n[4] Witness: the frame that shows Quill at that panel on that date");
const frames = srv.frames.filter((f) => f.badge === quill.badge && f.location === `Panel ${door}` && f.date === targetDate);
const frame = one(frames, "frame by badge + panel + date");
const witness = frame.tag;
const near = srv.frames.filter((f) => f.badge === quill.badge && f.location === `Panel ${door}`);
check(near.length >= 2, `decoy exists: same badge and panel on another date (${near.length} frames)`);

console.log("\n[5] Metal: red-sealed second casting of the Anniversary series");
const reds = srv.seal_synonyms.red;
const redLots = srv.lots.filter((l) => reds.includes(l.seal));
check(redLots.length >= 2, `red-seal alone is ambiguous (${redLots.length} lots)`);
const lot = one(redLots.filter((l) => l.series === "Anniversary" && l.casting === 2 && l.status === "active"), "series + casting + status resolves the lot");
const metal = lot.lot;

console.log("\n[6] Cipher shift: keys carried on the line");
const onLine = srv.voices.filter((v) => v.on_channel !== false);
const shift = onLine.filter((v) => v.carries_key).length;
check(shift === srv.solution.shift, `keys carried on the line = ${shift}`);

console.log("\n[7] Transform + ordering");
const shiftStr = (n) => String(n).padStart(2, "0").split("").map((c) => (Number(c) + shift) % 10).join("");
const t = { door: shiftStr(door), witness: shiftStr(witness), metal: shiftStr(metal) };
const code = srv.ordering.map((k) => t[k]).join("");
check(code.length === 6 && /^\d{6}$/.test(code), `derived code has 6 digits`);
check(code === srv.solution.final_code, "derived code matches solution.final_code");
check(JSON.stringify(t) === JSON.stringify(srv.solution.transformed_values), "transformed values match");
check(door === srv.solution.extracted_values.door && witness === srv.solution.extracted_values.witness && metal === srv.solution.extracted_values.metal, "extracted values match");
const noWrapCode = srv.ordering.map((k) => String(srv.solution.extracted_values[k]).split("").map((c) => Number(c) + shift).join("")).join("");
check(noWrapCode !== code, "forgetting the wrap-around produces a different (wrong) code");
const rawCode = srv.ordering.map((k) => String(srv.solution.extracted_values[k])).join("");
check(rawCode !== code, "skipping the cipher produces a different (wrong) code");
const wrongOrderCode = ["door", "metal", "witness"].map((k) => t[k]).join("");
check(wrongOrderCode !== code, "wrong ordering produces a different (wrong) code");

console.log("\n[8] Facts are visible in the player-facing text");
for (const n of srv.needles) {
  check(body[n.evidence]?.includes(n.text), `file ${n.evidence}: "${n.text.slice(0, 60)}${n.text.length > 60 ? "..." : ""}"`);
}

console.log("\n[9] Unlock graph");
const ids = new Set(pub.evidence.map((e) => e.id));
let ok = true;
for (const e of pub.evidence) for (const r of e.unlock.requires_opened) if (!ids.has(r) || r >= e.id) ok = false;
check(ok, "unlock requirements reference earlier files only (no cycles)");
check(pub.evidence.filter((e) => e.unlock.requires_opened.length === 0).length >= 3, "at least 3 files open at start");

console.log("\n[10] Hint safety (no final digits or transformed values)");
const forbidden = new RegExp(`\\b(${[srv.solution.final_code, ...Object.values(srv.solution.extracted_values), ...Object.values(srv.solution.transformed_values)].join("|")})\\b`);
for (const h of srv.hints) check(!forbidden.test(h.text), `hint ${h.id} contains no answer values`);
check(!forbidden.test(body["05"]), "cipher note contains no answer values");

console.log("\n[11] Player-facing noise and reading load");
const words = (s) => s.split(/\s+/).filter(Boolean).length;
const total = pub.evidence.reduce((n, e) => n + words(e.body), 0);
for (const e of pub.evidence) console.log(`        file ${e.id}: ${words(e.body)} words`);
console.log(`        total: ${total} words (~${(total / 200).toFixed(1)} min single-reader at 200 wpm)`);
const nums = new Set(Object.values(body).join(" ").match(/\b\d{2}\b/g));
console.log(`        distinct two-digit numbers visible: ${nums.size}`);
check(total >= 900 && total <= 1800, "reading load within the 12-18 minute solve target band");

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
