/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hid: {
          blue: '#00539B',
          dark: '#00264D',
          cyan: '#00B2FE',
          accent: '#00C853',
          danger: '#FF3B30',
          warning: '#FF9500',
          surface: '#0F172A',
          card: '#1E293B',
          border: '#334155'
        }
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 2s linear infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      }
    },
  },
  plugins: [],
}
