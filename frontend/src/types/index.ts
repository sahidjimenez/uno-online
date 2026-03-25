// ============================================================
// Tipos que reflejan exactamente el schema de Supabase
// ============================================================

export type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild'
export type CardType  = '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'
                      | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'
export type RoomStatus = 'waiting' | 'playing' | 'finished'
export type EventType =
  | 'room_created' | 'player_joined' | 'player_left' | 'game_started'
  | 'card_played'  | 'card_drawn'    | 'uno_called'
  | 'skip_applied' | 'reverse_applied'
  | 'draw_stack_added' | 'draw_stack_resolved'
  | 'color_chosen' | 'turn_changed'
  | 'game_finished' | 'player_reconnected'
  | 'uno_penalty'

export interface Card {
  id:         string
  room_id:    string
  player_id:  string
  card_color: CardColor
  card_type:  CardType
}

export interface Room {
  id:          string
  code:        string
  status:      RoomStatus
  host_id:     string | null
  max_players: number
  created_at:  string
  updated_at:  string
}

export interface Player {
  id:             string
  room_id:        string
  user_id:        string
  name:           string
  seat_order:     number
  is_connected:   boolean
  last_heartbeat: string
  has_called_uno: boolean
  hand_count?:    number   // calculado en el cliente — NO viene de hands (RLS)
}

export interface GameState {
  id:                string
  room_id:           string
  version:           number
  status:            RoomStatus
  current_player_id: string | null
  direction:         1 | -1
  current_color:     CardColor | null
  top_card_color:    CardColor | null
  top_card_type:     CardType  | null
  draw_stack:        number
  draw_pile_count:   number
  winner_id:         string | null
  updated_at:        string
}

export interface GameEvent {
  id:         string
  room_id:    string
  player_id:  string | null
  type:       EventType
  payload:    Record<string, unknown>
  version:    number | null
  created_at: string
}

// ── Tipos de UI ──────────────────────────────────────────

export type EffectOverlayType = 'skip' | 'reverse' | 'draw_stack' | 'reverse_counter' | null

export interface EffectOverlayState {
  type:       EffectOverlayType
  color?:     CardColor
  stack?:     number
  byPlayer?:  string
  canCounter: boolean
}

// Sesión local del jugador (guardada en sessionStorage)
export interface LocalSession {
  playerId: string
  roomId:   string
  roomCode: string
  name:     string
}
