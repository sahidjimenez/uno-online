import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Design tokens del proyecto — fuente: figma.md
        bg:       '#0F1923',
        surface:  '#1C2A38',
        surface2: '#28384A',
        border:   '#334D63',
        uno: {
          red:    '#DC2626',
          blue:   '#2563EB',
          green:  '#16A34A',
          yellow: '#EAB308',
          wild:   '#1A1A1A',
        },
        table:    '#0D2E1E',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'card-play':    'cardPlay 0.35s ease-out',
        'card-draw':    'cardDraw 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        'stack-pulse':  'stackPulse 0.6s ease-in-out infinite',
        'bounce-in':    'bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        'fade-in':      'fadeIn 0.2s ease-out',
        'slide-up':     'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        'top-card-in':  'topCardIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      },
      keyframes: {
        cardPlay: {
          '0%':   { transform: 'translateY(0) scale(1)' },
          '50%':  { transform: 'translateY(-40px) scale(1.15)' },
          '100%': { transform: 'translateY(0) scale(1)' },
        },
        cardDraw: {
          '0%':   { transform: 'translateY(16px) scale(0.85)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)',       opacity: '1' },
        },
        stackPulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.12)' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.5)', opacity: '0' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        topCardIn: {
          '0%':   { transform: 'translateY(-20px) scale(0.9) rotate(-8deg)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1) rotate(0deg)',        opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
