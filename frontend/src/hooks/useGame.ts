import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { requestDeadline } from '../lib/requestDeadline'
import type { GameState, Player, Card, GameEvent, LocalSession } from '../types'

export function useOnlineGame(session: LocalSession | null) {
  const [snapshot, setSnapshot] = useState<{ gameState: GameState | null; players: Player[]; myHand: Card[] }>({ gameState: null, players: [], myHand: [] })
  const [lastEvent, setLastEvent] = useState<GameEvent | null>(null)
  const [unoPenalty, setUnoPenalty] = useState<GameEvent | null>(null)
  const [cardPlay, setCardPlay] = useState<GameEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const refreshRef = useRef<() => Promise<boolean>>(async () => false)
  const refreshGame = useCallback(() => refreshRef.current(), [])
  const roomId = session?.roomId, playerId = session?.playerId
  useEffect(() => {
    if (!roomId || !playerId) return
    let disposed = false, active: Promise<boolean> | null = null, dirty = false
    const refresh = (): Promise<boolean> => {
      if (disposed) return Promise.resolve(false)
      if (active) { dirty = true; return active }
      setSyncing(true)
      active = (async () => {
        await Promise.resolve()
        try {
          let attempts = 0
          do {
            dirty = false
            if (!navigator.onLine) throw new Error('Sin conexión. Conservamos tu mesa y reintentaremos al volver internet.')
            const next = await requestDeadline(async signal => {
              const gs = await supabase.from('game_state').select('*').eq('room_id', roomId).abortSignal(signal).single()
              const [ps, hand] = await Promise.all([
                supabase.from('players').select('*').eq('room_id', roomId).order('seat_order').abortSignal(signal),
                supabase.from('hands').select('*').eq('player_id', playerId).order('created_at').abortSignal(signal),
              ])
              if (gs.error || ps.error || hand.error || !gs.data) throw new Error('No pudimos actualizar la mesa. Estamos intentando reconectar.')
              const check = await supabase.from('game_state').select('version').eq('room_id', roomId).abortSignal(signal).single()
              if (check.error) throw check.error
              if (check.data.version !== gs.data.version) return null
              return { gameState: gs.data as GameState, players: ps.data as Player[], myHand: hand.data as Card[] }
            })
            if (disposed) return false
            if (!next) { dirty = true; continue }
            setSnapshot(current => current.gameState && current.gameState.version > next.gameState.version ? current : next)
            setSyncError(null)
          } while (dirty && !disposed && ++attempts < 3)
          if (dirty) throw new Error('La mesa está cambiando. Volveremos a sincronizarla.')
          return true
        } catch (error) {
          if (!disposed) setSyncError(error instanceof Error ? error.message : 'No pudimos actualizar la mesa. Reintentaremos automáticamente.')
          return false
        } finally {
          active = null
          if (!disposed) { setLoading(false); setSyncing(false) }
        }
      })()
      return active
    }
    refreshRef.current = refresh
    const resync = () => { void refresh() }
    const onVisibility = () => { if (!document.hidden) resync() }
    const onOffline = () => setSyncError('Sin conexión. Conservamos tu mesa y reintentaremos al volver internet.')
    const channel = supabase.channel(`game-recovery:${roomId}:${playerId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state', filter: `room_id=eq.${roomId}` }, resync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, resync)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `room_id=eq.${roomId}` }, payload => {
        if (disposed) return
        const event = payload.new as GameEvent
        setLastEvent(event)
        if (event.payload.card) setCardPlay(event)
        if (event.type === 'uno_penalty') setUnoPenalty(event)
        resync()
      }).subscribe(status => {
        if (disposed) return
        if (status === 'SUBSCRIBED') resync()
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSyncError('Reconectando con la mesa… Comprobaremos las jugadas periódicamente.')
          resync()
        }
      })
    resync()
    const poll = setInterval(() => { if (!document.hidden) resync() }, 8000)
    let heartbeatPending = false
    const heartbeat = setInterval(() => {
      if (heartbeatPending || !navigator.onLine) return
      heartbeatPending = true
      void requestDeadline(signal => supabase.rpc('heartbeat', { p_player_id: playerId }).abortSignal(signal))
        .catch(() => {}).finally(() => { heartbeatPending = false })
    }, 10000)
    window.addEventListener('online', resync); window.addEventListener('offline', onOffline)
    window.addEventListener('focus', onVisibility); document.addEventListener('visibilitychange', onVisibility)
    return () => {
      disposed = true; refreshRef.current = async () => false
      clearInterval(poll); clearInterval(heartbeat); void supabase.removeChannel(channel)
      window.removeEventListener('online', resync); window.removeEventListener('offline', onOffline)
      window.removeEventListener('focus', onVisibility); document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [roomId, playerId])
  return { ...snapshot, lastEvent, unoPenalty, cardPlay, loading, syncError, syncing, refreshGame,
    isMyTurn: snapshot.gameState?.current_player_id === playerId, loadMyHand: refreshGame,
    localPlay: undefined, localDraw: undefined, localUno: undefined, localCatch: undefined }
}
