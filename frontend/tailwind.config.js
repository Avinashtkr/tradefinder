/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'flash-up':   'flashUp 0.6s ease-out',
        'flash-down': 'flashDown 0.6s ease-out',
      },
      keyframes: {
        flashUp:   { '0%': { backgroundColor: 'rgba(34,197,94,0.25)' }, '100%': { backgroundColor: 'transparent' } },
        flashDown: { '0%': { backgroundColor: 'rgba(239,68,68,0.25)'  }, '100%': { backgroundColor: 'transparent' } },
      },
    },
  },
  plugins: [],
}
