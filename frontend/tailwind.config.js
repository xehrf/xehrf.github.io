/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Noto Sans",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        canvas: "#0D1117",
        elevated: "#161B22",
        border: "#30363D",
        muted: "#8B949E",
        foreground: "#E6EDF3",
        accent: "#FFD700",
        "accent-hover": "#FFEA00",
      },
      boxShadow: {
        card: "0 1px 0 rgba(255, 255, 255, 0.04), 0 8px 24px rgba(0, 0, 0, 0.45)",
        glow: "0 0 0 1px rgba(255, 215, 0, 0.35), 0 0 24px rgba(255, 215, 0, 0.15)",
      },
      borderRadius: {
        btn: "8px",
        card: "10px",
      },
      transitionDuration: {
        DEFAULT: "180ms",
      },
    },
  },
  plugins: [],
};
