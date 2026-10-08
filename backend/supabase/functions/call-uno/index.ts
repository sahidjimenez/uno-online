import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsResponse, json, err } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { room_id, player_id } = await req.json()

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return err('Sesión requerida', 401)
  const { data: auth, error: authError } = await supabase.auth.getUser(token)
  if (authError || !auth.user) return err('Sesión inválida', 401)
  const { data: player } = await supabase.from('players').select('id')
    .eq('id', player_id).eq('room_id', room_id).eq('user_id', auth.user.id).single()
  if (!player) return err('Jugador no válido', 403)
  const { error } = await supabase.rpc('announce_last_card', { p_room_id: room_id, p_player_id: player_id })
  if (error) return err(error.message)

  return json({ ok: true })
})
