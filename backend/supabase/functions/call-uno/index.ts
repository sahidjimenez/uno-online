import { action, rpcResult } from '../_shared/action.ts'
Deno.serve(action(async (db, body) => {
  const { data, error } = await db.rpc('announce_last_card', { p_room_id: body.room_id, p_player_id: body.player_id })
  return rpcResult(data, error)
}))
