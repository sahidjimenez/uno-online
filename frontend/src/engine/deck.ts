import type { CardColor, CardType } from '../types'

export interface DeckCard {
  color: CardColor
  type:  CardType
}

const COLORS: CardColor[] = ['red', 'blue', 'green', 'yellow']

// Mazo estándar de UNO: 108 cartas
export function createDeck(): DeckCard[] {
  const deck: DeckCard[] = []

  for (const color of COLORS) {
    // Un 0 por color
    deck.push({ color, type: '0' })

    // Dos de cada 1-9, skip, reverse, draw2
    const repeated: CardType[] = ['1','2','3','4','5','6','7','8','9','skip','reverse','draw2']
    for (const type of repeated) {
      deck.push({ color, type })
      deck.push({ color, type })
    }
  }

  // 4 Wild + 4 Wild+4
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', type: 'wild'  })
    deck.push({ color: 'wild', type: 'wild4' })
  }

  return deck
}

// Fisher-Yates shuffle
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Primera carta del descarte: no puede ser Wild ni Wild+4
export function getStartCard(deck: DeckCard[]): { card: DeckCard; remaining: DeckCard[] } {
  const idx = deck.findIndex(c => c.type !== 'wild' && c.type !== 'wild4')
  const card = deck[idx]
  const remaining = [...deck.slice(0, idx), ...deck.slice(idx + 1)]
  return { card, remaining }
}
