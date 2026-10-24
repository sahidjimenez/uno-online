import { describe, expect, it } from 'vitest'
import { createLocalGame, localAction } from './useOfflineGame'
import type { Card } from '../types'
const session = { playerId: 'me', roomId: 'room', roomCode: 'LOCAL', name: 'Me', playerCount: 2 }
const card = (id: string, type: Card['card_type']): Card => ({ id, player_id: 'me', room_id: 'room', card_color: 'red', card_type: type })
function oneCard() {
  const game = createLocalGame(session)
  game.gameState.current_color = 'red'
  game.hands.me = [card('skip', 'skip'), card('last', '8')]
  return localAction(game, 'me', 'play', 'skip', undefined, undefined, 10000)
}
describe('NEXO server-time grace semantics in the local adapter', () => {
  it.each([0, 250, 1000])('permits announcement after %i ms latency, even when a skip returns the same turn', latency => {
    const game = oneCard()
    expect(game.gameState.current_player_id).toBe('me')
    expect(localAction(game, 'bot-1', 'catch', undefined, undefined, 'me', 10000 + latency)).toBe(game)
    expect(localAction(game, 'me', 'play', 'last', undefined, undefined, 10000 + latency)).toBe(game)
    const announced = localAction(game, 'me', 'uno', undefined, undefined, undefined, 10000 + latency)
    expect(announced.players[0].has_called_uno).toBe(true)
    expect(localAction(announced, 'me', 'play', 'last', undefined, undefined, 10001 + latency).gameState.winner_id).toBe('me')
  })
  it('expired omission cannot win and a repeated accusation does not add more cards', () => {
    const game = oneCard()
    const caught = localAction(game, 'bot-1', 'catch', undefined, undefined, 'me', 15001)
    expect(caught.hands.me).toHaveLength(5)
    expect(localAction(caught, 'bot-1', 'catch', undefined, undefined, 'me', 15002)).toBe(caught)
    const attemptedWin = localAction(game, 'me', 'play', 'last', undefined, undefined, 15001)
    expect(attemptedWin.gameState.winner_id).toBeNull()
    expect(attemptedWin.hands.me).toHaveLength(4)
  })
})
