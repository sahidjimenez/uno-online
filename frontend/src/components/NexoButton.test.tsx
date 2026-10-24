import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NexoButton } from './NexoButton'

let renderer: ReactTestRenderer
afterEach(() => { act(() => renderer?.unmount()) })
describe('NEXO announcement feedback', () => {
  it('prevents duplicate submissions and waits for game confirmation', async () => {
    let resolve!: (value: boolean) => void
    const onAnnounce = vi.fn(() => new Promise<boolean>(done => { resolve = done }))
    act(() => { renderer = create(createElement(NexoButton, { announced: false, onAnnounce })) })
    let first!: Promise<void>
    act(() => {
      const click = renderer.root.findByType('button').props.onClick
      first = click()
      void click()
    })
    expect(onAnnounce).toHaveBeenCalledOnce()
    expect(renderer.root.findByType('button').props.disabled).toBe(true)
    await act(async () => { resolve(true); await first })
    expect(JSON.stringify(renderer.toJSON())).not.toContain('¡NEXO anunciado!')
    act(() => renderer.update(createElement(NexoButton, { announced: true, onAnnounce })))
    expect(JSON.stringify(renderer.toJSON())).toContain('¡NEXO anunciado!')
    expect(renderer.root.findByType('button').props.disabled).toBe(true)
  })
  it.each(['rejection', 'unconfirmed'])('keeps a retry available after %s', async failure => {
    const onAnnounce = failure === 'rejection'
      ? vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(true)
      : vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    act(() => { renderer = create(createElement(NexoButton, { announced: false, onAnnounce })) })
    await act(async () => { await renderer.root.findByType('button').props.onClick() })
    expect(JSON.stringify(renderer.toJSON())).toContain('Pulsa para reintentar')
    expect(renderer.root.findByType('button').props.disabled).toBe(false)
    await act(async () => { await renderer.root.findByType('button').props.onClick() })
    expect(onAnnounce).toHaveBeenCalledTimes(2)
  })
})
