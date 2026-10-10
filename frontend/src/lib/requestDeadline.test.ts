import { describe, it, expect, vi, afterEach } from 'vitest'
import { requestDeadline } from './requestDeadline'
afterEach(() => { vi.useRealTimers() })
describe('request recovery', () => {
  it('aborts a stalled request and rejects even when the transport ignores abort', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const request = requestDeadline(s => { signal = s; return new Promise(() => {}) }, 100)
    const check = expect(request).rejects.toThrow('La conexión tardó demasiado')
    await vi.advanceTimersByTimeAsync(100)
    await check
    expect(signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('clears its deadline on success and does not retry failed writes', async () => {
    vi.useFakeTimers()
    expect(await requestDeadline(async () => 'ok')).toBe('ok')
    const failure = vi.fn(async () => { throw new Error('offline') })
    await expect(requestDeadline(failure)).rejects.toThrow('offline')
    expect(failure).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})
