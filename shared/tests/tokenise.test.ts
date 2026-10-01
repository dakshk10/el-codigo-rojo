import { describe, it, expect } from "vitest";
import { tokenise } from "../src/nlp/tokenise.js";

describe("tokenise", () => {
  it("produces stable token ids (t0, t1, …) across runs", () => {
    const input = "Hello, world! 42";
    const t1 = tokenise(input);
    const t2 = tokenise(input);
    expect(t1.map((t) => t.id)).toEqual(t2.map((t) => t.id));
    expect(t1[0]?.id).toBe("t0");
    expect(t1[1]?.id).toBe("t1");
  });

  it("identifies number tokens", () => {
    const tokens = tokenise("Panel 38");
    const num = tokens.find((t) => t.kind === "number");
    expect(num?.text).toBe("38");
    expect(num?.kind).toBe("number");
  });

  it("identifies word tokens", () => {
    const tokens = tokenise("Tomas Herrera");
    const words = tokens.filter((t) => t.kind === "word");
    expect(words.map((w) => w.text)).toEqual(["Tomas", "Herrera"]);
  });

  it("tracks line numbers correctly", () => {
    const input = "line one\nline two";
    const tokens = tokenise(input);
    const lineOneWords = tokens.filter((t) => t.kind === "word" && t.line === 1);
    const lineTwoWords = tokens.filter((t) => t.kind === "word" && t.line === 2);
    expect(lineOneWords.length).toBeGreaterThanOrEqual(2);
    expect(lineTwoWords.length).toBeGreaterThanOrEqual(2);
  });

  it("start and end positions are correct", () => {
    const input = "Hello world";
    const tokens = tokenise(input);
    const hello = tokens.find((t) => t.text === "Hello");
    const world = tokens.find((t) => t.text === "world");
    expect(hello?.start).toBe(0);
    expect(hello?.end).toBe(5);
    expect(world?.start).toBe(6);
    expect(world?.end).toBe(11);
  });
});
