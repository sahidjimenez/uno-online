import { useEffect, useState } from 'react'
import { createDeck, shuffle, type DeckCard } from '../engine/deck'
import { applyCard, canPlay, canWinWith, nextPlayerIndex } from '../engine/rules'
import type { Card, CardColor, GameEvent, GameState, LocalSession, Player } from '../types'

export interface LocalGame {
  gameState: GameState
  players: Player[]
  hands: Record<string, Card[]>
  deck: DeckCard[]
  discard: DeckCard[]
  lastEvent: GameEvent | null
  unoPenalty: GameEvent | null
  cardPlay: GameEvent | null
}
export function createLocalGame(session: LocalSession): LocalGame {
  const deck = shuffle(createDeck())
  const playerCount = Math.max(2, Math.min(8, Math.floor(session.playerCount ?? 4)))
  const names = [session.name, 'Lucía', 'Carlos', 'Miguel', 'Sofía', 'Diego', 'Valeria', 'Mateo'].slice(0, playerCount)
  const players = names.map((name, seat): Player => ({ id: seat === 0 ? session.playerId : `bot-${seat}`,
    room_id: session.roomId, user_id: `local-${seat}`, name, seat_order: seat,
    is_connected: true, last_heartbeat: new Date().toISOString(), has_called_uno: false, hand_count: 7 }))
  const hands: Record<string, Card[]> = {}
  for (const player of players) hands[player.id] = Array.from({ length: 7 }, () => makeCard(deck.pop()!, player.id, session.roomId))
  const start = deck.findIndex(card => /^\d$/.test(card.type))
  const top = deck.splice(start, 1)[0]
  return { players, hands, deck, discard: [top], lastEvent: null, unoPenalty: null, cardPlay: null, gameState: {
    id: 'local-game', room_id: session.roomId, version: 0, status: 'playing', current_player_id: session.playerId,
    direction: 1, current_color: top.color, top_card_color: top.color, top_card_type: top.type,
    draw_stack: 0, draw_pile_count: deck.length, winner_id: null, updated_at: new Date().toISOString(),
  } }
}
function makeCard(card: DeckCard, playerId: string, roomId: string): Card {
  return { id: crypto.randomUUID(), player_id: playerId, room_id: roomId, card_color: card.color, card_type: card.type }
}
export function localAction(game: LocalGame, actor: string, action: 'play' | 'draw' | 'uno' | 'catch', cardId?: string, color?: CardColor, accused?: string): LocalGame {
  const state = game.gameState
  if (state.winner_id) return game
  if ((action === 'play' || action === 'draw') && actor !== state.current_player_id) return game
  const next: LocalGame = { ...game, gameState: { ...state }, players: game.players.map(p => ({ ...p })),
    hands: Object.fromEntries(Object.entries(game.hands).map(([id, cards]) => [id, [...cards]])), deck: [...game.deck], discard: [...game.discard] }
  const player = next.players.find(p => p.id === actor)
  if (!player) return game
  let event: GameEvent['type'] = 'turn_changed'
  let penalizedId: string | undefined
  const draw = (id: string, count: number) => {
    for (let i = 0; i < count; i++) {
      if (!next.deck.length && next.discard.length > 1) {
        const top = next.discard.pop()!
        next.deck = shuffle(next.discard)
        next.discard = [top]
      }
      const card = next.deck.pop()
      if (card) next.hands[id].push(makeCard(card, id, state.room_id))
    }
    next.players.find(p => p.id === id)!.has_called_uno = false
  }
  const advance = (skip = false) => {
    const incoming = next.players[nextPlayerIndex(player.seat_order, next.players.length, next.gameState.direction, skip)]
    next.gameState.current_player_id = incoming.id
    // A two-player skip/reverse keeps the same turn: allow time to announce.
    if (incoming.id !== actor && next.hands[incoming.id].length === 1 && !incoming.has_called_uno) {
      draw(incoming.id, 4)
      penalizedId = incoming.id
    }
  }
  if (action === 'play') {
    const card = next.hands[actor].find(c => c.id === cardId)
    if (!card || !canPlay(card, state) || (next.hands[actor].length === 1 && !canWinWith(card))) return game
    if (card.card_color === 'wild' && (!color || color === 'wild')) return game
    next.hands[actor] = next.hands[actor].filter(c => c.id !== cardId)
    player.has_called_uno = false
    Object.assign(next.gameState, applyCard({ color: card.card_color, type: card.card_type }, color ?? null, state, next.players.length, player.seat_order))
    next.discard.push({ color: card.card_color, type: card.card_type })
    event = card.card_type === 'reverse' ? 'reverse_applied' : card.card_type === 'skip' ? 'skip_applied' : 'card_played'
    if (!next.hands[actor].length) { next.gameState.winner_id = actor; next.gameState.status = 'finished' }
    else advance(card.card_type === 'skip' || (card.card_type === 'reverse' && next.players.length === 2 && state.draw_stack === 0))
  } else if (action === 'draw') {
    const stack = state.draw_stack
    draw(actor, stack || 1)
    next.gameState.draw_stack = 0
    event = stack ? 'draw_stack_resolved' : 'card_drawn'
    const drawn = next.hands[actor][next.hands[actor].length - 1]
    if (stack || !drawn || !canPlay(drawn, next.gameState)) advance()
  } else if (action === 'uno') {
    if (next.hands[actor].length !== 1 || player.has_called_uno) return game
    player.has_called_uno = true
    event = 'uno_called'
  } else if (accused && accused !== actor) {
    const target = next.players.find(p => p.id === accused)
    if (!target || next.hands[accused].length !== 1 || target.has_called_uno) return game
    draw(accused, 4)
    penalizedId = accused
    event = 'uno_penalty'
  } else return game
  next.players.forEach(p => { p.hand_count = next.hands[p.id].length })
  next.gameState.version++
  next.gameState.draw_pile_count = next.deck.length
  next.gameState.updated_at = new Date().toISOString()
  next.lastEvent = { id: crypto.randomUUID(), room_id: state.room_id, player_id: actor, type: event, payload: {}, version: next.gameState.version, created_at: next.gameState.updated_at }
  if (action === 'play') next.cardPlay = { ...next.lastEvent, payload: { card: { color: next.gameState.top_card_color, type: next.gameState.top_card_type } } }
  if (penalizedId) next.unoPenalty = { ...next.lastEvent, id: crypto.randomUUID(), type: 'uno_penalty', player_id: penalizedId,
    payload: { accused_id: penalizedId, cards_given: next.hands[penalizedId].length - game.hands[penalizedId].length, automatic: action !== 'catch' } }
  return next
}
export function useOfflineGame(session: LocalSession | null) {
  const [game, setGame] = useState(() => createLocalGame(session!))
  const [botSpeed, setBotSpeed] = useState(() => {
    try { const saved = Number(localStorage.getItem('nexo-bot-speed')); return [0.5, 1, 2, 3].includes(saved) ? saved : 1 } catch { return 1 }
  })
  function changeBotSpeed(speed: number) {
    if (![0.5, 1, 2, 3].includes(speed)) return
    setBotSpeed(speed)
    try { localStorage.setItem('nexo-bot-speed', String(speed)) } catch { /* Optional preference storage. */ }
  }
  useEffect(() => {
    const actor = game.gameState.current_player_id
    if (!actor || actor === session?.playerId || game.gameState.winner_id) return
    const timer = setTimeout(() => {
      setGame(current => {
        const hand = current.hands[actor]
        const playable = hand.find(card => canPlay(card, current.gameState) && (hand.length > 1 || canWinWith(card)))
        let next = playable ? localAction(current, actor, 'play', playable.id,
          (['red', 'blue', 'green', 'yellow'] as CardColor[]).sort((a, b) => hand.filter(c => c.card_color === b).length - hand.filter(c => c.card_color === a).length)[0]) : localAction(current, actor, 'draw')
        if (next.hands[actor].length === 1) next = localAction(next, actor, 'uno')
        return next
      })
    }, 1100 / botSpeed)
    return () => clearTimeout(timer)
  }, [game, session?.playerId, botSpeed])
  return { gameState: game.gameState, players: game.players, myHand: game.hands[session!.playerId], lastEvent: game.lastEvent, unoPenalty: game.unoPenalty,
    botSpeed, changeBotSpeed, cardPlay: game.cardPlay,
    loading: false, isMyTurn: game.gameState.current_player_id === session?.playerId, loadMyHand: async () => {},
    localPlay: (card: Card, color?: CardColor) => setGame(g => localAction(g, session!.playerId, 'play', card.id, color)),
    localDraw: () => setGame(g => localAction(g, session!.playerId, 'draw')),
    localUno: () => setGame(g => localAction(g, session!.playerId, 'uno')),
    localCatch: (id: string) => setGame(g => localAction(g, session!.playerId, 'catch', undefined, undefined, id)), }
}
