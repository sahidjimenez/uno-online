import { describe, expect, it } from 'vitest'
import { Box3 } from 'three'
import { createCharacter } from './characterModel'
import { DEFAULT_CHARACTER } from '../lib/character'

describe('adult character proportions', () => {
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
