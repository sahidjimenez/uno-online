import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsResponse, json, err } from '../_shared/cors.ts'
import type { CardColor, CardType } from '../_shared/deck.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { room_id, player_id, card_id, chosen_color, version } = await req.json()

  // 1. Cargar estado actual con bloqueo optimista
  const { data: gs } = await supabase
    .from('game_state').select('*').eq('room_id', room_id).single()
  if (!gs)                            return err('Partida no encontrada', 404)
  if (gs.version !== version)         return err('Estado desactualizado — recarga', 409)
  if (gs.current_player_id !== player_id) return err('No es tu turno')
  if (gs.status !== 'playing')        return err('La partida no está activa')

  // 2. Verificar que la carta está en la mano del jugador
  const { data: card } = await supabase
    .from('hands').select('*').eq('id', card_id).eq('player_id', player_id).single()
  if (!card) return err('Carta no encontrada en tu mano')

  // 3. Validar si la carta puede jugarse
  const stackActive = gs.draw_stack > 0

  if (stackActive) {
    // Con stack activo solo puedes apilar (+2, +4) o contraatacar con Reversa del mismo color
    const isAddable  = card.card_type === 'draw2' || card.card_type === 'wild4'
    const isReversal = card.card_type === 'reverse' && card.card_color === gs.current_color
    if (!isAddable && !isReversal) return err('Debes apilar (+2/+4), contraatacar con Reversa del mismo color, o robar')
  } else {
    // Turno normal: mismo color, mismo tipo, o Wild
    const matchColor = card.card_color === gs.current_color
    const matchType  = card.card_type  === gs.top_card_type
    const isWild     = card.card_type === 'wild' || card.card_type === 'wild4'
    if (!matchColor && !matchType && !isWild) return err('Carta no válida para jugar')
  }

  // Wild sin color elegido
  if ((card.card_type === 'wild' || card.card_type === 'wild4') && !chosen_color && !stackActive) {
    return err('Debes elegir un color para la Wild')
  }

  // 4. Cargar jugadores para calcular siguiente turno
  const { data: players } = await supabase
    .from('players').select('id, seat_order').eq('room_id', room_id).order('seat_order')
  if (!players) return err('Error cargando jugadores', 500)

  const currentIdx = players.findIndex(p => p.id === player_id)
  const count      = players.length

  // 5. Calcular nuevo estado
  let newDirection  = gs.direction as 1 | -1
  let newDrawStack  = gs.draw_stack
  let newColor      = (chosen_color ?? card.card_color) as CardColor
  let newEventType  = 'card_played'
  let skipNext      = false
  let reverseCounter = false

  switch (card.card_type as CardType) {
    case 'skip':
      skipNext     = true
      newColor     = card.card_color
      newEventType = 'skip_applied'
      break
    case 'reverse':
      if (stackActive) {
        // Contraataque: invertir dirección sin avanzar turno
        // El jugador anterior (que mandó el stack) ahora debe robar
        reverseCounter = true
        newDirection   = (newDirection * -1) as 1 | -1
        newColor       = card.card_color
        newEventType   = 'reverse_applied'
      } else {
        newDirection = (newDirection * -1) as 1 | -1
        newColor     = card.card_color
        if (count === 2) skipNext = true  // Con 2p, Reverse actúa como Skip
        newEventType = 'reverse_applied'
      }
      break
    case 'draw2':
      newDrawStack += 2
      newColor      = card.card_color
      newEventType  = 'draw_stack_added'
      break
    case 'wild4':
      newDrawStack += 4
      newColor      = chosen_color as CardColor
      newEventType  = 'draw_stack_added'
      break
    case 'wild':
      newColor     = chosen_color as CardColor
      newEventType = 'color_chosen'
      break
    default:
      newColor = card.card_color
  }

  // 6. Calcular quién juega después
  let nextIdx: number
  if (reverseCounter) {
    // La penalidad regresa al jugador anterior: 1 paso en la nueva dirección
    // (la dirección ya fue invertida, así que +1 paso nos lleva de vuelta al que envió el stack)
    nextIdx = ((currentIdx + newDirection) % count + count) % count
  } else if (skipNext) {
    nextIdx = ((currentIdx + newDirection * 2) % count + count) % count
  } else {
    nextIdx = ((currentIdx + newDirection) % count + count) % count
  }
  const nextPlayerId = players[nextIdx].id

  // 7. Eliminar carta de la mano
  await supabase.from('hands').delete().eq('id', card_id)

  // 8. Verificar si ganó (mano vacía)
  const { count: remaining } = await supabase
    .from('hands').select('*', { count: 'exact', head: true }).eq('player_id', player_id)

  const won = remaining === 0

  // Resetear has_called_uno si le quedan 2+ cartas (cantó UNO pero luego robó en otro turno)
  if (!won && (remaining ?? 0) > 1) {
    await supabase.from('players').update({ has_called_uno: false }).eq('id', player_id)
  }

  // 9. Actualizar game_state
  const newVersion = gs.version + 1
  await supabase.from('game_state').update({
    version:           newVersion,
    current_player_id: won ? null : nextPlayerId,
    direction:         newDirection,
    current_color:     newColor,
    top_card_color:    card.card_color,
    top_card_type:     card.card_type,
    draw_stack:        won ? 0 : newDrawStack,
    status:            won ? 'finished' : 'playing',
    winner_id:         won ? player_id : null,
    updated_at:        new Date().toISOString(),
  }).eq('room_id', room_id)

  if (won) {
    await supabase.from('rooms').update({ status: 'finished', updated_at: new Date().toISOString() }).eq('id', room_id)
  }

  // 10. Registrar evento
  await supabase.from('events').insert({
    room_id, player_id,
    type:    won ? 'game_finished' : newEventType,
    version: newVersion,
    payload: {
      card:         { color: card.card_color, type: card.card_type },
      chosen_color: chosen_color ?? null,
      next_player:  nextPlayerId,
      draw_stack:   newDrawStack,
      won,
    },
  })

  return json({ ok: true, won, next_player_id: nextPlayerId, version: newVersion })
})
