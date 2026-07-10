import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        surface2: "rgb(var(--surface-2) / <alpha-value>)",
        line: "rgb(var(--line-rgb) / var(--line-op))",
        hairline: "rgb(var(--line-rgb) / <alpha-value>)",
        copper: {
          DEFAULT: "#C97C4B",
          light: "#E39A6B",
          dark: "#A5602F",
        },
        gold: "#E8B86D",
        cream: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        "3xl": "1.75rem",
        "4xl": "2.25rem",
      },
      boxShadow: {
        glow: "0 0 60px -15px rgba(201,124,75,0.45)",
      },
      backgroundImage: {
        "copper-gradient": "linear-gradient(135deg, #C97C4B 0%, #E8B86D 100%)",
        "ink-radial": "radial-gradient(120% 120% at 50% 0%, rgb(var(--surface-2)) 0%, rgb(var(--bg)) 60%)",
      },
      keyframes: {
        "pulse-slow": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "pulse-slow": "pulse-slow 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
