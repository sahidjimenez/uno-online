import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeck } from './deck'
import { canPlay } from './rules'
import { createLesson, readTutorialProgress, tutorialAction, tutorialSession } from './tutorial'

afterEach(() => { vi.unstubAllGlobals() })
describe('guided lessons', () => {
  it.each([[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [4, 0], [4, 1], [4, 2], [4, 3], [5, 0], [6, 0]])('preserves the full deck in level %i phase %i', (level, phase) => {
    const { game } = createLesson(level, phase)
    const cards = [...game.deck, ...game.discard, ...Object.values(game.hands).flat().map(c => ({ color: c.card_color, type: c.card_type }))]
    const key = (card: { color: string; type: string }) => `${card.color}:${card.type}`
    expect(cards.map(key).sort()).toEqual(createDeck().map(key).sort())
  })
  it.each([0, 1])('completes level %i only after the matching card is played', level => {
    const state = createLesson(level)
    const hand = state.game.hands[tutorialSession.playerId]
    expect(hand.filter(card => canPlay(card, state.game.gameState))).toHaveLength(1)
    expect(tutorialAction(state, 'play', hand[1].id)).toBe(state)
    expect(tutorialAction(state, 'draw')).toBe(state)
    const next = tutorialAction(state, 'play', hand[0].id)
    expect(next.step).toBe('complete')
    expect(next.game.hands[tutorialSession.playerId]).toHaveLength(2)
    expect(next.game.gameState.current_color).toBe(level === 0 ? 'red' : 'blue')
    expect(tutorialAction(next, 'draw')).toBe(next)
  })
  it('teaches drawing then playing a matching card in the same turn', () => {
    const state = createLesson(2)
    expect(state.game.hands.student.some(card => canPlay(card, state.game.gameState))).toBe(false)
    expect(tutorialAction(state, 'play', '0-0')).toBe(state)
    const drawn = tutorialAction(state, 'draw')
    expect(drawn.step).toBe('drawn')
    expect(drawn.game.gameState.current_player_id).toBe('student')
    expect(drawn.game.hands.student).toHaveLength(4)
    expect(tutorialAction(drawn, 'draw')).toBe(drawn)
    const last = drawn.game.hands.student[3]
    expect(last).toMatchObject({ card_color: 'yellow', card_type: '4' })
    expect(tutorialAction(drawn, 'play', last.id).step).toBe('complete')
  })
  it.each(['bad', '-1', '8', '1.5'])('ignores corrupt progress %s', value => {
    vi.stubGlobal('localStorage', { getItem: () => value })
    expect(readTutorialProgress()).toBe(0)
  })
  it('preserves progress from the original three levels', () => {
    vi.stubGlobal('localStorage', { getItem: () => '3' })
    expect(readTutorialProgress()).toBe(3)
  })
  it.each([0, 1])('teaches the two-player effect of special card phase %i', phase => {
    const state = createLesson(3, phase)
    const next = tutorialAction(state, 'play', '0-0')
    expect(next.step).toBe('explained')
    expect(next.game.gameState.current_player_id).toBe('student')
    expect(next.game.gameState.direction).toBe(phase === 0 ? 1 : -1)
    expect(tutorialAction(next, 'play', '0-1')).toBe(next)
  })
  it('requires choosing the instructed color for a wild card', () => {
    const state = createLesson(3, 2)
    expect(tutorialAction(state, 'play', '0-0')).toBe(state)
    expect(tutorialAction(state, 'play', '0-0', 'red')).toBe(state)
    const next = tutorialAction(state, 'play', '0-0', 'blue')
    expect(next.step).toBe('complete')
    expect(next.game.gameState.current_color).toBe('blue')
  })
  it.each([[0, 4], [1, 6], [2, 6]])('handles attack phase %i with %i accumulated cards', (phase, stack) => {
    const state = createLesson(4, phase)
    const next = tutorialAction(state, 'play', '0-0', phase === 1 ? 'blue' : undefined)
    expect(next.step).toBe('explained')
    expect(next.game.gameState.draw_stack).toBe(stack)
    expect(next.game.gameState.current_player_id).toBe('bot-1')
    expect(next.game.gameState.direction).toBe(phase === 2 ? -1 : 1)
  })
  it('resolves the whole attack by drawing and passing the turn', () => {
    const state = createLesson(4, 3)
    expect(tutorialAction(state, 'play', '0-0')).toBe(state)
    const next = tutorialAction(state, 'draw')
    expect(next.game.hands.student).toHaveLength(7)
    expect(next.game.gameState.draw_stack).toBe(0)
    expect(next.game.gameState.current_player_id).toBe('bot-1')
    expect(next.step).toBe('complete')
  })
  it('requires the last-card announcement before the numeric winning move', () => {
    const state = createLesson(5)
    expect(tutorialAction(state, 'uno')).toBe(state)
    expect(tutorialAction(state, 'play', '0-1')).toBe(state)
    const last = tutorialAction(state, 'play', '0-0')
    expect(last.step).toBe('announce')
    expect(last.game.hands.student).toHaveLength(1)
    expect(tutorialAction(last, 'play', '0-1')).toBe(last)
    const announced = tutorialAction(last, 'uno')
    expect(announced.game.players[0].has_called_uno).toBe(true)
    const won = tutorialAction(announced, 'play', '0-1')
    expect(won.game.gameState.winner_id).toBe('student')
    expect(won.step).toBe('complete')
  })
  it('cannot complete the final challenge through a scripted lesson action', () => {
    const state = createLesson(6)
    expect(tutorialAction(state, 'play', '0-0')).toBe(state)
    expect(tutorialAction(state, 'draw')).toBe(state)
  })
  it('restores progress and works when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: () => '2' })
    expect(readTutorialProgress()).toBe(2)
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') } })
    expect(readTutorialProgress()).toBe(0)
  })
})
