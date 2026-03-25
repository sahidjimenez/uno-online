import type { CardColor } from '../types'

interface Props {
  type:      'skip' | 'reverse'
  byPlayer?: string
  color?:    CardColor
}

const COLOR_BG: Record<CardColor, string> = {
  red:    'bg-uno-red',
  blue:   'bg-uno-blue',
  green:  'bg-uno-green',
  yellow: 'bg-uno-yellow',
  wild:   'bg-purple-600',
}

// Overlay informativo de solo animación — se cierra automáticamente
export function EffectOverlay({ type, byPlayer, color }: Props) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-40 pointer-events-none">
      <div className="flex flex-col items-center gap-3 animate-bounce-in">

        {/* Icono grande */}
        <div className={`
          ${color ? COLOR_BG[color] : 'bg-surface2'}
          w-24 h-32 rounded-2xl flex items-center justify-center
          shadow-[0_10px_40px_rgba(0,0,0,0.6)]
        `}>
          <span className="text-white text-5xl font-black select-none">
            {type === 'skip'    && '⊘'}
            {type === 'reverse' && '⇄'}
          </span>
        </div>

        {/* Banner informativo */}
        <div className="bg-black/70 rounded-2xl px-5 py-3 text-center animate-slide-up">
          {type === 'skip' && (
            <p className="text-white text-base font-bold">
              {byPlayer ? `${byPlayer} pierde su turno` : '¡Turno saltado!'}
            </p>
          )}
          {type === 'reverse' && (
            <p className="text-white text-base font-bold">
              {byPlayer ? `${byPlayer} invirtió el juego` : '¡Dirección invertida!'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
