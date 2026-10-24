import { useRef, useState } from 'react'

export function NexoButton({ announced, onAnnounce }: { announced: boolean; onAnnounce: () => Promise<boolean> }) {
  const inFlight = useRef(false)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  async function announce() {
    if (announced || inFlight.current) return
    inFlight.current = true
    setPending(true)
    setFailed(false)
    try { setFailed(!await onAnnounce()) }
    catch { setFailed(true) }
    finally { inFlight.current = false; setPending(false) }
  }
  return <button type="button" onClick={announce} disabled={announced || pending}
    className="table-uno-button" aria-live="polite" aria-busy={pending}>
    {announced ? '¡NEXO anunciado!' : pending ? 'Anunciando…' : '¡NEXO!'}
    <span>{announced ? 'Tu aviso quedó registrado' : failed ? 'No se confirmó. Pulsa para reintentar' : 'Pulsa ahora al quedarte con una carta'}</span>
  </button>
}
