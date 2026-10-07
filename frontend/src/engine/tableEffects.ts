import type { GameState } from '../types'
export function detectTableEffect(previous: GameState, current: GameState) {
  if (previous.room_id !== current.room_id || current.version <= previous.version) return null
  if (previous.direction !== current.direction) return { type: 'reverse' as const, stack: current.draw_stack }
  if (current.draw_stack > previous.draw_stack) return { type: 'draw_stack' as const, stack: current.draw_stack }
  if (previous.draw_stack > 0 && current.draw_stack === 0) return { type: 'draw_resolved' as const, stack: previous.draw_stack }
  if (current.top_card_type === 'skip' && current.draw_pile_count === previous.draw_pile_count) return { type: 'skip' as const, stack: 0 }
  return null
}
