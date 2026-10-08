import { useEffect, useState } from 'react'
import { CHARACTER_CHANGED, CHARACTER_KEY, readCharacter, refreshStoredCharacter } from '../lib/character'

export function useCharacter() {
  const [appearance, setAppearance] = useState(readCharacter)
  useEffect(() => {
    const update = () => setAppearance(readCharacter())
    const storage = (event: StorageEvent) => {
      if (event.key === CHARACTER_KEY || event.key === null) { refreshStoredCharacter(); update() }
    }
    window.addEventListener(CHARACTER_CHANGED, update)
    window.addEventListener('storage', storage)
    update()
    return () => { window.removeEventListener(CHARACTER_CHANGED, update); window.removeEventListener('storage', storage) }
  }, [])
  return appearance
}
