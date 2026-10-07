import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LocalSession, Player } from '../types'

const EMOJIS = [
  { emoji: '😂', label: 'Me da risa' }, { emoji: '🔥', label: 'Buena jugada' },
  { emoji: '😱', label: 'Sorpresa' }, { emoji: '😎', label: 'Confianza' },
  { emoji: '👏', label: 'Aplausos' }, { emoji: '💚', label: 'Me encanta' },
]
interface Reaction { id: string; playerId: string; emoji: string; time: number }
export function ReactionBar({ session, players, local = false }: { session: LocalSession; players: Player[]; local?: boolean }) {
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [ready, setReady] = useState(local)
  const [cooldown, setCooldown] = useState(false)
  const [error, setError] = useState('')
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const lastSent = useRef(0)
  useEffect(() => {
    if (local) return
    const channel = supabase.channel(`reactions:${session.roomId}`, { config: { broadcast: { self: false, ack: true } } })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        if (!payload || typeof payload.id !== 'string' || typeof payload.playerId !== 'string' || !EMOJIS.some(item => item.emoji === payload.emoji)) return
        setReactions(current => {
          const now = Date.now()
          if (current.some(r => r.id === payload.id || (r.playerId === payload.playerId && now - r.time < 1000))) return current
          return [...current, { id: payload.id, playerId: payload.playerId, emoji: payload.emoji, time: now }].slice(-6)
        })
      }).subscribe(status => setReady(status === 'SUBSCRIBED'))
    channelRef.current = channel
    return () => { channelRef.current = null; void supabase.removeChannel(channel) }
  }, [local, session.roomId])
  useEffect(() => {
    if (!reactions.length) return
    const timer = setTimeout(() => setReactions(current => current.filter(r => Date.now() - r.time < 3500)), 3500 - Math.min(3500, Date.now() - reactions[0].time))
    return () => clearTimeout(timer)
  }, [reactions])
  useEffect(() => {
    if (!cooldown) return
    const timer = setTimeout(() => setCooldown(false), 1200)
    return () => clearTimeout(timer)
  }, [cooldown])
  async function react(emoji: string) {
    if (!ready || Date.now() - lastSent.current < 1200) return
    lastSent.current = Date.now()
    setCooldown(true)
    setError('')
    const reaction = { id: crypto.randomUUID(), playerId: session.playerId, emoji, time: Date.now() }
    setReactions(current => [...current, reaction].slice(-6))
    if (!local && channelRef.current) {
      try {
        const status = await channelRef.current.send({ type: 'broadcast', event: 'reaction', payload: reaction })
        if (status !== 'ok') setError('No se pudo compartir la reacción')
      } catch { setError('No se pudo compartir la reacción') }
    }
  }
  return <>
    <div className="reaction-stream" aria-live="polite" aria-atomic="false">
      {reactions.map(reaction => {
        const player = players.find(p => p.id === reaction.playerId)
        return player ? <div key={reaction.id} className="reaction-bubble"><span>{reaction.emoji}</span><strong>{player.id === session.playerId ? 'Tú' : player.name}</strong></div> : null
      })}
    </div>
    <div className="reaction-bar" aria-label="Reacciones">
      <span className="reaction-label">Reacciona</span>
      <div>{EMOJIS.map(({ emoji, label }) => <button key={emoji} aria-label={label} title={label} disabled={!ready || cooldown} onClick={() => void react(emoji)}>{emoji}</button>)}</div>
      {error && <p role="status">{error}</p>}
    </div>
  </>
}
