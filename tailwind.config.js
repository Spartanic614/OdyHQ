/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Mirrors src/theme.ts — swap brand here + there in one place.
        ink: {
          900: '#0b0f17',
          800: '#111726',
          700: '#1a2133',
          600: '#252e44',
          500: '#33405c',
        },
        accent: {
          DEFAULT: '#3b82f6',
          soft: '#1e3a8a',
        },
        good: '#22c55e',
        bad: '#ef4444',
        warn: '#f59e0b',
        muted: '#8b94a7',
      },
    },
  },
  plugins: [],
}
