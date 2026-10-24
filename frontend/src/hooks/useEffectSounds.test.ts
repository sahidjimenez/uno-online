import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useEffectSounds } from './useEffectSounds'

let renderer: ReactTestRenderer
let controls: ReturnType<typeof useEffectSounds>
const start = vi.fn()
const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() })
class AudioMock {
  state = 'running'
  currentTime = 0
  destination = {}
  createGain() { return { gain: param(), connect: vi.fn(), disconnect: vi.fn() } }
  createOscillator() { return { frequency: param(), connect: vi.fn(), disconnect: vi.fn(), start, stop: vi.fn() } }
  close() { return Promise.resolve() }
}
function Probe({ id }: { id?: string }) {
  controls = useEffectSounds(null, undefined, id)
  return null
}
beforeEach(() => {
  start.mockClear()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }))
  vi.stubGlobal('window', { AudioContext: AudioMock })
  vi.stubGlobal('AudioContext', AudioMock)
  act(() => { renderer = create(createElement(Probe)) })
  act(() => { document.dispatchEvent(new Event('pointerdown')) })
})
afterEach(() => { act(() => renderer.unmount()); vi.unstubAllGlobals() })
it('plays one chime per announcement without replaying on rerenders', () => {
  act(() => renderer.update(createElement(Probe, { id: 'bot-nexo-1' })))
  expect(start).toHaveBeenCalledTimes(3)
  act(() => renderer.update(createElement(Probe, { id: 'bot-nexo-1' })))
  expect(start).toHaveBeenCalledTimes(3)
  act(() => renderer.update(createElement(Probe, { id: 'bot-nexo-2' })))
  expect(start).toHaveBeenCalledTimes(6)
})
it('respects mute and does not replay missed announcements when unmuted', () => {
  act(() => controls.toggleSound())
  act(() => renderer.update(createElement(Probe, { id: 'muted' })))
  expect(start).not.toHaveBeenCalled()
  act(() => controls.toggleSound())
  expect(start).not.toHaveBeenCalled()
  act(() => renderer.update(createElement(Probe, { id: 'audible' })))
  expect(start).toHaveBeenCalledTimes(3)
})
