import { describe, expect, it } from 'vitest'
import { detectCardDraws } from './cardDraws'
import { createLocalGame, localAction } from '../hooks/useOfflineGame'

const session = { playerId: 'me', roomId: 'room', roomCode: 'LOCAL', name: 'Test' }
describe('visible card draws', () => {
  it.each([1, 2, 4, 12])('reports the actual %i cards received', count => {
    const game = createLocalGame(session)
    game.gameState.draw_stack = count === 1 ? 0 : count
    const next = localAction(game, 'me', 'draw')
    expect(detectCardDraws(game.players, next.players)).toEqual([{ playerId: 'me', name: 'Test', count }])
    expect(detectCardDraws(next.players, next.players)).toEqual([])
  })
  it('ignores initial hands, newcomers, missing counts and cards played', () => {
    const { players } = createLocalGame(session)
    expect(detectCardDraws(null, players)).toEqual([])
    expect(detectCardDraws([], players)).toEqual([])
    expect(detectCardDraws(players, players.map(p => ({ ...p, hand_count: 6 })))).toEqual([])
    expect(detectCardDraws(players.map(p => ({ ...p, hand_count: undefined })), players)).toEqual([])
  })
  it('reports simultaneous recipients independently, regardless of roster order', () => {
    const { players } = createLocalGame(session)
    const next = players.map((p, i) => ({ ...p, hand_count: p.hand_count! + (i === 0 ? 2 : i === 1 ? 4 : 0) })).reverse()
    expect(detectCardDraws(players, next)).toEqual([
      { playerId: 'bot-1', name: 'Lucía', count: 4 }, { playerId: 'me', name: 'Test', count: 2 },
    ])
  })
})
