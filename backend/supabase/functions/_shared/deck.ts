export type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild'
export type CardType  = '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'
                      | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'

export interface DeckCard { color: CardColor; type: CardType }

const COLORS: CardColor[] = ['red', 'blue', 'green', 'yellow']

export function createDeck(): DeckCard[] {
  const deck: DeckCard[] = []
  for (const color of COLORS) {
    deck.push({ color, type: '0' })
    const repeated: CardType[] = ['1','2','3','4','5','6','7','8','9','skip','reverse','draw2']
    for (const type of repeated) {
      deck.push({ color, type })
      deck.push({ color, type })
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', type: 'wild'  })
    deck.push({ color: 'wild', type: 'wild4' })
  }
  return deck
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function getStartCard(deck: DeckCard[]): { card: DeckCard; remaining: DeckCard[] } {
  const idx = deck.findIndex(c => c.type !== 'wild' && c.type !== 'wild4')
  return { card: deck[idx], remaining: [...deck.slice(0, idx), ...deck.slice(idx + 1)] }
}
