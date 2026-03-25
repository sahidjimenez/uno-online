import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchGameState, fetchPlayers, sendHeartbeat } from '../services/room.service'
import type { GameState, Player, Card, GameEvent, LocalSession } from '../types'

export function useGame(session: LocalSession | null) {
  const [gameState,  setGameState]  = useState<GameState  | null>(null)
  const [players,    setPlayers]    = useState<Player[]>([])
  const [myHand,     setMyHand]     = useState<Card[]>([])
  const [lastEvent,  setLastEvent]  = useState<GameEvent  | null>(null)
  const [loading,    setLoading]    = useState(true)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadMyHand = useCallback(async () => {
    if (!session) return
    const { data } = await supabase
      .from('hands')
      .select('*')
      .eq('player_id', session.playerId)
      .order('created_at')
    setMyHand(data ?? [])
  }, [session])

  const loadAll = useCallback(async () => {
    if (!session) return
    const [gs, ps] = await Promise.all([
      fetchGameState(session.roomId),
      fetchPlayers(session.roomId),
    ])
    if (gs) setGameState(gs)
    if (ps) setPlayers(ps)
    await loadMyHand()
    setLoading(false)
  }, [session, loadMyHand])

  useEffect(() => {
    if (!session) return
    loadAll()

    // Realtime — game_state
    const gsSub = supabase
      .channel(`gs:${session.roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'game_state',
        filter: `room_id=eq.${session.roomId}`,
      }, payload => {
        setGameState(payload.new as GameState)
      })
      .subscribe()

    // Realtime — players (conexiones, UNO cantado)
    const plSub = supabase
      .channel(`pl:${session.roomId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'players',
        filter: `room_id=eq.${session.roomId}`,
      }, () => {
        fetchPlayers(session.roomId).then(ps => setPlayers(ps))
      })
      .subscribe()

    // Realtime — events (para animaciones y actualizar mano)
    const evSub = supabase
      .channel(`ev:${session.roomId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'events',
        filter: `room_id=eq.${session.roomId}`,
      }, payload => {
        const ev = payload.new as GameEvent
        setLastEvent(ev)
        // Recargar mano cuando se juega o roba una carta
        if (ev.type === 'card_played' || ev.type === 'card_drawn') {
          loadMyHand()
        }
      })
      .subscribe()

    // Heartbeat cada 10s
    heartbeatRef.current = setInterval(() => {
      sendHeartbeat(session.playerId)
    }, 10_000)

    return () => {
      supabase.removeChannel(gsSub)
      supabase.removeChannel(plSub)
      supabase.removeChannel(evSub)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [session, loadAll, loadMyHand])

  const isMyTurn = gameState?.current_player_id === session?.playerId

  return { gameState, players, myHand, lastEvent, loading, isMyTurn, loadMyHand }
}
