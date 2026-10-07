import type { Player } from '../types'

interface Props {
  player: Player
  cardCount: number
  isActive: boolean
  compact?: boolean
  direction?: 'h' | 'v'
  onCatch?: () => void
}
const AVATARS = ['🧑🏽', '👩🏻', '🧔🏽', '👩🏽', '🧑🏻', '👨🏾', '👩🏼', '🧑🏾']
export function OpponentPanel({ player, cardCount, isActive, compact, onCatch }: Props) {
  return (
    <div className={`seat-badge ${isActive ? 'seat-active' : ''} ${compact ? 'seat-compact' : ''} ${!player.is_connected ? 'seat-offline' : ''}`}>
      <div className="seat-avatar" aria-hidden="true">{AVATARS[player.seat_order % AVATARS.length]}</div>
      <div className="seat-info"><strong>{player.name}</strong><span>▱ {cardCount} cartas{!player.is_connected && ' · sin conexión'}</span></div>
      {player.has_called_uno && <span className="seat-uno">¡ÚLTIMA!</span>}
      {onCatch && cardCount === 1 && !player.has_called_uno && <button onClick={onCatch} className="catch-uno" aria-label={`Acusar a ${player.name} por no avisar de su última carta`}>¡¡ÚLTIMA!</button>}
    </div>
  )
}
