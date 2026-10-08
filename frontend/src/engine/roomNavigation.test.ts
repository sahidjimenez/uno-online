import { describe, expect, it } from 'vitest'
import { canWalkTo } from './roomNavigation'

describe('room navigation', () => {
  it('keeps the camera inside the walls and outside the table', () => {
    expect(canWalkTo(0, 0, 4)).toBe(false)
    expect(canWalkTo(9, 5, 4)).toBe(false)
    expect(canWalkTo(-5, -9, 4)).toBe(false)
    expect(canWalkTo(5, 5, 4)).toBe(true)
  })
  it.each([2, 3, 4, 5, 6, 7, 8])('avoids every chair for %i players and leaves the entrance clear', count => {
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count
      expect(canWalkTo(Math.sin(angle) * 3.3, Math.cos(angle) * 3.3, count)).toBe(false)
    }
    expect(canWalkTo(1.6, 5.3, count)).toBe(true)
  })
})
