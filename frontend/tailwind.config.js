/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0a0e1a', surface: '#111827', surface2: '#1f2937' },
        accent: { green: '#00ff88', red: '#ff3b3b', blue: '#00bfff', amber: '#ffb020' },
        border: { subtle: 'rgba(255,255,255,0.08)', strong: 'rgba(255,255,255,0.18)' },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        pulse: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-red': 'pulseRed 1.2s ease-in-out infinite',
      },
      keyframes: {
        pulseRed: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,59,59,0.6)' },
          '50%': { boxShadow: '0 0 0 10px rgba(255,59,59,0)' },
        },
      },
    },
  },
  plugins: [],
};
