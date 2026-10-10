import { describe, expect, it } from 'vitest'
import { createLocalGame, localAction } from './useOfflineGame'
import { canPlay, canWinWith } from '../engine/rules'
import type { Card, LocalSession } from '../types'
const session: LocalSession = { playerId: 'me', roomId: 'local-room', roomCode: 'LOCAL', name: 'Prueba' }
function card(id: string, type: Card['card_type']): Card { return { id, card_type: type, card_color: 'red', player_id: 'me', room_id: session.roomId } }
describe('local game', () => {
  it('keeps the played card cue when an immediate last-card announcement follows', () => {
    const game = createLocalGame(session)
    game.gameState.current_color = 'red'
    game.hands.me = [card('seven', '7'), card('eight', '8')]
    const played = localAction(game, 'me', 'play', 'seven')
    expect(played.cardPlay?.player_id).toBe('me')
    expect(played.cardPlay?.payload.card).toEqual({ color: 'red', type: '7' })
    const announced = localAction(played, 'me', 'uno')
    expect(announced.lastEvent?.type).toBe('uno_called')
    expect(announced.cardPlay).toBe(played.cardPlay)
    expect(localAction(announced, 'me', 'play', 'missing').cardPlay).toBe(played.cardPlay)
  })
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
      if (game.hands[actor].length === 1) game = localAction(game, actor, 'uno')
    }
    expect(game.gameState.status).toBe('finished')
    expect(game.hands[game.gameState.winner_id!]).toHaveLength(0)
  })
})

describe('automatic last-card penalty', () => {
  function setup(type: Card['card_type'] = '7') {
    const game = createLocalGame(session)
    game.gameState.current_color = 'red'
    game.hands.me = [card('play', type), card('keep', '8')]
    game.hands['bot-1'] = [{ ...card('last', '9'), player_id: 'bot-1' }]
    return game
  }
  it('gives four cards exactly when the unannounced player receives their turn', () => {
    const game = setup()
    const before = game.deck.length
    const next = localAction(game, 'me', 'play', 'play')
    expect(next.gameState.current_player_id).toBe('bot-1')
    expect(next.hands['bot-1']).toHaveLength(5)
    expect(next.deck).toHaveLength(before - 4)
    expect(next.hands.me).toHaveLength(1)
    expect(next.unoPenalty?.payload).toMatchObject({ accused_id: 'bot-1', cards_given: 4, automatic: true })
    expect(game.hands['bot-1']).toHaveLength(1)
  })
  it('honors an announcement and ignores repeated button presses', () => {
    const announced = localAction(setup(), 'bot-1', 'uno')
    expect(localAction(announced, 'bot-1', 'uno')).toBe(announced)
    const next = localAction(announced, 'me', 'play', 'play')
    expect(next.hands['bot-1']).toHaveLength(1)
    expect(next.unoPenalty).toBeNull()
  })
  it('does not penalize a skipped player until their turn actually arrives', () => {
    const next = localAction(setup('skip'), 'me', 'play', 'play')
    expect(next.gameState.current_player_id).toBe('bot-2')
    expect(next.hands['bot-1']).toHaveLength(1)
    expect(next.unoPenalty).toBeNull()
  })
  it('follows reverse direction and preserves an active draw stack', () => {
    const game = setup('reverse')
    game.hands['bot-3'] = [{ ...card('other-last', '9'), player_id: 'bot-3' }]
    game.gameState.draw_stack = 2
    const next = localAction(game, 'me', 'play', 'play')
    expect(next.hands['bot-3']).toHaveLength(5)
    expect(next.gameState.draw_stack).toBe(2)
    expect(next.gameState.current_player_id).toBe('bot-3')
  })
  it('also applies when drawing passes the turn and never repeats on the same hand', () => {
    const game = setup()
    game.gameState.draw_stack = 2
    const next = localAction(game, 'me', 'draw')
    expect(next.hands['bot-1']).toHaveLength(5)
    const penaltyId = next.unoPenalty?.id
    const after = localAction(next, 'bot-1', 'draw')
    expect(after.unoPenalty?.id).toBe(penaltyId)
  })
  it('keeps the penalty event when a bot announces its own last card afterward', () => {
    const next = localAction(setup(), 'me', 'play', 'play')
    const announced = localAction(next, 'me', 'uno')
    expect(announced.unoPenalty).toBe(next.unoPenalty)
  })
  it('does not penalize again after another player has already caught the omission', () => {
    const caught = localAction(setup(), 'me', 'catch', undefined, undefined, 'bot-1')
    expect(caught.hands['bot-1']).toHaveLength(5)
    const next = localAction(caught, 'me', 'play', 'play')
    expect(next.hands['bot-1']).toHaveLength(5)
    expect(next.unoPenalty?.id).toBe(caught.unoPenalty?.id)
    expect(localAction(next, 'bot-1', 'uno')).toBe(next)
  })
  it('recycles the discard to give all four cards', () => {
    const game = setup()
    game.deck = []
    game.discard = Array.from({ length: 5 }, () => ({ color: 'blue' as const, type: '2' as const }))
    const next = localAction(game, 'me', 'play', 'play')
    expect(next.hands['bot-1']).toHaveLength(5)
    expect(next.discard).toEqual([{ color: 'red', type: '7' }])
  })
  it('gives the player a chance to announce after a two-player skip', () => {
    const game = createLocalGame({ ...session, playerCount: 2 })
    game.gameState.current_color = 'red'
    game.hands.me = [card('skip', 'skip'), card('last', '8')]
    const next = localAction(game, 'me', 'play', 'skip')
    expect(next.gameState.current_player_id).toBe('me')
    expect(next.hands.me).toHaveLength(1)
    expect(next.unoPenalty).toBeNull()
  })
})
