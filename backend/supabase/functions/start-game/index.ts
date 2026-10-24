import { action, rpcResult } from '../_shared/action.ts'
Deno.serve(action(async (db, body) => {
  const { data, error } = await db.rpc('start_match', { p_room: body.room_id, p_player: body.player_id })
  return rpcResult(data, error)
}))
