import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createDeck, shuffle, getStartCard } from '../_shared/deck.ts'
import { corsResponse, json, err } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { room_id, player_id } = await req.json()
  if (!room_id || !player_id) return err('room_id y player_id requeridos')

  // 1. Verificar que el caller es el host y la sala está en waiting
  const { data: room } = await supabase
    .from('rooms').select('*').eq('id', room_id).single()
  if (!room)                          return err('Sala no encontrada', 404)
  if (room.host_id !== player_id)     return err('Solo el host puede iniciar')
  if (room.status   !== 'waiting')    return err('La partida ya comenzó')

  // 2. Cargar jugadores ordenados por seat
  const { data: players } = await supabase
    .from('players').select('id, seat_order').eq('room_id', room_id).order('seat_order')
  if (!players || players.length < 2) return err('Mínimo 2 jugadores')

  // 3. Crear y barajar mazo
  let deck = shuffle(createDeck())

  // 4. Repartir 7 cartas a cada jugador
  const handRows: { room_id: string; player_id: string; card_color: string; card_type: string }[] = []
  for (const player of players) {
    for (let i = 0; i < 7; i++) {
      const card = deck.shift()!
      handRows.push({ room_id, player_id: player.id, card_color: card.color, card_type: card.type })
    }
  }
  const { error: handErr } = await supabase.from('hands').insert(handRows)
  if (handErr) return err(`Error repartiendo cartas: ${handErr.message}`, 500)

  // 5. Primera carta del descarte (no Wild)
  const { card: startCard, remaining } = getStartCard(deck)
  deck = remaining

  // 6. Crear game_state
  const firstPlayer = players[0]
  let direction: 1 | -1 = 1
  let firstPlayerIdx = 0

  // Si la primera carta es Skip o Reverse, aplicar efecto inicial
  if (startCard.type === 'skip') {
    firstPlayerIdx = 1 % players.length
  } else if (startCard.type === 'reverse') {
    direction = -1
    firstPlayerIdx = players.length - 1
  }

  const { error: gsErr } = await supabase.from('game_state').update({
    version:           1,
    status:            'playing',
    current_player_id: players[firstPlayerIdx].id,
    direction,
    current_color:     startCard.color === 'wild' ? null : startCard.color,
    top_card_color:    startCard.color,
    top_card_type:     startCard.type,
    draw_stack:        startCard.type === 'draw2' ? 2 : 0,
    draw_pile_count:   deck.length,
    updated_at:        new Date().toISOString(),
  }).eq('room_id', room_id)
  if (gsErr) return err(`Error creando game_state: ${gsErr.message}`, 500)

  // 7. Actualizar sala a 'playing'
  await supabase.from('rooms').update({ status: 'playing', updated_at: new Date().toISOString() }).eq('id', room_id)

  // 8. Registrar evento
  await supabase.from('events').insert({
    room_id, player_id, type: 'game_started', version: 1,
    payload: { player_count: players.length, first_card: startCard },
  })

  return json({ ok: true, first_card: startCard, player_count: players.length })
})
