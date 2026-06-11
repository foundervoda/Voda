/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.js", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cream: "#fdf9ea",
        navy: "#012a62",
        yellow: "#fdde59",
        "brand-light": "#fdf9ea",
        "brand-blue": "#012a62",
        "brand-accent": "#fdde59",
      },
    },
  },
  plugins: [],
};
