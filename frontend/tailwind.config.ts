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
        'card-play':   'cardPlay 0.35s ease-out',
        'card-draw':   'cardDraw 0.25s ease-out',
        'stack-pulse': 'stackPulse 0.6s ease-in-out',
        'bounce-in':   'bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      },
      keyframes: {
        cardPlay: {
          '0%':   { transform: 'translateY(0) scale(1)' },
          '50%':  { transform: 'translateY(-40px) scale(1.15)' },
          '100%': { transform: 'translateY(0) scale(1)' },
        },
        cardDraw: {
          '0%':   { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
        stackPulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.12)' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.5)', opacity: '0' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
