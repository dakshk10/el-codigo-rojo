import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  tokenise,
  normalise,
  normaliseWord,
  isStopword,
  TfIdfIndex,
  getTokensInRange,
  getTextFromRange,
  createEntityDraft,
} from "../src/index.js";
import type { PublicChallenge } from "../src/schemas/public.js";

const publicChallengePath = path.resolve(
  __dirname,
  "../../challenge/public.json"
);
const serverChallengePath = path.resolve(
  __dirname,
  "../../challenge/server.json"
);

describe("NLP Layer (Phase 2)", () => {
  it("normalise: converts to lowercase and cleans punctuation", () => {
    const raw = "  --CHANNEL 7 // ENCRYPTED VOICE INTERCEPT!!  ";
    const cleaned = normalise(raw);
    expect(cleaned).toBe("channel 7 encrypted voice intercept");
  });

  it("normaliseWord: cleans surrounding punctuation from tokens", () => {
    expect(normaliseWord('"vault,"')).toBe("vault");
    expect(normaliseWord("SW-1008")).toBe("sw-1008");
    expect(normaliseWord("   ")).toBe("");
  });

  it("stopwords: identifies standard English stopwords and preserves non-stopwords", () => {
    expect(isStopword("the")).toBe(true);
    expect(isStopword("and")).toBe(true);
    expect(isStopword("is")).toBe(true);
    expect(isStopword("vault")).toBe(false);
    expect(isStopword("herrera")).toBe(false);
    expect(isStopword("quill")).toBe(false);
  });

  it("stable token IDs: produces identical token IDs across multiple runs for the same input", () => {
    const sampleText = "The Royal Mint vault has been isolated. Panel 52.";
    const run1 = tokenise(sampleText);
    const run2 = tokenise(sampleText);

    expect(run1).toEqual(run2);
    expect(run1.length).toBeGreaterThan(0);
    const first = run1[0];
    const last = run1[run1.length - 1];
    expect(first?.id).toBe("t0");
    expect(last?.id).toBe(`t${run1.length - 1}`);
    expect(run1.map((t) => t.text).join("")).toBe(sampleText);
  });

  it("token range helpers: getTokensInRange, getTextFromRange, createEntityDraft", () => {
    const sampleText = "Tomas Herrera Vault Systems Technician";
    const tokens = tokenise(sampleText);

    // First two words: "Tomas Herrera"
    // Tokens: t0="Tomas", t1=" ", t2="Herrera", ...
    const text = getTextFromRange(tokens, "t0", "t2");
    expect(text).toBe("Tomas Herrera");

    // Reversed order selection
    const textReversed = getTextFromRange(tokens, "t2", "t0");
    expect(textReversed).toBe("Tomas Herrera");

    const draft = createEntityDraft(tokens, "t0", "t2", "person");
    expect(draft).toEqual({
      startTokenId: "t0",
      endTokenId: "t2",
      text: "Tomas Herrera",
      type: "person",
    });
  });

  it("TF-IDF ranking on real public.json evidence files", () => {
    const publicData: PublicChallenge = JSON.parse(
      fs.readFileSync(publicChallengePath, "utf-8")
    );

    const index = new TfIdfIndex();
    for (const ev of publicData.evidence) {
      index.addDocument({
        id: ev.id,
        tokens: tokenise(ev.body),
      });
    }

    // Search for a specific term known to be prominent in File 02 (Shift Manifest)
    const manifestResults = index.search("manifest shift roster");
    expect(manifestResults.length).toBeGreaterThan(0);
    expect(manifestResults[0]?.docId).toBe("02");

    // Search for "cinder transcript callsign" -> File 01
    const transcriptResults = index.search("cinder transcript callsign");
    expect(transcriptResults.length).toBeGreaterThan(0);
    expect(transcriptResults[0]?.docId).toBe("01");

    // Search for "courier bullion anniversary" -> File 03
    const articleResults = index.search("courier bullion anniversary");
    expect(articleResults.length).toBeGreaterThan(0);
    expect(articleResults[0]?.docId).toBe("03");
  });

  it("proof of NO alias or synonym expansion (P2-01)", () => {
    const publicData: PublicChallenge = JSON.parse(
      fs.readFileSync(publicChallengePath, "utf-8")
    );
    const serverData = JSON.parse(
      fs.readFileSync(serverChallengePath, "utf-8")
    );

    const index = new TfIdfIndex();
    for (const ev of publicData.evidence) {
      index.addDocument({
        id: ev.id,
        tokens: tokenise(ev.body),
      });
    }

    // 1. Alias pair test: Tomas Herrera vs Quill
    // From server.json: person Tomas Herrera has alias "Quill"
    const aliasPerson = serverData.people.find(
      (p: { alias: string | null }) => p.alias === "Quill"
    );
    expect(aliasPerson).toBeDefined();
    const aliasName: string = aliasPerson.name; // "Tomas Herrera"
    const aliasCallsign: string = aliasPerson.alias; // "Quill"

    // Search for "Quill"
    const quillResults = index.search(aliasCallsign);
    // Quill appears in File 01 (Intercepted Transcript)
    const quillDocIds = quillResults.map((r) => r.docId);
    expect(quillDocIds).toContain("01");
    // Tomas Herrera appears in File 02 (Shift Manifest) and 04 (Photo Log), but NOT "Quill"
    // Search for "Quill" MUST NOT expand to Tomas Herrera and return File 02 or 04 if they do not contain "Quill"
    for (const match of quillResults) {
      const doc = publicData.evidence.find((e) => e.id === match.docId);
      expect(doc?.body.toLowerCase()).toContain("quill");
    }

    // Conversely, search for "Herrera"
    const herreraResults = index.search(aliasName);
    for (const match of herreraResults) {
      const doc = publicData.evidence.find((e) => e.id === match.docId);
      expect(doc?.body.toLowerCase()).toContain("herrera");
    }
    // File 01 does NOT contain "Herrera", so searching "Herrera" must not return File 01
    expect(herreraResults.map((r) => r.docId)).not.toContain("01");

    // 2. Synonym pair test: "red" vs "scarlet"
    // In public.json:
    // File 01 mentions "red-wax batch"
    // File 03 mentions "scarlet seal"
    const scarletResults = index.search("scarlet");
    expect(scarletResults.length).toBeGreaterThan(0);
    // File 03 has "scarlet", File 01 does not
    expect(scarletResults.map((r) => r.docId)).toContain("03");
    expect(scarletResults.map((r) => r.docId)).not.toContain("01");

    const redResults = index.search("red");
    expect(redResults.length).toBeGreaterThan(0);
    // File 01 has "red", but searching "red" MUST NOT expand to "scarlet"
    expect(redResults.map((r) => r.docId)).toContain("01");
    for (const match of redResults) {
      const doc = publicData.evidence.find((e) => e.id === match.docId);
      expect(doc?.body.toLowerCase()).toMatch(/\bred\b/);
    }
  });
});
