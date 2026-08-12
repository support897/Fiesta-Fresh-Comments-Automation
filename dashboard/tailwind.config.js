/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        fiesta: {
          green: "#22c55e",
          blue: "#3b82f6",
          orange: "#f97316",
          red: "#ef4444",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
