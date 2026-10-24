import { action, rpcResult } from '../_shared/action.ts'
import { err } from '../_shared/cors.ts'
import { nextPlayerIndex } from '../_shared/rules.ts'
Deno.serve(action(async (db, body) => {
  const { room_id, player_id, version, request_id } = body
  if (!Number.isSafeInteger(version)) return err('Versión requerida')
  const { data: gs, error: gsError } = await db.from('game_state').select('*').eq('room_id', room_id).single()
  if (gsError || !gs) return err('Partida no encontrada', 404)
  const { data: players } = await db.from('players').select('id,seat_order').eq('room_id', room_id).order('seat_order')
  if (!players?.length) return err('Participantes no encontrados')
  const index = players.findIndex(p => p.id === player_id)
  if (index < 0) return err('Jugador no autorizado', 403)
  const next = players[nextPlayerIndex(index, players.length, gs.direction)].id
  const { data, error } = await db.rpc('commit_game_action', {
    p_room: room_id, p_player: player_id, p_version: version, p_card: null, p_cards: [],
    p_state: { current_player_id: next }, p_event: { type: 'card_drawn' }, p_request: request_id,
  })
  return rpcResult(data, error)
}))
