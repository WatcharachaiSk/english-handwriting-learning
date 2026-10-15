import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#FDFCF7",
          cream: "#FAF7EE",
          line: "#DCE6F2",
          edge: "#E7E1D3",
        },
        ink: {
          DEFAULT: "#1F2933",
          soft: "#52606D",
          faint: "#9AA5B1",
        },
        hint: {
          DEFAULT: "#3B82F6",
          soft: "#E8F1FE",
        },
        correct: {
          DEFAULT: "#16A34A",
          soft: "#E7F7EE",
        },
        warn: {
          DEFAULT: "#D97706",
          soft: "#FDF3E3",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(31,41,51,0.04), 0 8px 24px rgba(31,41,51,0.06)",
        toolbar: "0 6px 24px rgba(31,41,51,0.14)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.18s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
