import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: { 950: "#0a0908", 900: "#13110f", 800: "#1c1916", 700: "#2a2622" },
        gilded: { 50: "#fbf5e3", 100: "#f3e3a8", 300: "#e6c46b", 400: "#d4a843", 500: "#b88a2a", 600: "#8a651d", 700: "#5c4314" },
      },
      fontFamily: {
        display: ["Cormorant Garamond", "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        gilded: "0 0 24px rgba(212, 168, 67, 0.25)",
        "gilded-lg": "0 0 60px rgba(212, 168, 67, 0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
