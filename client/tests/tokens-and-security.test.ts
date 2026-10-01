import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

describe("Design Tokens & Asset Security (P2-08, P2-09, P2-10)", () => {
  const clientDir = path.resolve(__dirname, "..");
  const rootDir = path.resolve(clientDir, "..");
  const serverChallengePath = path.resolve(
    rootDir,
    "challenge/server.json"
  );

  it("P2-08: Fonts and assets load with NO external network requests", () => {
    const html = fs.readFileSync(path.resolve(clientDir, "index.html"), "utf-8");
    const css = fs.readFileSync(path.resolve(clientDir, "src/index.css"), "utf-8");

    // Must not link to external fonts (e.g. googleapis, cdnjs, etc.)
    expect(html).not.toMatch(/https?:\/\//i);
    expect(css).not.toMatch(/https?:\/\//i);

    // Self-hosted fonts via @fontsource must be imported
    expect(css).toContain('@import "@fontsource/bebas-neue/index.css";');
    expect(css).toContain('@import "@fontsource-variable/inter/index.css";');
    expect(css).toContain('@import "@fontsource/jetbrains-mono/index.css";');
  });

  it("P2-09: Token values match UX §24 and accessible red rules are honoured", () => {
    const css = fs.readFileSync(path.resolve(clientDir, "src/index.css"), "utf-8");

    // Check exact hex values from UX §24
    expect(css).toMatch(/--bg:\s*#0B0B0B/i);
    expect(css).toMatch(/--panel:\s*#141414/i);
    expect(css).toMatch(/--line:\s*#2A2A2A/i);
    expect(css).toMatch(/--paper:\s*#E8E2D6/i);
    expect(css).toMatch(/--ink:\s*#1A1A1A/i);
    expect(css).toMatch(/--muted:\s*#8A8578/i);
    expect(css).toMatch(/--red:\s*#B00020/i);
    expect(css).toMatch(/--red-bright:\s*#C1121F/i);
    expect(css).toMatch(/--red-text:\s*#FF4D5E/i);
    expect(css).toMatch(/--amber:\s*#D9A441/i);
    expect(css).toMatch(/--green:\s*#5FBF7F/i);

    // Rule: --red and --red-bright are never used for small text on --bg.
    // Inspect client src files for forbidden class usage (e.g. text-red (without text or bg) on small text elements)
    const srcFiles = [
      "src/views/EventGate.tsx",
      "src/views/TeamEntry.tsx",
      "src/views/Briefing.tsx",
      "src/components/timer/Timer.tsx",
      "src/App.tsx",
    ];

    for (const file of srcFiles) {
      const content = fs.readFileSync(path.resolve(clientDir, file), "utf-8");
      // "text-red " or "text-red-bright" on small text (text-xs or text-sm) is forbidden
      // small red text must use text-red-text
      const badPatterns = [
        /text-(?:xs|sm)[^"'>]*\btext-red\b(?!-text)/,
        /text-(?:xs|sm)[^"'>]*\btext-red-bright\b/,
      ];
      for (const pattern of badPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it("P2-10: Production build contains NO reference to server.json content", () => {
    // Run vite build for client
    execSync("npm run build -w client", {
      cwd: rootDir,
      stdio: "pipe",
    });

    const distDir = path.resolve(clientDir, "dist");
    expect(fs.existsSync(distDir)).toBe(true);

    const serverData = JSON.parse(
      fs.readFileSync(serverChallengePath, "utf-8")
    );

    const finalCode: string = serverData.solution.final_code;

    function scanTextFiles(dir: string): string[] {
      const files: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...scanTextFiles(full));
        } else if (/\.(js|mjs|cjs|css|html|map|json|txt)$/i.test(entry.name)) {
          files.push(full);
        }
      }
      return files;
    }

    const distFiles = scanTextFiles(distDir);
    expect(distFiles.length).toBeGreaterThan(0);

    for (const file of distFiles) {
      const content = fs.readFileSync(file, "utf-8");

      // Check final code
      expect(content).not.toContain(finalCode);

      // Check unused hint texts from server.json
      for (const hint of serverData.hints) {
        expect(content).not.toContain(hint.text);
      }

      // Check private keys and structures unique to server.json
      const privateKeys = [
        "target_date_rule",
        "alias_clue",
        "swaps",
        "assignments",
        "carries_key",
        "min_time_multiplier",
        "speed_bonus_points",
        "check_penalty_seconds",
      ];
      for (const key of privateKeys) {
        expect(content).not.toContain(key);
      }
    }
  });
});
