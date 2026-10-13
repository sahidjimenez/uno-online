import type { Player } from '../types'

/** Public counts cover ordinary draws, stacked penalties and missed UNO. */
export function detectCardDraws(previous: Player[] | null, current: Player[]) {
  if (!previous) return []
  const counts = new Map(previous.map(player => [player.id, player.hand_count]))
  return current.flatMap(player => {
    const before = counts.get(player.id)
    const count = (player.hand_count ?? 0) - (before ?? 0)
    return before !== undefined && Number.isInteger(count) && count > 0
      ? [{ playerId: player.id, name: player.name, count }] : []
  })
}
