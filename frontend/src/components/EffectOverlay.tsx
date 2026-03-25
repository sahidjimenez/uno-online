import type { CardColor } from '../types'

interface Props {
  type:        'skip' | 'reverse' | 'draw_stack' | 'reverse_counter'
  byPlayer?:   string
  stack?:      number
  color?:      CardColor
  canCounter?: boolean
  onCounter?:  () => void
  onDraw?:     () => void
  onContinue?: () => void
}

const COLOR_BG: Record<CardColor, string> = {
  red:    'bg-uno-red',
  blue:   'bg-uno-blue',
  green:  'bg-uno-green',
  yellow: 'bg-uno-yellow',
  wild:   'bg-purple-600',
}
const COLOR_TEXT: Record<CardColor, string> = {
  red:    'text-uno-red',
  blue:   'text-uno-blue',
  green:  'text-uno-green',
  yellow: 'text-uno-yellow',
  wild:   'text-purple-400',
}

export function EffectOverlay({ type, byPlayer, stack, color, canCounter, onCounter, onDraw, onContinue }: Props) {
  return (
    <div className="fixed inset-0 bg-black/55 flex flex-col items-center justify-center z-40 px-4 animate-fade-in">

      {/* Carta grande central */}
      <div className={`
        ${color ? COLOR_BG[color] : 'bg-surface'}
        w-28 h-40 rounded-2xl flex items-center justify-center mb-4 animate-bounce-in
        shadow-[0_10px_40px_rgba(0,0,0,0.5)]
      `}>
        <span className="text-white text-5xl font-black">
          {type === 'skip'            && '⊘'}
          {type === 'reverse'         && '⇄'}
          {type === 'draw_stack'      && `+${stack}`}
          {type === 'reverse_counter' && '⇄'}
        </span>
      </div>

      {/* Banner */}
      <div className="bg-surface rounded-2xl px-5 py-4 w-full max-w-xs text-center mb-3 animate-slide-up">
        {type === 'skip' && (
          <>
            <p className="text-white text-lg font-bold">¡Turno saltado!</p>
            {byPlayer && <p className="text-gray text-sm mt-1">{byPlayer} pierde su turno</p>}
          </>
        )}
        {type === 'reverse' && (
          <>
            <p className="text-white text-lg font-bold">¡Dirección invertida!</p>
            {byPlayer && <p className="text-gray text-sm mt-1">{byPlayer} invirtió el juego</p>}
          </>
        )}
        {type === 'draw_stack' && (
          <>
            <p className="text-white text-lg font-bold">¿Qué haces con el +{stack}?</p>
            {color && (
              <p className="text-gray text-sm mt-1">
                Último color: <span className={`font-bold ${COLOR_TEXT[color]}`}>{color.toUpperCase()}</span>
              </p>
            )}
            {canCounter && (
              <p className="text-gray text-xs mt-1">Tienes una Reversa del mismo color</p>
            )}
          </>
        )}
        {type === 'reverse_counter' && (
          <>
            <p className="text-white text-lg font-bold">¡Contraataque con Reversa!</p>
            {byPlayer && (
              <p className="text-gray text-sm mt-1">La penalidad vuelve a {byPlayer}</p>
            )}
          </>
        )}
      </div>

      {/* Acciones */}
      {(type === 'skip' || type === 'reverse' || type === 'reverse_counter') && (
        <button onClick={onContinue} className="bg-surface text-white font-bold px-8 py-3 rounded-xl hover:bg-surface2 transition-colors">
          Continuar →
        </button>
      )}

      {type === 'draw_stack' && (
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {canCounter && (
            <button
              onClick={onCounter}
              className={`${color ? COLOR_BG[color] : 'bg-uno-red'} text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:brightness-110 transition-all`}
            >
              <span className="text-lg">⇄</span>
              Contraatacar con Reversa {color?.toUpperCase()}
            </button>
          )}
          <button
            onClick={onDraw}
            className="bg-surface text-gray font-bold py-3 rounded-xl hover:text-white transition-colors border border-border"
          >
            Robar {stack} cartas
          </button>
        </div>
      )}
    </div>
  )
}
