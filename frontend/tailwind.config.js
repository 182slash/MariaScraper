/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        electric: {
          blue: '#00D4FF',
          dark: '#0F172A',
        },
      },
      fontFamily: {
        mono: ['"Space Mono"', 'monospace'],
        sans: ['"Outfit"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}