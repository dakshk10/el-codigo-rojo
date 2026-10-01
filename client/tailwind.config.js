/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        line: "var(--line)",
        paper: "var(--paper)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        red: {
          DEFAULT: "var(--red)",
          bright: "var(--red-bright)",
          text: "var(--red-text)",
        },
        amber: "var(--amber)",
        green: "var(--green)",
      },
      fontFamily: {
        display: ['"Bebas Neue"', '"Arial Narrow"', "Impact", "sans-serif"],
        sans: [
          '"Inter Variable"',
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace",
          "Consolas",
          "monospace",
        ],
      },
      keyframes: {
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        pulseCritical: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(1.02)" },
        },
      },
      animation: {
        "pulse-subtle": "pulseSubtle 1s ease-in-out infinite",
        "pulse-critical": "pulseCritical 0.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
