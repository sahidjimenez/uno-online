import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LocalSession, Player } from '../types'

const EMOJIS = [
  { emoji: '😂', label: 'Me da risa' }, { emoji: '🔥', label: 'Buena jugada' },
  { emoji: '😱', label: 'Sorpresa' }, { emoji: '😎', label: 'Confianza' },
  { emoji: '👏', label: 'Aplausos' }, { emoji: '💚', label: 'Me encanta' },
]
export interface Reaction { id: string; playerId: string; emoji: string; time: number }
export function ReactionBar({ session, players, local = false, onReaction }: { session: LocalSession; players: Player[]; local?: boolean; onReaction: (reaction: Reaction) => void }) {
  const receiveRef = useRef(onReaction)
  receiveRef.current = onReaction
  const recent = useRef(new Map<string, number>())
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
        const now = Date.now()
        if (now - (recent.current.get(payload.playerId) ?? 0) < 1000) return
        recent.current.set(payload.playerId, now)
        receiveRef.current({ id: payload.id, playerId: payload.playerId, emoji: payload.emoji, time: now })
      }).subscribe(status => setReady(status === 'SUBSCRIBED'))
    channelRef.current = channel
    return () => { channelRef.current = null; void supabase.removeChannel(channel) }
  }, [local, session.roomId])
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
    receiveRef.current(reaction)
    if (!local && channelRef.current) {
      try {
        const status = await channelRef.current.send({ type: 'broadcast', event: 'reaction', payload: reaction })
        if (status !== 'ok') setError('No se pudo compartir la reacción')
      } catch { setError('No se pudo compartir la reacción') }
    }
  }
  return <>
    <div className="reaction-bar" aria-label="Reacciones">
      <span className="reaction-label">Reacciona</span>
      <div>{EMOJIS.map(({ emoji, label }) => <button key={emoji} aria-label={label} title={label} disabled={!ready || cooldown} onClick={() => void react(emoji)}>{emoji}</button>)}</div>
      {error && <p role="status">{error}</p>}
    </div>
  </>
}
