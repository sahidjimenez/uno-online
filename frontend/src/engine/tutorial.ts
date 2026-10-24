import { createDeck, type DeckCard } from './deck'
import { canPlay } from './rules'
import { createLocalGame, localAction, type LocalGame } from '../hooks/useOfflineGame'
import type { CardColor, LocalSession } from '../types'

export const lessons = [
  { title: 'Tu primera carta', description: 'Aprende a jugar por color.', instruction: 'La mesa tiene un 3 rojo. Juega tu 5 rojo: el color coincide.', success: '¡Bien! Puedes jugar una carta del mismo color aunque tenga otro número.' },
  { title: 'Encuentra la coincidencia', description: 'El mismo número también cuenta.', instruction: 'La mesa tiene un 5 rojo. Juega tu 5 azul: el número coincide aunque cambie el color.', success: '¡Exacto! El número coincide. Ahora el color de la mesa es azul.' },
  { title: 'Robar del mazo', description: 'Descubre qué hacer cuando no puedes jugar.', instruction: 'La mesa tiene un 7 amarillo. Ninguna de tus cartas coincide en color o número. Pulsa el mazo para robar.', success: '¡Lo lograste! Robaste una carta y, como podías jugarla, la pusiste en la mesa en el mismo turno.' },
  { title: 'Cambia la partida', description: 'Salto, reversa y comodines.', instruction: '', success: '¡Bien! Ya sabes saltar turnos, invertir el sentido y elegir un nuevo color.' },
  { title: 'Ataque y defensa', description: 'Acumula cartas o devuelve el ataque.', instruction: '', success: '¡Listo! Puedes acumular +2 y +4, devolver el ataque con reversa del color activo o robar la penalización.' },
  { title: '¡NEXO!', description: 'Anuncia tu última carta y gana con un número.', instruction: 'Juega el salto rojo para quedarte con una carta. Con dos jugadores, el salto te permite jugar otra vez.', success: '¡Ganaste! Avisaste con ¡NEXO! y terminaste con una carta de número. Las cartas especiales no pueden ser la jugada ganadora.' },
  { title: 'Tu primer desafío', description: 'Gana una partida completa contra un bot.', instruction: 'Pon en práctica lo aprendido. Juega contra un bot, anuncia ¡NEXO! y termina con un número. Gana para completar la campaña; puedes volver a intentarlo si pierdes.', success: '¡Campaña completada! Ganaste tu primera partida de desafío.' },
] as const

export const specialSteps = [
  { card: 'skip', instruction: 'Juega el salto rojo. Tu rival pierde su turno; en una mesa de dos, vuelves a jugar tú.', result: 'El salto dejó al rival sin turno. Sigues jugando tú.' },
  { card: 'reverse', instruction: 'Juega la reversa roja para cambiar el sentido. Con dos jugadores también te permite jugar de nuevo.', result: 'La dirección cambió. En una mesa de más jugadores, el turno iría hacia el otro lado.' },
  { card: 'wild', instruction: 'Juega el comodín y elige azul. Los comodines permiten cambiar el color de la mesa.', result: 'Elegiste azul. Ahora las siguientes cartas deben coincidir con ese color o ser un comodín.' },
] as const
export const attackSteps = [
  { card: 'draw2', stack: 2, instruction: 'Te atacaron con +2. Juega tu +2 para acumular cuatro cartas y pasar el ataque al rival.', result: 'Ahora hay cuatro cartas acumuladas. El rival debe responder o robarlas.' },
  { card: 'wild4', stack: 2, instruction: 'También puedes responder al +2 con un +4. Juega el +4 y elige azul para acumular seis cartas.', result: 'El ataque suma seis cartas y el color activo es azul.' },
  { card: 'reverse', stack: 6, instruction: 'El ataque suma seis cartas. Juega la reversa roja: coincide con el color activo y devuelve el ataque sin aumentarlo.', result: 'Cambiaste la dirección: las seis cartas siguen acumuladas y le tocan al rival.' },
  { card: '8', stack: 4, instruction: 'Esta vez no tienes defensa. Pulsa el mazo para robar las cuatro cartas acumuladas y pasar el turno.', result: 'Robaste cuatro cartas. La acumulación volvió a cero y el turno pasó al rival.' },
] as const

export interface TutorialState { level: number; phase: number; game: LocalGame; step: 'action' | 'drawn' | 'explained' | 'announce' | 'finish' | 'complete' }
export const tutorialSession: LocalSession = { playerId: 'student', roomId: 'tutorial', roomCode: 'APRENDER', name: 'Tú', playerCount: 2 }

