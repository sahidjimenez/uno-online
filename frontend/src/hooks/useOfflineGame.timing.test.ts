import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LAST_CARD_ANNOUNCEMENT_MS, useOfflineGame } from './useOfflineGame'
import { NexoAnnouncement } from '../components/NexoAnnouncement'

vi.mock('../engine/deck', () => ({
  createDeck: () => Array.from({ length: 40 }, () => ({ color: 'red', type: '7' })),
  shuffle: <T,>(cards: T[]) => cards,
}))

const session = { playerId: 'me', roomId: 'room', roomCode: 'LOCAL', name: 'Test', playerCount: 2 }
let game: ReturnType<typeof useOfflineGame>
let renderer: ReactTestRenderer
function Probe() {
  game = useOfflineGame(session)
  return createElement(NexoAnnouncement, { event: game.lastEvent, players: game.players, myPlayerId: session.playerId })
}

beforeEach(() => {
  vi.useFakeTimers()
  act(() => { renderer = create(createElement(Probe)) })
})
afterEach(() => {
  act(() => renderer.unmount())
  vi.useRealTimers()
})

function reachLastCard(speed: number) {
  act(() => game.changeBotSpeed(speed))
  for (let turn = 0; turn < 5; turn++) {
    act(() => game.localPlay(game.myHand[0]))
    act(() => { vi.advanceTimersByTime(2200) })
  }
  expect(game.myHand).toHaveLength(2)
  act(() => game.localPlay(game.myHand[0]))
  expect(game.myHand).toHaveLength(1)
}

describe('time to announce the last card against one bot', () => {
  it.each([0.5, 1, 2, 3])('shows the bot NEXO animation after its real timed turn at speed %s', speed => {
    reachLastCard(speed)
    expect(renderer.toJSON()).toBeNull()
    act(() => game.localUno())
    act(() => { vi.advanceTimersByTime(Math.ceil(1100 / speed)) })
    expect(game.players.find(p => p.id === 'bot-1')).toMatchObject({ hand_count: 1, has_called_uno: true })
    expect(renderer.root.findByProps({ role: 'status' }).props.className).toBe('nexo-announcement')
    expect(renderer.root.findByType('strong').children.join('')).toBe('Lucía: ¡NEXO!')
    expect(renderer.root.findByType('span').children.join('')).toBe('Me queda una carta')
    act(() => { vi.advanceTimersByTime(3500) })
    expect(renderer.toJSON()).toBeNull()
  })
  it.each([0.5, 1, 2, 3])('waits five seconds regardless of bot speed %s', speed => {
    reachLastCard(speed)
    act(() => { vi.advanceTimersByTime(LAST_CARD_ANNOUNCEMENT_MS - 1) })
    expect(game.myHand).toHaveLength(1)
    expect(game.unoPenalty).toBeNull()
    expect(game.isMyTurn).toBe(false)
    act(() => { vi.advanceTimersByTime(1) })
    expect(game.myHand).toHaveLength(5)
    expect(game.unoPenalty?.payload.cards_given).toBe(4)
  })

  it('resumes normal speed after announcing and avoids the penalty', () => {
    reachLastCard(3)
    act(() => { vi.advanceTimersByTime(4000) })
    act(() => game.localUno())
    act(() => { vi.advanceTimersByTime(367) })
    expect(game.isMyTurn).toBe(true)
    expect(game.myHand).toHaveLength(1)
    expect(game.unoPenalty).toBeNull()
    act(() => { vi.advanceTimersByTime(5000) })
    expect(game.myHand).toHaveLength(1)
  })

  it('preserves time to announce when the bot speed changes', () => {
    reachLastCard(1)
    act(() => { vi.advanceTimersByTime(1000) })
    act(() => game.changeBotSpeed(3))
    act(() => { vi.advanceTimersByTime(3999) })
    expect(game.myHand).toHaveLength(1)
    act(() => game.localUno())
    act(() => { vi.advanceTimersByTime(367) })
    expect(game.myHand).toHaveLength(1)
    expect(game.isMyTurn).toBe(true)
  })
})

