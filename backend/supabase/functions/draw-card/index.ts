import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createDeck, shuffle } from '../_shared/deck.ts'
import { corsResponse, json, err } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { room_id, player_id, version } = await req.json()

  // 1. Validar turno y estado
  const { data: gs } = await supabase
    .from('game_state').select('*').eq('room_id', room_id).single()
  if (!gs)                                return err('Partida no encontrada', 404)
  if (gs.version !== version)             return err('Estado desactualizado — recarga', 409)
  if (gs.current_player_id !== player_id) return err('No es tu turno')
  if (gs.status !== 'playing')            return err('La partida no está activa')

  // 2. Cargar jugadores para calcular siguiente turno
  const { data: players } = await supabase
    .from('players').select('id, seat_order').eq('room_id', room_id).order('seat_order')
  if (!players) return err('Error cargando jugadores', 500)

  const count      = players.length
  const currentIdx = players.findIndex(p => p.id === player_id)
  const nextIdx    = ((currentIdx + gs.direction) % count + count) % count
  const nextPlayer = players[nextIdx].id

  // 3. Cuántas cartas robar
  const cardsToDraw = gs.draw_stack > 0 ? gs.draw_stack : 1
  const resolvingStack = gs.draw_stack > 0

  // 4. Asegurar que hay suficientes cartas en el mazo
  //    Si no, recrear mazo (barajar de nuevo — simplificado: mazo fresco menos cartas en mano)
  let drawPileCount = gs.draw_pile_count
  if (drawPileCount < cardsToDraw) {
    // Mazo agotado: crear uno nuevo (en producción se usaría el pile de descarte)
    drawPileCount = createDeck().length
  }

  // 5. Generar las cartas a robar
  const freshDeck = shuffle(createDeck())
  const newCards = freshDeck.slice(0, cardsToDraw).map(c => ({
    room_id,
    player_id,
    card_color: c.color,
    card_type:  c.type,
  }))

  const { error: insertErr } = await supabase.from('hands').insert(newCards)
  if (insertErr) return err(`Error dando cartas: ${insertErr.message}`, 500)

  // Resetear has_called_uno — al robar ya no vale el UNO cantado
  await supabase.from('players').update({ has_called_uno: false }).eq('id', player_id)

  // 6. Actualizar game_state
  const newVersion = gs.version + 1
  await supabase.from('game_state').update({
    version:           newVersion,
    current_player_id: nextPlayer,
    draw_stack:        0,                    // stack resuelto
    draw_pile_count:   drawPileCount - cardsToDraw,
    updated_at:        new Date().toISOString(),
  }).eq('room_id', room_id)

  // 7. Registrar evento
  await supabase.from('events').insert({
    room_id, player_id,
    type:    resolvingStack ? 'draw_stack_resolved' : 'card_drawn',
    version: newVersion,
    payload: { cards_drawn: cardsToDraw, stack_resolved: resolvingStack },
  })

  return json({ ok: true, cards_drawn: cardsToDraw, next_player_id: nextPlayer, version: newVersion })
})
