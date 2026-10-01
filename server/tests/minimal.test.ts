import { describe, it, expect } from "vitest";

describe("env check", () => {
  it("NODE_ENV is test", () => {
    console.log("NODE_ENV:", process.env["NODE_ENV"]);
    expect(process.env["NODE_ENV"]).toBe("test");
  });
});
