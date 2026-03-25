import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsResponse, json, err } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { room_id, player_id } = await req.json()

  // Verificar que el jugador tiene exactamente 1 carta
  const { count } = await supabase
    .from('hands')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', player_id)

  if (count !== 1) return err('Solo puedes cantar UNO cuando tienes 1 carta')

  // Marcar UNO
  await supabase.from('players')
    .update({ has_called_uno: true })
    .eq('id', player_id)

  await supabase.from('events').insert({
    room_id, player_id, type: 'uno_called',
    payload: { player_id },
  })

  return json({ ok: true })
})
