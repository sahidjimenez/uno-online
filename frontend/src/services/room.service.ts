import { supabase, ensureAnonSession } from '../lib/supabase'
import type { Room, Player, GameState, LocalSession } from '../types'

const SESSION_KEY = 'uno_session'

export function saveSession(s: LocalSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
}
export function loadSession(): LocalSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    const value = raw ? JSON.parse(raw) : null
    if (!value || !['playerId', 'roomId', 'roomCode', 'name'].every(key => typeof value[key] === 'string')) return null
    return value as LocalSession
  } catch { return null }
}
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

// Crear sala + unirse como host
export async function createRoom(
  playerName: string,
  isPrivate = false,
  password?: string,
): Promise<LocalSession> {
  await ensureAnonSession()
  const { data, error } = await supabase.rpc('create_room', {
    player_name: playerName,
    p_is_private: isPrivate,
    p_password:   password ?? null,
  })
  if (error || data?.error) throw new Error(error?.message ?? data.error)

  const session: LocalSession = {
    playerId: data.player_id,
    roomId:   data.room_id,
    roomCode: data.room_code,
    name:     playerName,
  }
  saveSession(session)
  return session
}

// Unirse a sala con código (y contraseña si es sala privada)
export async function joinRoom(
  code: string,
  playerName: string,
  password?: string,
): Promise<LocalSession> {
  await ensureAnonSession()
  const { data, error } = await supabase.rpc('join_room', {
    p_code:      code.toUpperCase().trim(),
    player_name: playerName,
    p_password:  password ?? null,
  })
  if (error || data?.error) throw new Error(error?.message ?? data.error)

  const session: LocalSession = {
    playerId: data.player_id,
    roomId:   data.room_id,
    roomCode: code.toUpperCase().trim(),
    name:     playerName,
  }
  saveSession(session)
  return session
}

// Buscar partida pública disponible (matchmaking)
export async function findPublicRoom(playerName: string): Promise<LocalSession & { matched?: boolean }> {
  await ensureAnonSession()
  const { data, error } = await supabase.rpc('find_public_room', { player_name: playerName })
  if (error || data?.error) throw new Error(error?.message ?? data.error)

  const session: LocalSession & { matched?: boolean } = {
    playerId: data.player_id,
    roomId:   data.room_id,
    roomCode: data.room_code,
    name:     playerName,
    matched:  data.matched ?? false,
  }
  saveSession(session)
  return session
}

// Reconectar con la sesión guardada
export async function reconnect(code: string): Promise<LocalSession | null> {
  const { data, error } = await supabase.rpc('reconnect_player', { p_code: code.toUpperCase() })
  if (error?.code === 'P0001') { clearSession(); return null }
  if (error || data?.error) throw new Error(error?.message ?? data.error)
  if (!data) return null

  const session: LocalSession = {
    playerId: data.player_id,
    roomId:   data.room_id,
    roomCode: code.toUpperCase(),
    name:     data.name,
  }
  saveSession(session)
  return session
}

// Cargar jugadores de una sala
export async function fetchPlayers(roomId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', roomId)
    .order('seat_order')
  if (error) throw new Error(error.message)
  return data ?? []
}

// Cargar sala por código
export async function fetchRoomByCode(code: string): Promise<Room | null> {
  const { data } = await supabase
    .from('rooms')
    .select('id,code,status,host_id,max_players,created_at,updated_at,is_private')
    .eq('code', code.toUpperCase())
    .single()
  return data ?? null
}

// Cargar game state
export async function fetchGameState(roomId: string): Promise<GameState | null> {
  const { data } = await supabase
    .from('game_state')
    .select('*')
    .eq('room_id', roomId)
    .single()
  return data ?? null
}

// Heartbeat — llamar cada 10s mientras la pestaña está abierta
export async function sendHeartbeat(playerId: string) {
  await supabase.rpc('heartbeat', { p_player_id: playerId })
}

// Listar salas públicas disponibles (para el modal de búsqueda)
export interface PublicRoom {
  room_id:      string
  room_code:    string
  player_count: number
  max_players:  number
  created_at:   string
}

export async function listPublicRooms(): Promise<PublicRoom[]> {
  await ensureAnonSession()
  const { data, error } = await supabase.rpc('list_public_rooms')
  if (error || data?.error) throw new Error(error?.message ?? data.error)
  return (data as PublicRoom[]) ?? []
}
