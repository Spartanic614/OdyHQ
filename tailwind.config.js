/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Mirrors src/theme.ts — graphite / steel / silver. Opaque steps are
        // kept opaque (sticky table headers, solid fills); glass translucency
        // lives in index.css (.card / .glass / .glass-nav).
        ink: {
          900: '#0a0c0f', // near-black graphite (base)
          800: '#13161b', // panel / sticky header
          700: '#1b1f26', // raised
          600: '#2a2f38', // border / elevated
          500: '#3c434e', // steel line
        },
        accent: {
          DEFAULT: '#c2cad4', // polished silver
          soft: '#2b313a',
        },
        good: '#34d399',
        bad: '#fb7185',
        warn: '#fbbf24',
        muted: '#959dab', // steel gray
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