export function createLesson(level: number, phase = 0): TutorialState {
  if (!Number.isInteger(level) || level < 0 || level >= lessons.length) throw new Error('Nivel no válido')
  const deck = createDeck()
  const take = (color: DeckCard['color'], type: DeckCard['type']) => {
    const index = deck.findIndex(card => card.color === color && card.type === type)
    return deck.splice(index, 1)[0]
  }
  const top = level === 2 ? take('yellow', '7') : take('red', level === 4 ? 'draw2' : level === 0 ? '3' : '5')
  let hand = [take(level === 0 ? 'red' : 'blue', level === 2 ? '2' : '5'), take('green', '8'), take('blue', '9')]
  if (level >= 3 && level <= 5) {
    deck.push(...hand)
    const type = level === 3 ? specialSteps[phase].card : level === 4 ? attackSteps[phase].card : 'skip'
    hand = [take(type === 'wild' || type === 'wild4' ? 'wild' : 'red', type), take('green', '8'), take('blue', '9')]
    if (level === 5) { deck.push(...hand.slice(1)); hand = [hand[0], take('red', '8')] }
  }
  const opponent = [take('green', '1'), take('yellow', '2'), take('red', '9')]
  if (level === 2) deck.push(take('yellow', '4'))
  const game = createLocalGame(tutorialSession)
  game.deck = deck
  game.discard = [top]
  game.hands = Object.fromEntries([hand, opponent].map((cards, seat) => {
    const player = game.players[seat]
    player.hand_count = cards.length
    player.name = seat === 0 ? 'Tú' : 'Guía'
    return [player.id, cards.map((card, index) => ({ id: `${seat}-${index}`, player_id: player.id, room_id: tutorialSession.roomId, card_color: card.color, card_type: card.type }))]
  }))
  Object.assign(game.gameState, { top_card_color: top.color, top_card_type: top.type, current_color: top.color, draw_pile_count: deck.length, draw_stack: level === 4 ? attackSteps[phase].stack : 0 })
  return { level, phase, game, step: 'action' }
}

export function tutorialAction(state: TutorialState, action: 'play' | 'draw' | 'uno', cardId?: string, color?: CardColor): TutorialState {
  if (state.step === 'complete' || state.step === 'explained' || state.level === 6) return state
  const hand = state.game.hands[tutorialSession.playerId]
  if (action === 'uno') {
    if (state.level !== 5 || state.step !== 'announce') return state
    return { ...state, game: localAction(state.game, tutorialSession.playerId, 'uno'), step: 'finish' }
  }
  if (state.step === 'announce') return state
  if (action === 'draw') {
    if (state.level === 4 && state.phase === 3) return { ...state, game: localAction(state.game, tutorialSession.playerId, 'draw'), step: 'complete' }
    if (state.level !== 2 || state.step !== 'action' || hand.some(card => canPlay(card, state.game.gameState))) return state
    return { ...state, game: localAction(state.game, tutorialSession.playerId, 'draw'), step: 'drawn' }
  }
  if (state.level === 2 && state.step !== 'drawn') return state
  const card = hand.find(item => item.id === cardId)
  if ((state.level === 3 || state.level === 4) && card?.card_type !== (state.level === 3 ? specialSteps[state.phase].card : attackSteps[state.phase].card)) return state
  if (state.level === 4 && state.phase === 3) return state
  if (state.level === 5 && state.step === 'action' && card?.card_type !== 'skip') return state
  if (card?.card_color === 'wild' && color !== 'blue') return state
  const game = localAction(state.game, tutorialSession.playerId, 'play', cardId, color)
  const step = state.level === 5 && state.step === 'action' ? 'announce'
    : (state.level === 3 && state.phase < 2) || (state.level === 4 && state.phase < 3) ? 'explained' : 'complete'
  return game === state.game ? state : { ...state, game, step }
}

export function lessonInstruction(state: TutorialState): string {
  if (state.step === 'complete') return lessons[state.level].success
  if (state.level === 3 || state.level === 4) {
    const part = state.level === 3 ? specialSteps[state.phase] : attackSteps[state.phase]
    return state.step === 'explained' ? part.result : part.instruction
  }
  if (state.step === 'announce') return '¡Te queda una carta! Pulsa ¡NEXO! para avisar antes de continuar. Si vuelve tu turno sin avisar, recibes cuatro cartas. Con bots tienes al menos cinco segundos; aquí puedes practicar sin prisa.'
  if (state.step === 'finish') return 'Aviso confirmado. Ahora juega tu 8 rojo para ganar. Recuerda: solo puedes terminar con una carta de número.'
  if (state.step === 'drawn') return 'Robaste un 4 amarillo. Como coincide con el color de la mesa, puedes jugarlo ahora. Pulsa la carta resaltada.'
  return lessons[state.level].instruction
}

export const TUTORIAL_PROGRESS_KEY = 'nexo-tutorial-progress-v1'
export function readTutorialProgress(): number {
  try {
    const value = Number(localStorage.getItem(TUTORIAL_PROGRESS_KEY))
    return Number.isInteger(value) && value >= 0 && value <= lessons.length ? value : 0
  } catch { return 0 }
}

