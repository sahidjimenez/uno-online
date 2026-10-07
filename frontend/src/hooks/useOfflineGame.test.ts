import { describe, expect, it } from 'vitest'
import { createLocalGame, localAction } from './useOfflineGame'
import { canPlay, canWinWith } from '../engine/rules'
import type { Card, LocalSession } from '../types'
const session: LocalSession = { playerId: 'me', roomId: 'local-room', roomCode: 'LOCAL', name: 'Prueba' }
function card(id: string, type: Card['card_type']): Card { return { id, card_type: type, card_color: 'red', player_id: 'me', room_id: session.roomId } }
describe('local game', () => {
  it('deals a complete deck without a server', () => {
    const game = createLocalGame(session)
    expect(game.players).toHaveLength(4)
    expect(Object.values(game.hands).every(hand => hand.length === 7)).toBe(true)
    expect(game.deck.length + game.discard.length + 28).toBe(108)
  })
  it.each([2, 3, 4, 5, 6, 7, 8])('supports %i total players with seven cards each', playerCount => {
    const game = createLocalGame({ ...session, playerCount })
    expect(game.players).toHaveLength(playerCount)
    expect(Object.values(game.hands)).toHaveLength(playerCount)
    expect(game.deck.length + game.discard.length + playerCount * 7).toBe(108)
    expect(new Set(game.players.map(p => p.id)).size).toBe(playerCount)
  })
  it('resolves stacked draws and advances the turn', () => {
    const game = createLocalGame(session)
    game.gameState.draw_stack = 6
    const next = localAction(game, 'me', 'draw')
    expect(next.hands.me).toHaveLength(13)
    expect(next.gameState.draw_stack).toBe(0)
    expect(next.gameState.current_player_id).toBe('bot-1')
    expect(game.hands.me).toHaveLength(7)
  })
  it('allows only a number as the winning card', () => {
    const game = createLocalGame(session)
    game.gameState.current_color = 'red'
    game.hands.me = [card('reverse', 'reverse')]
    expect(localAction(game, 'me', 'play', 'reverse')).toBe(game)
    game.hands.me = [card('seven', '7')]
    expect(localAction(game, 'me', 'play', 'seven').gameState.winner_id).toBe('me')
  })
  it('recycles the discard pile while keeping its top card', () => {
    const game = createLocalGame(session)
    game.deck = []
    game.discard = [{ color: 'blue', type: '2' }, { color: 'red', type: '7' }]
    const next = localAction(game, 'me', 'draw')
    expect(next.hands.me).toHaveLength(8)
    expect(next.discard).toEqual([{ color: 'red', type: '7' }])
  })
  it.each([2, 4, 8])('can finish a full match with %i players', playerCount => {
    let game = createLocalGame({ ...session, playerCount })
    for (let turn = 0; turn < 10000 && !game.gameState.winner_id; turn++) {
      const actor = game.gameState.current_player_id!
      const hand = game.hands[actor]
      const playable = hand.find(c => canPlay(c, game.gameState) && (hand.length > 1 || canWinWith(c)))
      game = playable ? localAction(game, actor, 'play', playable.id, 'red') : localAction(game, actor, 'draw')
    }
    expect(game.gameState.status).toBe('finished')
    expect(game.hands[game.gameState.winner_id!]).toHaveLength(0)
  })
})
