/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f1115',
        panel: '#171a21',
        surface: '#1e222b',
        line: '#2a2f3a',
        accent: '#ffb454',
        coral: '#ff6b6b',
        mint: '#5eead4',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'card-in': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.9)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'card-pass': {
          '0%': { transform: 'translateX(0) rotate(0deg)', opacity: '1' },
          '50%': { transform: 'translateX(20px) rotate(6deg)', opacity: '0.4' },
          '100%': { transform: 'translateX(40px) rotate(0deg)', opacity: '0' },
        },
        'bluff-flip': {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(180deg)' },
        },
        'pulse-ring': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,180,84,0.5)' },
          '50%': { boxShadow: '0 0 0 12px rgba(255,180,84,0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'card-in': 'card-in 0.3s ease-out both',
        'card-pass': 'card-pass 0.6s ease-in-out both',
        'bluff-flip': 'bluff-flip 0.5s ease-in-out both',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
        'fade-up': 'fade-up 0.3s ease-out both',
        float: 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};