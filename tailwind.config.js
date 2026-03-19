/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        'ck-deepest': '#0a0a0f',
        'ck-panel': '#111118',
        'ck-card': '#1a1a24',
        'ck-elevated': '#222230',
        'hook': '#ff6b6b',
        'body-color': '#6b8aff',
        'product-color': '#f0a030',
        'cta-color': '#4ecdc4',
        'winner': '#22c55e',
        'iterate': '#3b82f6',
        'rework': '#eab308',
        'kill': '#ef4444',
        'accent': '#7c3aed',
      },
      keyframes: {
        slideIn: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        subtleGlow: {
          from: { boxShadow: '0 0 0 0 rgba(124, 58, 237, 0)' },
          to: { boxShadow: '0 0 8px 0 rgba(124, 58, 237, 0.15)' },
        },
      },
    },
  },
  plugins: [],
}
