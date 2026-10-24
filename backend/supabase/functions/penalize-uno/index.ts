import { action, rpcResult } from '../_shared/action.ts'
Deno.serve(action(async (db, body) => {
  const { data, error } = await db.rpc('penalize_last_card', { p_room: body.room_id, p_accuser: body.player_id, p_accused: body.accused_id })
  return rpcResult(data, error)
}, true))
