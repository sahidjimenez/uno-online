import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isVoicePacket, MAX_VOICE_BYTES, VOICE_COOLDOWN, VOICE_TTL, type VoicePacket } from '../lib/voiceNotes'
import type { LocalSession, Player } from '../types'
export interface Note extends VoicePacket { url: string }
interface Draft { blob: Blob; url: string; duration: number }
export function VoiceNotes({ session, players, local, onNote }: { session: LocalSession; players: Player[]; local: boolean; onNote: (note: Note) => void }) {
  const onNoteRef = useRef(onNote)
  onNoteRef.current = onNote
  const [sent, setSent] = useState(false)
  const [open, setOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [ready, setReady] = useState(local)
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(false)
  const [error, setError] = useState('')
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const members = useRef(players.map(p => p.id))
  const mounted = useRef(true)
  const cancelled = useRef(false)
  const started = useRef(0)
  const lastSent = useRef(0)
  const received = useRef(new Map<string, number>())
  const urls = useRef(new Set<string>())
  useEffect(() => { members.current = players.map(p => p.id) }, [players])
  function release(url: string) { URL.revokeObjectURL(url); urls.current.delete(url) }
  function makeUrl(blob: Blob) { const url = URL.createObjectURL(blob); urls.current.add(url); return url }
  function stopTracks() { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null }
  function stop(cancel = false) {
    cancelled.current = cancel
    if (recorder.current?.state === 'recording') { setFinishing(true); recorder.current.stop() }
    stopTracks()
    setRecording(false)
    if (cancel && draft) { release(draft.url); setDraft(null) }
  }
  function receive(packet: VoicePacket) {
    const now = Date.now()
    if (!isVoicePacket(packet, members.current, now)) return
    const recent = received.current.get(packet.playerId) ?? 0
    if (now - recent < VOICE_COOLDOWN) return
    received.current.set(packet.playerId, now)
    try {
      const bytes = Uint8Array.from(atob(packet.audio), char => char.charCodeAt(0))
      if (bytes.length > MAX_VOICE_BYTES) return
      const url = makeUrl(new Blob([bytes], { type: packet.mime }))
      onNoteRef.current({ ...packet, url })
      setNotes(current => {
        const kept = current.filter(note => note.playerId !== packet.playerId)
        current.filter(note => note.playerId === packet.playerId).forEach(note => release(note.url))
        return [...kept, { ...packet, url }].slice(-8)
      })
    } catch { /* Ignore malformed clips. */ }
  }
  useEffect(() => {
    mounted.current = true
    if (!local) {
      const sub = supabase.channel(`voice-notes:${session.roomId}`, { config: { broadcast: { self: false, ack: true } } })
        .on('broadcast', { event: 'voice-note' }, ({ payload }) => receive(payload))
        .subscribe(status => { if (mounted.current) setReady(status === 'SUBSCRIBED') })
      channel.current = sub
    }
    const expire = setInterval(() => {
      setNotes(current => {
        const expired = current.filter(note => note.expiresAt <= Date.now())
        if (!expired.length) return current
        expired.forEach(note => release(note.url))
        return current.filter(note => note.expiresAt > Date.now())
      })
    }, 500)
    const hide = () => {
      if (document.hidden) {
        cancelled.current = true
        if (recorder.current?.state === 'recording') recorder.current.stop()
        stopTracks()
        setRecording(false)
      }
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      mounted.current = false; cancelled.current = true
      if (recorder.current?.state === 'recording') recorder.current.stop()
      stopTracks()
      clearInterval(expire)
      document.removeEventListener('visibilitychange', hide)
      if (channel.current) void supabase.removeChannel(channel.current)
      channel.current = null
      urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear()
    }
  }, [session.roomId, local])
  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => {
      const elapsed = (Date.now() - started.current) / 1000
      setSeconds(Math.min(10, elapsed))
      if (elapsed >= 10) stop()
    }, 100)
    return () => clearInterval(timer)
  }, [recording])
  useEffect(() => {
    if (!cooldown) return
    const timer = setTimeout(() => setCooldown(false), VOICE_COOLDOWN)
    return () => clearTimeout(timer)
  }, [cooldown])
  async function record() {
    if (requesting || recording || finishing || draft) return
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError('Este navegador no permite grabar aquí. Abre el juego con HTTPS o localhost.'); return }
    setError(''); setRequesting(true); cancelled.current = false
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mounted.current || cancelled.current || document.hidden) { media.getTracks().forEach(track => track.stop()); return }
      stream.current = media
      const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type))
      if (!mime) throw new Error('No hay formato de grabación compatible')
      const rec = new MediaRecorder(media, { mimeType: mime, audioBitsPerSecond: 24000 })
      recorder.current = rec
      const chunks: Blob[] = []
      let size = 0
      rec.ondataavailable = event => {
        if (!event.data.size) return
        size += event.data.size
        if (size > MAX_VOICE_BYTES) {
          cancelled.current = true
          if (rec.state === 'recording') rec.stop()
          stopTracks()
          if (mounted.current) { setRecording(false); setError('El audio es demasiado grande. Graba un mensaje más corto.') }
          return
        }
        chunks.push(event.data)
      }
      rec.onerror = () => { cancelled.current = true; stopTracks(); if (mounted.current) { setRecording(false); setError('No se pudo grabar el audio.') } }
      rec.onstop = () => {
        if (mounted.current) setFinishing(false)
        stopTracks()
        if (!mounted.current || cancelled.current) return
        const duration = Math.min(10, (Date.now() - started.current) / 1000)
        const blob = new Blob(chunks, { type: rec.mimeType })
        if (!blob.size || duration < .3) { setError('Graba un mensaje un poco más largo.'); return }
        setDraft({ blob, duration, url: makeUrl(blob) })
        setRecording(false)
      }
      started.current = Date.now(); setSeconds(0); setRecording(true)
      rec.start(250)
    } catch { stopTracks(); if (mounted.current) setError('No pudimos grabar. Revisa el permiso del micrófono y vuelve a intentar.') }
    finally { if (mounted.current) setRequesting(false) }
  }
  async function send() {
    if (!draft || sending || !ready || Date.now() - lastSent.current < VOICE_COOLDOWN) return
    setSending(true); setError(''); setSent(false)
    try {
      const bytes = new Uint8Array(await draft.blob.arrayBuffer())
      let binary = ''; bytes.forEach(byte => { binary += String.fromCharCode(byte) })
      const packet: VoicePacket = { id: crypto.randomUUID(), playerId: session.playerId, audio: btoa(binary), mime: draft.blob.type, duration: draft.duration, expiresAt: Date.now() + VOICE_TTL }
      if (!local) {
        if (!channel.current) throw new Error('Sin conexión')
        const result = await channel.current.send({ type: 'broadcast', event: 'voice-note', payload: packet })
        if (result !== 'ok') throw new Error('No enviado')
      }
      if (!mounted.current) return
      receive(packet)
      lastSent.current = Date.now(); setCooldown(true)
      release(draft.url); setDraft(null); setSent(true)
    } catch { if (mounted.current) setError('No se pudo enviar. Tu grabación sigue disponible para reintentar.') }
    finally { if (mounted.current) setSending(false) }
  }
  return <aside className="voice-notes">
    <button className="voice-toggle" onClick={() => { if (open) stop(true); setOpen(value => !value) }} aria-expanded={open}>🎙 Notas de voz {notes.length > 0 && <span>{notes.length}</span>}</button>
    {open && <div className="voice-composer">
      <strong>Un mensaje para la mesa</strong><p>Hasta 10 s · desaparece en 60 s</p>
      {local && <p className="voice-local-hint">En modo local puedes probar tu grabación.</p>}
      {recording ? <><div className="voice-recording" role="status">● Grabando · {seconds.toFixed(1)} / 10 s</div><button onClick={() => stop()}>Detener</button><button onClick={() => stop(true)}>Cancelar</button></> : draft ? <><ClipAudio url={draft.url} label="Escuchar mi grabación" /><div className="voice-actions"><button disabled={sending || !ready || cooldown} onClick={() => void send()}>{sending ? 'Enviando…' : 'Enviar'}</button><button disabled={sending} onClick={() => stop(true)}>Descartar</button></div></> : <button disabled={requesting || finishing || !ready || cooldown} onClick={() => void record()}>{requesting ? 'Esperando permiso…' : finishing ? 'Preparando audio…' : cooldown ? 'Espera unos segundos…' : 'Grabar mensaje'}</button>}
      {requesting && <button onClick={() => { cancelled.current = true }}>Cancelar solicitud</button>}
      {!ready && <p role="status">Conectando con las notas de la mesa…</p>}
      {sent && <p role="status">✓ Nota enviada a las reacciones de la mesa</p>}
      {error && <p className="voice-error" role="alert">{error}</p>}
    </div>}

  </aside>
}
export function VoiceMessage({ note, name }: { note: Note; name: string }) {
  const [remaining, setRemaining] = useState(Math.ceil((note.expiresAt - Date.now()) / 1000))
  useEffect(() => { const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((note.expiresAt - Date.now()) / 1000))), 1000); return () => clearInterval(timer) }, [note.expiresAt])
  return <div className="voice-message"><div><strong>🎙 {name}</strong><span>{remaining} s restantes</span></div><ClipAudio autoplay url={note.url} label={`Nota de voz de ${name}`} /></div>
}

function ClipAudio({ url, label, autoplay = false }: { url: string; label: string; autoplay?: boolean }) {
  const [blocked, setBlocked] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const element = audio.current
    let active = true
    if (autoplay && element) void element.play().catch(() => { if (active) setBlocked(true) })
    return () => { active = false; if (element) { element.pause(); element.removeAttribute('src'); element.load() } }
  }, [url, autoplay])
  return <><audio ref={audio} controls src={url} preload={autoplay ? 'auto' : 'none'} aria-label={label} onPlay={() => setBlocked(false)} />
    {blocked && <p className="voice-autoplay-hint">Pulsa ▶ para escuchar; el navegador bloqueó la reproducción automática.</p>}</>

}
