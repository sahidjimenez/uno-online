export const HAIR_COLORS = [
  { id: 'black', name: 'Negro', hex: '#20232b' },
  { id: 'white', name: 'Blanco', hex: '#f3f0e7' },
  { id: 'brown', name: 'Castaño', hex: '#71432c' },
  { id: 'blonde', name: 'Rubio', hex: '#d6b45f' },
  { id: 'copper', name: 'Cobrizo', hex: '#b65a36' },
] as const
export const CLOTHING_COLORS = [
  { id: 'black', name: 'Negro', hex: '#20232b' },
  { id: 'white', name: 'Blanco', hex: '#f3f0e7' },
  { id: 'blue', name: 'Azul', hex: '#4589ce' },
  { id: 'red', name: 'Rojo', hex: '#d65055' },
  { id: 'green', name: 'Verde', hex: '#3b9b7b' },
] as const
export interface CharacterAppearance {
  gender: 'man' | 'woman'
  hair: typeof HAIR_COLORS[number]['id']
  shirt: typeof CLOTHING_COLORS[number]['id']
  pants: typeof CLOTHING_COLORS[number]['id']
  shoes: typeof CLOTHING_COLORS[number]['id']
}
export const DEFAULT_CHARACTER: CharacterAppearance = { gender: 'man', hair: 'brown', shirt: 'green', pants: 'black', shoes: 'white' }
export const CHARACTER_KEY = 'nexo-character-v1'
export const CHARACTER_CHANGED = 'nexo-character-changed'

export function normalizeCharacter(value: unknown): CharacterAppearance {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const result = { ...DEFAULT_CHARACTER }
  if (data.gender === 'man' || data.gender === 'woman') result.gender = data.gender
  if (HAIR_COLORS.some(c => c.id === data.hair)) result.hair = data.hair as CharacterAppearance['hair']
  for (const field of ['shirt', 'pants', 'shoes'] as const) {
    if (CLOTHING_COLORS.some(c => c.id === data[field])) result[field] = data[field] as CharacterAppearance[typeof field]
  }
  return result
}

let sessionAppearance: CharacterAppearance | undefined
export function readCharacter(): CharacterAppearance {
  if (sessionAppearance) return sessionAppearance
  try { return normalizeCharacter(JSON.parse(localStorage.getItem(CHARACTER_KEY) ?? 'null')) }
  catch { return { ...DEFAULT_CHARACTER } }
}
export function saveCharacter(value: CharacterAppearance): boolean {
  sessionAppearance = normalizeCharacter(value)
  let persisted = true
  try { localStorage.setItem(CHARACTER_KEY, JSON.stringify(sessionAppearance)) } catch { persisted = false }
  window.dispatchEvent(new Event(CHARACTER_CHANGED))
  return persisted
}
export function refreshStoredCharacter() { sessionAppearance = undefined }

export function characterForSeat(index: number): CharacterAppearance {
  return { gender: index % 2 ? 'woman' : 'man', hair: HAIR_COLORS[index % 5].id,
    shirt: CLOTHING_COLORS[(index + 2) % 5].id, pants: index % 2 ? 'blue' : 'black', shoes: index % 3 ? 'white' : 'black' }
}
