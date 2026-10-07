import type { CSSProperties } from 'react'
import type { CardColor } from '../types'
interface Props {
  type: 'skip' | 'reverse' | 'draw_stack' | 'draw_resolved'
  byPlayer?: string
  color?: CardColor
  stack?: number
}
export function EffectOverlay({ type, byPlayer, color, stack = 0 }: Props) {
  const title = type === 'reverse' ? '¡Cambio de rumbo!' : type === 'draw_stack' ? '¡La presión aumenta!' : type === 'draw_resolved' ? '¡A robar cartas!' : '¡Turno saltado!'
  return <div className={`table-effect effect-${type}`} role="status">
    <div className="effect-symbol" style={{ '--effect-color': color ? `var(--card-${color})` : '#a9e6d6' } as CSSProperties}>
      {type === 'reverse' ? '⇄' : type === 'skip' ? '⊘' : `+${stack}`}
      {(type === 'draw_stack' || type === 'draw_resolved') && <div className="effect-mini-cards" aria-hidden="true"><i /><i /><i /></div>}
    </div>
    <div className="effect-caption"><strong>{title}</strong><span>{type === 'reverse' ? 'El juego cambia de dirección' : type === 'draw_stack' ? `${stack} cartas acumuladas · apila o roba` : type === 'draw_resolved' ? `${stack} cartas de penalización` : 'El siguiente jugador pierde su turno'}{byPlayer && ` · ${byPlayer}`}</span></div>
  </div>
}
