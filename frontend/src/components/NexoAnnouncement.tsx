import { useEffect, useRef, useState } from 'react'
import type { GameEvent, Player } from '../types'

export function NexoAnnouncement({ event, players, myPlayerId }: {
  event: GameEvent | null; players: Player[]; myPlayerId: string
}) {
  const seen = useRef<string | null>(null)
  const [notice, setNotice] = useState<{ id: string; name: string } | null>(null)
  useEffect(() => {
    if (!event || event.type !== 'uno_called' || event.player_id === myPlayerId || seen.current === event.id) return
    const player = players.find(p => p.id === event.player_id)
    if (!player) return
    seen.current = event.id
    setNotice({ id: event.id, name: player.name })
  }, [event, players, myPlayerId])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timer)
  }, [notice])
  return notice && <div key={notice.id} className="nexo-announcement" role="status" aria-live="polite">
    <strong>{notice.name}: ¡NEXO!</strong>
    <span>Me queda una carta</span>
  </div>
}
