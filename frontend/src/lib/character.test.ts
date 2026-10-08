import { describe, expect, it } from 'vitest'
import { CLOTHING_COLORS, HAIR_COLORS, DEFAULT_CHARACTER, normalizeCharacter } from './character'

describe('saved character preferences', () => {
  it('preserves a complete custom appearance', () => {
    const appearance = { gender: 'woman', hair: 'white', shirt: 'red', pants: 'blue', shoes: 'black' }
    expect(normalizeCharacter(appearance)).toEqual(appearance)
  })
  it('recovers corrupted and missing preferences without passing invalid colors to the model', () => {
    expect(normalizeCharacter(null)).toEqual(DEFAULT_CHARACTER)
    expect(normalizeCharacter('invalid')).toEqual(DEFAULT_CHARACTER)
    expect(normalizeCharacter({ gender: 'unknown', hair: '#ff00aa', shirt: 'brown', pants: 1, shoes: {} })).toEqual(DEFAULT_CHARACTER)
    expect(normalizeCharacter({ hair: 'blonde', shirt: 'white' })).toEqual({ ...DEFAULT_CHARACTER, hair: 'blonde', shirt: 'white' })
  })
  it('offers five distinct colors including black and white in every palette', () => {
    for (const palette of [HAIR_COLORS, CLOTHING_COLORS]) {
      expect(new Set(palette.map(color => color.id)).size).toBe(5)
      expect(palette.some(color => color.id === 'black')).toBe(true)
      expect(palette.some(color => color.id === 'white')).toBe(true)
    }
  })
})
