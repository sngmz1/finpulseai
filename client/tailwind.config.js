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
        background: '#07080b',
        surface: {
          50: '#1e2433',
          100: '#161a25',
          200: '#11141c',
          300: '#0c0e14',
        },
        accent: {
          cyan: '#00f2fe',
          blue: '#4facfe',
          purple: '#7f5af0',
          emerald: '#10b981',
          rose: '#f43f5e',
          amber: '#f59e0b',
        },
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'orb-glow': 'orbGlow 4s ease-in-out infinite alternate',
        'voice-pulse': 'voicePulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        orbGlow: {
          '0%': { transform: 'scale(0.98)', opacity: '0.7', filter: 'blur(20px)' },
          '100%': { transform: 'scale(1.05)', opacity: '1', filter: 'blur(28px)' },
        },
        voicePulse: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.4)' },
          '50%': { transform: 'scale(1.04)', boxShadow: '0 0 0 8px rgba(16, 185, 129, 0)' },
        },
      },
    },
  },
  plugins: [],
}
