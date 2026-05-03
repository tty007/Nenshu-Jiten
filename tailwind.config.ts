import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2563EB",
          50: "#EFF6FF",
          100: "#DBEAFE",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
        },
        positive: {
          DEFAULT: "#059669",
          50: "#ECFDF5",
          600: "#047857",
        },
        negative: {
          DEFAULT: "#DC2626",
          50: "#FEF2F2",
          600: "#B91C1C",
        },
        ink: {
          DEFAULT: "#111827",
          muted: "#6B7280",
          subtle: "#9CA3AF",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#FAFAFA",
          border: "#E5E7EB",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-noto-sans-jp)",
          "system-ui",
          "sans-serif",
        ],
        numeric: [
          "var(--font-inter)",
          "system-ui",
          "sans-serif",
        ],
      },
      fontFeatureSettings: {
        numeric: '"tnum"',
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        marquee: "marquee 80s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
