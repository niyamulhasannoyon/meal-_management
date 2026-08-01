import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card-bg)",
          foreground: "var(--card-fg)",
        },
        border: "var(--border-color)",
        brand: {
          50: "#fdf8f6",
          100: "#f2e8e5",
          200: "#e6d1cb",
          300: "#d3b2a8",
          400: "#c28d7e",
          500: "#dc5638",
          600: "#c74528",
          700: "#a5351c",
          800: "#862c19",
          900: "#6e2919",
          DEFAULT: "#dc5638",
        },
        amberAccent: {
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        surplus: {
          DEFAULT: "#10b981",
          light: "#ecfdf5",
          dark: "#047857",
        },
        due: {
          DEFAULT: "#ef4444",
          light: "#fef2f2",
          dark: "#b91c1c",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        card: "0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 1px 4px -1px rgba(0, 0, 0, 0.03)",
        "card-hover": "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};
export default config;

