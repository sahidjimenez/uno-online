import { useState } from 'react'
import { createRoom, joinRoom } from '../services/room.service'
import type { LocalSession } from '../types'

interface Props {
  onEnter: (session: LocalSession, mode: 'lobby') => void
}

export function Home({ onEnter }: Props) {
  const [name,    setName]    = useState('')
  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleCreate() {
    if (!name.trim()) return setError('Escribe tu nombre')
    setLoading(true); setError('')
    try {
      const session = await createRoom(name.trim())
      onEnter(session, 'lobby')
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  async function handleJoin() {
    if (!name.trim()) return setError('Escribe tu nombre')
    if (code.trim().length < 6) return setError('El código debe tener 6 caracteres')
    setLoading(true); setError('')
    try {
      const session = await joinRoom(code.trim(), name.trim())
      onEnter(session, 'lobby')
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-8">

      {/* Logo */}
      <div className="bg-uno-red rounded-[20px] w-40 h-20 flex items-center justify-center mb-4 shadow-[0_8px_24px_rgba(220,38,38,0.55)]">
        <span className="text-white text-5xl font-black">UNO</span>
      </div>
      <p className="text-gray text-sm mb-8">Multijugador en tiempo real</p>

      {/* Campo de nombre */}
      <input
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-gray text-sm mb-6 outline-none focus:border-uno-yellow"
        placeholder="Tu nombre de jugador"
        maxLength={20}
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <div className="w-full h-px bg-border mb-6" />

      {/* Crear sala */}
      <p className="text-gray text-xs w-full mb-2">Nueva partida</p>
      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full bg-uno-red text-white font-bold py-3 rounded-xl mb-4 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
      >
        {loading ? 'Creando…' : '+ Crear Sala'}
      </button>

      <p className="text-gray text-xs mb-3">— o ingresa un código —</p>

      {/* Unirse */}
      <p className="text-gray text-xs w-full mb-2">Código de sala</p>
      <input
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-gray text-sm mb-3 outline-none focus:border-uno-yellow uppercase tracking-widest"
        placeholder="Ej: A7F3K2"
        maxLength={6}
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
      />
      <button
        onClick={handleJoin}
        disabled={loading}
        className="w-full bg-surface text-white font-bold py-3 rounded-xl mb-6 hover:bg-surface2 active:scale-95 transition-all border border-border disabled:opacity-50"
      >
        {loading ? 'Uniéndose…' : 'Unirse a la partida →'}
      </button>

      {error && <p className="text-uno-red text-sm text-center">{error}</p>}

      <p className="text-gray text-xs mt-8">2 – 8 jugadores · Instala como PWA</p>
    </div>
  )
}
