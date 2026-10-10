import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useOnlineGame } from './useGame'

const remote = vi.hoisted(() => ({ version: 1, failHand: false, stall: false }))
vi.mock('../lib/supabase', () => ({ supabase: {
  from(table: string) {
    const query = {
      select() { return query }, eq() { return query }, order() { return query }, single() { return query }, abortSignal() { return query },
      then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
        if (remote.stall) return new Promise(() => {}).then(resolve, reject)
        const data = table === 'game_state' ? { room_id: 'room', version: remote.version, current_player_id: 'me' }
          : table === 'players' ? [{ id: 'me' }] : [{ id: `card-${remote.version}`, player_id: 'me' }]
        return Promise.resolve({ data, error: table === 'hands' && remote.failHand ? new Error('network') : null }).then(resolve, reject)
      },
    }
    return query
  },
  channel() { const channel = { on() { return channel }, subscribe() { return channel } }; return channel },
  removeChannel: vi.fn(),
  rpc() { return { abortSignal: async () => ({ error: null }) } },
} }))
let result: ReturnType<typeof useOnlineGame>
let renderer: ReactTestRenderer
const session = { roomId: 'room', playerId: 'me', name: 'Test', roomCode: 'ABCDEF' }
function Probe() { result = useOnlineGame(session); return null }
beforeEach(async () => {
  vi.useFakeTimers()
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }))
  vi.stubGlobal('navigator', { onLine: true })
  remote.version = 1; remote.failHand = false; remote.stall = false
  await act(async () => { renderer = create(createElement(Probe)) })
})
afterEach(() => { act(() => renderer.unmount()); vi.unstubAllGlobals(); vi.useRealTimers() })
describe('multiplayer recovery', () => {
  it('preserves a valid hand when fetching fails and recovers with a fresh snapshot', async () => {
    expect(result.myHand[0].id).toBe('card-1')
    remote.failHand = true; remote.version = 2
    await act(async () => { expect(await result.refreshGame()).toBe(false) })
    expect(result.myHand[0].id).toBe('card-1')
    expect(result.gameState?.version).toBe(1)
    expect(result.syncError).toBeTruthy()
    remote.failHand = false
    await act(async () => { await result.refreshGame() })
    expect(result.myHand[0].id).toBe('card-2')
    expect(result.syncError).toBeNull()
  })
  it('recovers when connectivity returns without remounting the game', async () => {
    Object.assign(navigator, { onLine: false })
    await act(async () => { await result.refreshGame() })
    expect(result.syncError).toContain('Sin conexión')
    Object.assign(navigator, { onLine: true }); remote.version = 3
    await act(async () => { window.dispatchEvent(new Event('online')) })
    expect(result.gameState?.version).toBe(3)
    expect(result.syncError).toBeNull()
  })
  it('releases a stalled request and polls again after the transport recovers', async () => {
    remote.stall = true
    await act(async () => { void result.refreshGame() })
    await act(async () => { await vi.advanceTimersByTimeAsync(12001) })
    expect(result.syncing).toBe(false)
    expect(result.syncError).toContain('tardó demasiado')
    remote.stall = false; remote.version = 4
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(result.gameState?.version).toBe(4)
    expect(result.syncError).toBeNull()
  })
})
