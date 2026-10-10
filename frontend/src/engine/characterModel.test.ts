import { describe, expect, it } from 'vitest'
import { Box3 } from 'three'
import { createCharacter } from './characterModel'
import { DEFAULT_CHARACTER } from '../lib/character'

describe('adult character proportions', () => {
  it('reaches forward to play and returns the hand to its resting pose', () => {
    const model = createCharacter(DEFAULT_CHARACTER, true)
    const rest = model.handPosition()
    model.poseArm(1)
    const reached = model.handPosition()
    expect(reached.z - rest.z).toBeGreaterThan(0.35)
    expect(reached.y).toBeGreaterThan(rest.y)
    model.poseArm(0)
    expect(model.handPosition().distanceTo(rest)).toBeLessThan(0.0001)
    model.dispose()
  })
  it('fits standing adults and raises seated heads above the table', () => {
    for (const seated of [false, true]) {
      const model = createCharacter(DEFAULT_CHARACTER, seated)
      const bounds = new Box3().setFromObject(model.group)
      expect(bounds.min.y).toBeGreaterThanOrEqual(0)
      expect(bounds.max.y).toBeGreaterThan(seated ? 2.3 : 2.7)
      expect(bounds.max.y).toBeLessThan(seated ? 2.6 : 3)
      model.dispose()
    }
  })
})
