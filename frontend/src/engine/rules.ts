import type { CardColor, CardType, Card, GameState } from '../types'

// ¿Puede jugarse esta carta sobre el estado actual?
export function canPlay(card: Card, state: GameState): boolean {
  const { current_color, top_card_type, draw_stack } = state

  // Si hay stack activo, solo puedes apilar o contraatacar
  if (draw_stack > 0) {
    return canCounter(card, state)
  }

  // Wild siempre se puede jugar
  if (card.card_type === 'wild' || card.card_type === 'wild4') return true

  // Mismo color
  if (card.card_color === current_color) return true

  // Mismo tipo (número o efecto)
  if (card.card_type === top_card_type) return true

  return false
}

// ¿Puede esta carta contraatacar un stack activo?
export function canCounter(card: Card, state: GameState): boolean {
  const { draw_stack, top_card_color, top_card_type } = state
  if (draw_stack === 0) return false

  // +2 puede contrarrestar a otro +2 o a un +4
  if (card.card_type === 'draw2') return true

  // +4 puede contrarrestar a cualquier stack
  if (card.card_type === 'wild4') return true

  // Reversa del mismo color que la última carta del stack
  if (card.card_type === 'reverse' && card.card_color === state.current_color) return true

  return false
}

// ¿Esta Reversa puede contraatacar el stack actual?
export function canReverseCounter(card: Card, state: GameState): boolean {
  if (card.card_type !== 'reverse') return false
  if (state.draw_stack === 0) return false
  return card.card_color === state.current_color
}

// Calcula el siguiente jugador después de aplicar una carta
export function nextPlayerIndex(
  currentSeat: number,
  playerCount: number,
  direction: 1 | -1,
  skip = false
): number {
  const step = skip ? 2 : 1
  return ((currentSeat + direction * step) % playerCount + playerCount) % playerCount
}

// Aplica el efecto de una carta sobre el estado (lógica pura, sin side effects)
export function applyCard(
  card: { color: CardColor; type: CardType },
  chosenColor: CardColor | null,
  state: GameState,
  playerCount: number,
  currentSeat: number
): Partial<GameState> {
  let { direction, draw_stack } = state

  switch (card.type) {
    case 'reverse':
      if (draw_stack > 0) {
        // Contraataque: devuelve el stack al jugador anterior
        return {
          direction: (direction * -1) as 1 | -1,
          top_card_color: card.color,
          top_card_type:  card.type,
          current_color:  card.color,
          // current_player no cambia — ahora el anterior debe robar
        }
      }
      // Normal: invierte dirección (con 2p actúa como skip)
      const newDir = (direction * -1) as 1 | -1
      const skipFor2 = playerCount === 2
      return {
        direction:      newDir,
        top_card_color: card.color,
        top_card_type:  card.type,
        current_color:  card.color,
        // nextPlayer se calcula en el caller
      }

    case 'skip':
      return {
        top_card_color: card.color,
        top_card_type:  card.type,
        current_color:  card.color,
      }

    case 'draw2':
      return {
        top_card_color: card.color,
        top_card_type:  card.type,
        current_color:  card.color,
        draw_stack:     draw_stack + 2,
      }

    case 'wild4':
      return {
        top_card_color: 'wild',
        top_card_type:  'wild4',
        current_color:  chosenColor ?? 'wild',
        draw_stack:     draw_stack + 4,
      }

    case 'wild':
      return {
        top_card_color: 'wild',
        top_card_type:  'wild',
        current_color:  chosenColor ?? 'wild',
      }

    default:
      return {
        top_card_color: card.color,
        top_card_type:  card.type,
        current_color:  card.color,
      }
  }
}
