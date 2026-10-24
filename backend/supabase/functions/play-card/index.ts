import { action, rpcResult } from '../_shared/action.ts'
import { err } from '../_shared/cors.ts'
import { canPlay, applyCard, nextPlayerIndex } from '../_shared/rules.ts'
Deno.serve(action(async (db, body) => {
  const { room_id, player_id, card_id, chosen_color, version, request_id } = body
  if (!Number.isSafeInteger(version) || !card_id) return err('Carta y versión requeridas')
  const { data: gs, error: gsError } = await db.from('game_state').select('*').eq('room_id', room_id).single()
  if (gsError || !gs) return err('Partida no encontrada', 404)
  if (gs.version !== version) return err('Estado desactualizado; actualiza la mesa', 409)
  if (gs.status !== 'playing' || gs.current_player_id !== player_id) return err('No es tu turno')
  const { data: card } = await db.from('hands').select('*').eq('id', card_id).eq('player_id', player_id).eq('room_id', room_id).single()
  if (!card || !canPlay(card, gs)) return err('Carta no válida')
  if (['wild', 'wild4'].includes(card.card_type) && (typeof chosen_color !== 'string' || !['red', 'blue', 'green', 'yellow'].includes(chosen_color))) return err('Elige un color válido')
  const { data: players } = await db.from('players').select('id,seat_order').eq('room_id', room_id).order('seat_order')
  if (!players?.length) return err('Participantes no encontrados')
  const index = players.findIndex(p => p.id === player_id)
  if (index < 0) return err('Jugador no autorizado', 403)
  const update = applyCard({ color: card.card_color, type: card.card_type }, chosen_color as never, gs, players.length, index)
  const direction = update.direction ?? gs.direction
  const skip = card.card_type === 'skip' || (card.card_type === 'reverse' && players.length === 2 && gs.draw_stack === 0)
  const next = players[nextPlayerIndex(index, players.length, direction, skip)].id
  const type = card.card_type === 'reverse' ? 'reverse_applied' : card.card_type === 'skip' ? 'skip_applied'
    : ['draw2', 'wild4'].includes(card.card_type) ? 'draw_stack_added' : card.card_type === 'wild' ? 'color_chosen' : 'card_played'
  const { data, error } = await db.rpc('commit_game_action', {
    p_room: room_id, p_player: player_id, p_version: version, p_card: card_id, p_cards: [], p_request: request_id,
    p_state: { direction, draw_stack: gs.draw_stack, ...update, current_player_id: next },
    p_event: { type, payload: { card: { color: card.card_color, type: card.card_type }, chosen_color,
      next_player: next, draw_stack: update.draw_stack ?? gs.draw_stack, counterattack: card.card_type === 'reverse' && gs.draw_stack > 0 } },
  })
  return rpcResult(data, error)
}))
