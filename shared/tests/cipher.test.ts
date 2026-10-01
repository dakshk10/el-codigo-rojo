import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { shiftValue, buildCode } from "../src/cipher.js";
import type { ServerChallenge } from "../src/schemas/server.js";

const here = dirname(fileURLToPath(import.meta.url));
const srv = JSON.parse(
  readFileSync(resolve(here, "../../challenge/server.json"), "utf8"),
) as ServerChallenge;

describe("cipher", () => {
  it("shiftValue reproduces transformed_values from server.json", () => {
    const { extracted_values, transformed_values, shift } = srv.solution;
    const wrapModulus = srv.cipher.wrap_modulus;

    const door = shiftValue({ value: extracted_values.door, shift, wrapModulus });
    const witness = shiftValue({ value: extracted_values.witness, shift, wrapModulus });
    const metal = shiftValue({ value: extracted_values.metal, shift, wrapModulus });

    expect(door).toBe(transformed_values.door);
    expect(witness).toBe(transformed_values.witness);
    expect(metal).toBe(transformed_values.metal);
  });

  it("buildCode with correct ordering produces final_code from server.json", () => {
    const { extracted_values, transformed_values, shift } = srv.solution;
    const wrapModulus = srv.cipher.wrap_modulus;

    const values: Record<string, string> = {
      door: shiftValue({ value: extracted_values.door, shift, wrapModulus }),
      witness: shiftValue({ value: extracted_values.witness, shift, wrapModulus }),
      metal: shiftValue({ value: extracted_values.metal, shift, wrapModulus }),
    };

    const code = buildCode({ values, ordering: srv.ordering });
    expect(code).toBe(srv.solution.final_code);
  });

  it("wrap-around: digit 9 + shift of 3 → 2 (not 12)", () => {
    const result = shiftValue({ value: 9, shift: 3, wrapModulus: 10 });
    // 09 → (0+3)(9+3%10) = 32  ... 0→3, 9→2
    expect(result).toBe("32");
  });

  it("wrong ordering produces a different code", () => {
    const { extracted_values, shift } = srv.solution;
    const wrapModulus = srv.cipher.wrap_modulus;
    const values: Record<string, string> = {
      door: shiftValue({ value: extracted_values.door, shift, wrapModulus }),
      witness: shiftValue({ value: extracted_values.witness, shift, wrapModulus }),
      metal: shiftValue({ value: extracted_values.metal, shift, wrapModulus }),
    };
    const wrongOrder = buildCode({ values, ordering: ["door", "metal", "witness"] });
    expect(wrongOrder).not.toBe(srv.solution.final_code);
  });

  it("no wrap produces a different code", () => {
    const { extracted_values, shift } = srv.solution;
    // Shift without modulus
    const noWrap = srv.ordering
      .map((k) => {
        const ev = extracted_values[k as keyof typeof extracted_values];
        return String(ev).padStart(2, "0").split("").map((c) => String(Number(c) + shift)).join("");
      })
      .join("");
    expect(noWrap).not.toBe(srv.solution.final_code);
  });
});
