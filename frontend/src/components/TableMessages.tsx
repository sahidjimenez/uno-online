import { useCallback, useEffect, useRef, useState } from 'react'
import { ReactionBar, type Reaction } from './ReactionBar'
import { VoiceNotes, VoiceMessage, type Note } from './VoiceNotes'
import type { LocalSession, Player } from '../types'

type Message = { kind: 'reaction'; data: Reaction; expiresAt: number } | { kind: 'voice'; data: Note; expiresAt: number }
export function TableMessages({ session, players, local }: { session: LocalSession; players: Player[]; local: boolean }) {
  const [messages, setMessages] = useState<Message[]>([])
  const list = useRef<HTMLDivElement>(null)
  const reaction = useCallback((data: Reaction) => {
    setMessages(current => [...current.filter(m => m.expiresAt > Date.now()), { kind: 'reaction', data, expiresAt: data.time + 3500 }])
  }, [])
  const voice = useCallback((data: Note) => {
    setMessages(current => [...current.filter(m => m.expiresAt > Date.now() && !(m.kind === 'voice' && m.data.playerId === data.playerId)), { kind: 'voice', data, expiresAt: data.expiresAt }])
  }, [])
  useEffect(() => {
    const timer = setInterval(() => setMessages(current => current.some(m => m.expiresAt <= Date.now()) ? current.filter(m => m.expiresAt > Date.now()) : current), 250)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight }, [messages])
  return <>
    <div ref={list} className="table-message-stream" aria-live="polite" aria-atomic="false">
      {messages.map(message => {
        const player = players.find(p => p.id === message.data.playerId)
        if (!player) return null
        const name = player.id === session.playerId ? 'Tú' : player.name
        return message.kind === 'voice' ? <VoiceMessage key={message.data.id} note={message.data} name={name} />
          : <div key={message.data.id} className="reaction-bubble"><span>{message.data.emoji}</span><strong>{name}</strong></div>
      })}
    </div>
    <ReactionBar session={session} players={players} local={local} onReaction={reaction} />
    <VoiceNotes session={session} players={players} local={local} onNote={voice} />
  </>
}
