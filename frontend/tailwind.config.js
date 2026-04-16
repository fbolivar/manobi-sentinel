/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* PNN Corporate palette */
        pnn: {
          green: '#85B425',
          'green-dark': '#5B8021',
          'green-light': '#A3D633',
          blue: '#004880',
          'blue-light': '#0069B4',
          forest: '#333A17',
        },
        /* App surfaces — light theme */
        bg: { DEFAULT: '#F4F6F9', surface: '#FFFFFF', surface2: '#EDF0F5' },
        /* Accents */
        accent: {
          green: '#01A551',
          red: '#E53935',
          blue: '#0069B4',
          amber: '#F9A825',
        },
        /* Borders */
        border: { subtle: 'rgba(0,0,0,0.08)', strong: 'rgba(0,0,0,0.15)' },
        /* Text */
        txt: { DEFAULT: '#242424', muted: '#6B7280', light: '#9CA3AF' },
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(229,57,53,0.5)' },
          '50%': { boxShadow: '0 0 0 8px rgba(229,57,53,0)' },
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
};
