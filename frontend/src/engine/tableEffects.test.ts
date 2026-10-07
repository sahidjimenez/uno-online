import { describe, expect, it } from 'vitest'
import { detectTableEffect } from './tableEffects'
import { createLocalGame } from '../hooks/useOfflineGame'
const state = createLocalGame({ playerId: 'me', roomId: 'room', roomCode: 'LOCAL', name: 'Test' }).gameState
describe('table effects', () => {
  it('animates a direction change, including a stack counter', () => {
    expect(detectTableEffect(state, { ...state, version: 1, direction: -1, draw_stack: 6 })).toEqual({ type: 'reverse', stack: 6 })
  })
  it('shows the accumulated total when another draw card is played', () => {
    expect(detectTableEffect({ ...state, draw_stack: 2 }, { ...state, version: 1, draw_stack: 6 })).toEqual({ type: 'draw_stack', stack: 6 })
  })
  it('shows the penalty total when the stack is drawn', () => {
    expect(detectTableEffect({ ...state, draw_stack: 6 }, { ...state, version: 1 })).toEqual({ type: 'draw_resolved', stack: 6 })
  })
  it('ignores stale states and different rooms', () => {
    expect(detectTableEffect(state, state)).toBeNull()
    expect(detectTableEffect(state, { ...state, version: 1, room_id: 'other', direction: -1 })).toBeNull()
  })
  it('does not show a skip animation on an ordinary draw', () => {
    expect(detectTableEffect({ ...state, top_card_type: 'skip' }, { ...state, version: 1, top_card_type: 'skip', draw_pile_count: state.draw_pile_count - 1 })).toBeNull()
  })
})
