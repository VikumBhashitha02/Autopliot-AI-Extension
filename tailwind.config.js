/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-main)',
        sidebar: 'var(--bg-sidebar)',
        card: 'var(--bg-card)',
        cardHover: 'var(--bg-card-hover)',
        border: 'var(--border-color)',
        accent: {
          blue: '#3b82f6',
          cyan: '#06b6d4',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
          purple: '#8b5cf6',
        }
      },
      boxShadow: {
        'glow-blue': '0 0 20px -5px rgba(59, 130, 246, 0.4)',
        'glow-emerald': '0 0 20px -5px rgba(16, 185, 129, 0.4)',
      }
    },
  },
  plugins: [],
}
