import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        encre: "#15182A",
        indigo: {
          DEFAULT: "#33409B",
          clair: "#E9EBF7",
        },
        papier: "#FAF8F4",
        panneau: "#F1F0EA",
        trait: "#DEDBD3",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
