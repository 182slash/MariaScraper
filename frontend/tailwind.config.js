/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        neon: {
          cyan:   '#00FFE5',
          violet: '#BF5FFF',
          pink:   '#FF2D78',
          amber:  '#FFB800',
          green:  '#00FF94',
        },
        base: {
          950: '#030712',
          900: '#080F1E',
          800: '#0D1729',
          700: '#111F35',
          600: '#1A2C45',
        },
        glass: {
          white:  'rgba(255,255,255,0.04)',
          border: 'rgba(255,255,255,0.08)',
          hover:  'rgba(255,255,255,0.07)',
        },
      },
      fontFamily: {
        mono:    ['"Space Mono"', 'monospace'],
        sans:    ['"Outfit"', 'sans-serif'],
        display: ['"Outfit"', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan':   '0 0 20px rgba(0,255,229,0.25), 0 0 60px rgba(0,255,229,0.08)',
        'neon-violet': '0 0 20px rgba(191,95,255,0.25), 0 0 60px rgba(191,95,255,0.08)',
        'neon-pink':   '0 0 20px rgba(255,45,120,0.25)',
        'glow-sm':     '0 0 12px rgba(0,255,229,0.15)',
        'card':        '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(0,255,229,0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(0,255,229,0.03) 1px, transparent 1px)`,
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
  },
  plugins: [],
}