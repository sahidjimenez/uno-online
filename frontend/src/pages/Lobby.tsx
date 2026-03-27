import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchPlayers } from '../services/room.service'
import type { LocalSession, Player } from '../types'

interface Props {
  session:   LocalSession
  onStart:   () => void
  onLeave:   () => void
}

const AVATAR_COLORS = [
  'bg-uno-red','bg-uno-blue','bg-uno-green','bg-uno-yellow',
  'bg-purple-500','bg-orange-500','bg-pink-500','bg-teal-500',
]

export function Lobby({ session, onStart, onLeave }: Props) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchPlayers(session.roomId).then(setPlayers)

    const sub = supabase
      .channel(`lobby:${session.roomId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'players',
        filter: `room_id=eq.${session.roomId}`,
      }, () => {
        fetchPlayers(session.roomId).then(setPlayers)
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms',
        filter: `id=eq.${session.roomId}`,
      }, payload => {
        if ((payload.new as any).status === 'playing') onStart()
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [session, onStart])

  const isHost = players[0]?.id === session.playerId
  const canStart = players.length >= 2

  async function handleStart() {
    setLoading(true)
    // El host inicia — la Edge Function maneja repartir cartas y cambiar status
    await supabase.functions.invoke('start-game', {
      body: { room_id: session.roomId, player_id: session.playerId },
    })
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col px-6 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onLeave} className="text-gray text-sm hover:text-white transition-colors">
          ← Salir
        </button>
        <h1 className="text-white font-bold text-lg">Sala de Espera</h1>
        <div className="w-12" />
      </div>

      {/* Código */}
      <div className="bg-surface rounded-2xl p-5 text-center mb-6">
        <p className="text-gray text-xs uppercase tracking-widest mb-1">Código de sala</p>
        <p className="text-uno-yellow text-4xl font-black tracking-widest">{session.roomCode}</p>
        <p className="text-gray text-xs mt-2">Comparte este código con tus amigos</p>
      </div>

      {/* Lista jugadores */}
      <p className="text-gray text-xs mb-3">Jugadores ({players.length}/8)</p>
      <div className="flex flex-col gap-2 flex-1">
        {players.map((p, i) => (
          <div key={p.id} className="bg-surface rounded-xl px-4 py-3 flex items-center gap-3">
            <div className={`${AVATAR_COLORS[i % AVATAR_COLORS.length]} w-9 h-9 rounded-full`} />
            <span className="text-white font-bold text-sm flex-1">{p.name}</span>
            {i === 0 && (
              <span className="bg-uno-green text-white text-[10px] font-bold px-2 py-0.5 rounded-md">HOST</span>
            )}
            {p.id === session.playerId && i !== 0 && (
              <span className="text-gray text-[10px]">Tú</span>
            )}
          </div>
        ))}
        {/* Slot "Esperando" siempre visible si hay espacio */}
        {players.length < 8 && (
          <div className="bg-surface rounded-xl px-4 py-3 flex items-center gap-3 opacity-50">
            <div className="w-9 h-9 rounded-full bg-surface2 border border-dashed border-border" />
            <span className="text-gray text-sm">Esperando jugadores…</span>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="mt-6">
        {!canStart && (
          <p className="text-gray text-xs text-center mb-3">Mínimo 2 jugadores para iniciar</p>
        )}
        {isHost ? (
          <button
            onClick={handleStart}
            disabled={!canStart || loading}
            className="w-full bg-uno-green text-white font-bold py-4 rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-40"
          >
            {loading ? 'Iniciando…' : '¡Iniciar Partida!'}
          </button>
        ) : (
          <p className="text-gray text-sm text-center">Esperando al host para iniciar…</p>
        )}
      </div>
    </div>
  )
}
