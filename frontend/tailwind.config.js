/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f4f5f7",
        ink: "#111214",
        muted: "#6b7280",
        subtle: "#9ca3af",
        panel: "#ffffff",
        line: "#e5e7eb",
        charcoal: "#242629",
      },
      maxWidth: {
        app: "40rem",
      },
      borderRadius: {
        control: "1rem",
        card: "1.5rem",
        media: "1.125rem",
      },
      boxShadow: {
        card: "0 14px 40px rgba(17, 18, 20, 0.07)",
        nav: "0 -12px 32px rgba(17, 18, 20, 0.08)",
      },
    },
  },
  plugins: [],
}
