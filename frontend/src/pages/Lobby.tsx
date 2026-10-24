import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { requestDeadline } from '../lib/requestDeadline'
import { fetchGameState } from '../services/room.service'
import type { LocalSession, Player } from '../types'
interface Props { session: LocalSession; onStart: () => void; onLeave: () => void }
const AVATARS = ['🧑🏽', '👩🏻', '🧔🏽', '👩🏽', '🧑🏻', '👨🏾', '👩🏼', '🧑🏾']
export function Lobby({ session, onStart, onLeave }: Props) {
  const [players, setPlayers] = useState<Player[]>([])
  const [hostId, setHostId] = useState<string | null>(null)
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const startRef = useRef(onStart)
  useEffect(() => { startRef.current = onStart }, [onStart])
  useEffect(() => {
    let active = true, pending = false
    const refresh = async () => {
      if (pending || !active) return
      pending = true
      try {
        const { data, error } = await requestDeadline(signal => supabase.rpc('room_snapshot', { p_room: session.roomId }).abortSignal(signal))
        if (!active) return
        if (error || !data) { setError('No pudimos actualizar los jugadores'); return }
        setPlayers(data.players); setHostId(data.room.host_id); setMaxPlayers(data.room.max_players)
        if (data.gameState.status === 'playing') startRef.current()
      } finally { pending = false }
    }
    void refresh().catch(() => { if (active) setError('No pudimos actualizar los jugadores') })
    const sub = supabase.channel(`lobby:${session.roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${session.roomId}` }, () => { void refresh().catch(() => { if (active) setError('No pudimos actualizar los jugadores') }) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${session.roomId}` }, payload => { if (payload.new.status === 'playing') startRef.current() })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          void refresh().catch(() => { if (active) setError('No pudimos actualizar los jugadores') })
        }
      })
    const pulse = () => {
      void requestDeadline(signal => supabase.rpc('heartbeat', { p_player_id: session.playerId }).abortSignal(signal)).catch(() => {})
      void refresh().catch(() => {})
    }
    pulse()
    const timer = setInterval(pulse, 10000)
    return () => { active = false; clearInterval(timer); void supabase.removeChannel(sub) }
  }, [session.roomId, session.playerId])
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  const isHost = hostId === session.playerId
  const canStart = players.length >= 2 && players.every(p => p.is_connected)
  async function handleStart() {
    setLoading(true); setError('')
    try {
      const { error: invokeError } = await supabase.functions.invoke('start-game', { body: { room_id: session.roomId, player_id: session.playerId, request_id: crypto.randomUUID() } })
      if (invokeError) throw invokeError
      const state = await fetchGameState(session.roomId)
      if (state?.status === 'playing') onStart()
      else setError('La partida no pudo iniciar. Inténtalo de nuevo.')
    } catch { setError('No pudimos iniciar la partida. Revisa la conexión e inténtalo de nuevo.') }
    finally { setLoading(false) }
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(session.roomCode); setCopied(true) }
    catch { setError('No se pudo copiar. Puedes seleccionar el código de la mesa.') }
  }
  async function leave() {
    setLoading(true); setError('')
    try {
      const { error } = await supabase.rpc('leave_waiting_room', { p_room: session.roomId })
      if (error) throw error
      onLeave()
    } catch { setError('No pudimos salir; si la partida comenzó, vuelve a la mesa.') }
    finally { setLoading(false) }
  }
  return <main className="multiplayer-lobby">
    <header className="lobby-header"><button disabled={loading} onClick={() => void leave()}>← Salir de la mesa</button><div className="table-brand"><strong>NEXO</strong></div><span>Multijugador</span></header>
    <div className="lobby-layout">
      <section className="lobby-invite">
        <p className="multiplayer-eyebrow">TU PRÓXIMA PARTIDA EMPIEZA AQUÍ</p>
        <h1>Un lugar para<br />cada jugador.</h1>
        <p>Comparte el código con tus amigos. Con dos jugadores conectados, el anfitrión puede abrir la partida.</p>
        <div className="invite-code"><span>CÓDIGO DE LA MESA</span><strong>{session.roomCode}</strong><button onClick={() => void copyCode()}>{copied ? '✓ Copiado' : 'Copiar código ↗'}</button></div>
        <div className="lobby-table-preview" aria-hidden="true"><span>◇</span><i /><i /><i /></div>
      </section>
      <section className="lobby-player-card">
        <div className="lobby-player-heading"><h2>En la mesa</h2><span>{players.length} / {maxPlayers}</span></div>
        <div className="lobby-roster">{players.map((player, index) => <div className={`lobby-player ${!player.is_connected ? 'disconnected' : ''}`} key={player.id}>
          <span className="seat-avatar" aria-hidden="true">{AVATARS[index]}</span>
          <div><strong>{player.name}{player.id === session.playerId && ' · Tú'}</strong><span><i />{player.is_connected ? 'Conectado' : 'Sin conexión'}</span></div>
          {player.id === hostId && <em>Anfitrión</em>}
        </div>)}
        {players.length < maxPlayers && <div className="lobby-empty-seat"><span>＋</span><div>Hay sitio para alguien más<small>Invítalo con el código de la mesa</small></div></div>}
        </div>
        <div className="lobby-start-area">
          {error && <p role="alert" className="lobby-error">{error}</p>}
          <p>{canStart ? 'La mesa está lista para jugar' : 'Esperando al menos a 2 jugadores conectados'}</p>
          {isHost ? <button className="local-start-button" onClick={() => void handleStart()} disabled={!canStart || loading}>{loading ? 'Preparando cartas…' : 'Abrir la partida →'}</button> : <div className="lobby-waiting">◷ El anfitrión iniciará la partida</div>}
        </div>
      </section>
    </div>
  </main>
}
