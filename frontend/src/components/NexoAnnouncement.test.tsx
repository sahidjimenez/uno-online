import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NexoAnnouncement } from './NexoAnnouncement'
import { createLocalGame, localAction } from '../hooks/useOfflineGame'

let renderer: ReactTestRenderer
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { act(() => renderer?.unmount()); vi.useRealTimers() })
it('shows a bot announcement, keeps it through the next move, then clears it', () => {
  const game = createLocalGame({ playerId: 'me', roomId: 'room', roomCode: 'LOCAL', name: 'Me' })
  game.hands['bot-1'] = game.hands['bot-1'].slice(0, 1)
  const announced = localAction(game, 'bot-1', 'uno')
  const props = { event: announced.lastEvent, players: announced.players, myPlayerId: 'me' }
  act(() => { renderer = create(createElement(NexoAnnouncement, props)) })
  expect(renderer.root.findByType('strong').children.join('')).toBe('Lucía: ¡NEXO!')
  act(() => renderer.update(createElement(NexoAnnouncement, {
    ...props, event: { ...announced.lastEvent!, id: 'next', type: 'card_drawn' },
  })))
  expect(JSON.stringify(renderer.toJSON())).toContain('Me queda una carta')
  act(() => { vi.advanceTimersByTime(3500) })
  expect(renderer.toJSON()).toBeNull()
})
it('does not announce a player who has more than one card or repeat the human notice', () => {
  const game = createLocalGame({ playerId: 'me', roomId: 'room', roomCode: 'LOCAL', name: 'Me' })
  const rejected = localAction(game, 'bot-1', 'uno')
  act(() => { renderer = create(createElement(NexoAnnouncement, { event: rejected.lastEvent, players: game.players, myPlayerId: 'me' })) })
  expect(renderer.toJSON()).toBeNull()
  game.hands.me = game.hands.me.slice(0, 1)
  const human = localAction(game, 'me', 'uno')
  act(() => renderer.update(createElement(NexoAnnouncement, { event: human.lastEvent, players: human.players, myPlayerId: 'me' })))
  expect(renderer.toJSON()).toBeNull()
})
