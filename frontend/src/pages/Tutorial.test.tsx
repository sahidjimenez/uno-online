import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Tutorial } from './Tutorial'
import { Board } from './Board'
import { TUTORIAL_PROGRESS_KEY } from '../engine/tutorial'

vi.mock('./Board', () => ({ Board: () => null }))
let renderer: ReactTestRenderer
let saved: Map<string, string>
const practice = vi.fn()
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(text).join('')
}
function click(label: string) {
  const button = renderer.root.findAllByType('button').find(item => text(item).includes(label))
  if (!button) throw new Error(`Missing button: ${label}`)
  expect(button.props.disabled).not.toBe(true)
  act(() => button.props.onClick())
}
beforeEach(() => {
  saved = new Map([[TUTORIAL_PROGRESS_KEY, '6']])
  vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) })
  practice.mockClear()
  act(() => { renderer = create(createElement(Tutorial, { onExit: vi.fn(), onPractice: practice })) })
})
afterEach(() => { act(() => renderer.unmount()); vi.unstubAllGlobals() })

describe('campaign final challenge', () => {
  it('starts a two-player game and saves completion only after a human win', () => {
    click('Tu primer desafío')
    click('Comenzar desafío')
    const board = renderer.root.findByType(Board)
    expect(board.props.session.playerCount).toBe(2)
    expect(board.props.local).toBe(true)
    expect(saved.get(TUTORIAL_PROGRESS_KEY)).toBe('6')
    act(() => board.props.onFinish('student', []))
    expect(saved.get(TUTORIAL_PROGRESS_KEY)).toBe('7')
    expect(JSON.stringify(renderer.toJSON())).toContain('Campaña completada')
    click('Practicar contra bots')
    expect(practice).toHaveBeenCalledOnce()
  })
  it('allows retrying a loss with a fresh game, without unlocking completion', () => {
    click('Tu primer desafío')
    click('Comenzar desafío')
    const first = renderer.root.findByType(Board).props
    act(() => first.onFinish('bot-1', []))
    expect(saved.get(TUTORIAL_PROGRESS_KEY)).toBe('6')
    expect(JSON.stringify(renderer.toJSON())).toContain('El bot ganó')
    click('Reintentar desafío')
    const second = renderer.root.findByType(Board).props
    expect(second.session.roomId).not.toBe(first.session.roomId)
    act(() => second.onExit())
    expect(saved.get(TUTORIAL_PROGRESS_KEY)).toBe('6')
    expect(renderer.root.findAllByType(Board)).toHaveLength(0)
  })
})
