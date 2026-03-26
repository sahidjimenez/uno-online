import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createDeck, shuffle } from '../_shared/deck.ts'
import { corsResponse, json, err } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { room_id, accuser_id, accused_id } = await req.json()

  // 1. Verificar que la partida está activa
  const { data: gs } = await supabase
    .from('game_state').select('status, draw_pile_count').eq('room_id', room_id).single()
  if (!gs)                       return err('Partida no encontrada', 404)
  if (gs.status !== 'playing')   return err('La partida no está activa')

  // 2. Verificar que el acusador es un jugador de la sala (no puede acusarse a sí mismo)
  if (accuser_id === accused_id) return err('No puedes acusarte a ti mismo')

  const { data: accuser } = await supabase
    .from('players').select('id').eq('id', accuser_id).eq('room_id', room_id).single()
  if (!accuser) return err('Acusador no válido')

  // 3. Verificar que el acusado está en la sala
  const { data: accused } = await supabase
    .from('players').select('id, has_called_uno').eq('id', accused_id).eq('room_id', room_id).single()
  if (!accused) return err('Jugador acusado no encontrado')

  // 4. Verificar que el acusado tiene exactamente 1 carta
  const { count: handCount } = await supabase
    .from('hands')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', accused_id)

  if (handCount !== 1) return err('El jugador no tiene 1 carta — penalización inválida')

  // 5. Verificar que NO cantó UNO
  if (accused.has_called_uno) return err('El jugador ya cantó UNO — no hay penalización')

  // 6. Dar 4 cartas de penalidad al acusado (reglas europeas)
  const PENALTY_CARDS = 4
  let drawPileCount = gs.draw_pile_count ?? 108
  if (drawPileCount < PENALTY_CARDS) drawPileCount = createDeck().length

  const freshDeck = shuffle(createDeck())
  const penaltyCards = freshDeck.slice(0, PENALTY_CARDS).map(c => ({
    room_id,
    player_id:  accused_id,
    card_color: c.color,
    card_type:  c.type,
  }))

  const { error: insertErr } = await supabase.from('hands').insert(penaltyCards)
  if (insertErr) return err(`Error dando penalidad: ${insertErr.message}`, 500)

  // 7. Actualizar draw_pile_count en game_state
  await supabase.from('game_state')
    .update({ draw_pile_count: drawPileCount - PENALTY_CARDS, updated_at: new Date().toISOString() })
    .eq('room_id', room_id)

  // 8. Registrar evento
  await supabase.from('events').insert({
    room_id,
    player_id: accuser_id,
    type:      'uno_penalty',
    payload:   { accused_id, accuser_id, cards_given: PENALTY_CARDS },
  })

  return json({ ok: true, cards_given: PENALTY_CARDS })
})
