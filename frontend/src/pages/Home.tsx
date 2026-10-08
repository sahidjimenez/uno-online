import { useEffect, useRef, useState } from 'react'
import { createRoom, joinRoom, findPublicRoom, listPublicRooms } from '../services/room.service'
import type { PublicRoom } from '../services/room.service'
import type { LocalSession } from '../types'
import { CharacterCustomizer } from '../components/CharacterCustomizer'

interface Props {
  onEnter: (session: LocalSession, mode: 'lobby') => void
}

function RoomListModal({
  rooms,
  loading,
  error,
  onRefresh,
  onJoin,
  onCreate,
  onClose,
}: {
  rooms:     PublicRoom[]
  loading:   boolean
  error:     string
  onRefresh: () => void
  onJoin:    (room: PublicRoom) => void
  onCreate:  () => void
  onClose:   () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus() }
  }, [])
  function timeAgo(iso: string) {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
    if (!Number.isFinite(mins) || mins < 1) return 'Ahora mismo'
    return mins === 1 ? 'Hace 1 min' : `Hace ${mins} min`
  }
  return (
    <div className="room-browser-backdrop" onClick={onClose}>
      <div ref={dialogRef} className="room-browser" role="dialog" aria-modal="true" aria-labelledby="room-browser-title"
        onClick={event => event.stopPropagation()} onKeyDown={event => {
          if (event.key === 'Escape') { onClose(); return }
          if (event.key !== 'Tab') return
          const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
          if (!buttons?.length) return
          const first = buttons[0], last = buttons[buttons.length - 1]
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
        }}>
        <header className="room-browser-header">
          <div><p className="multiplayer-eyebrow">NEXO · MESAS ABIERTAS</p><h2 id="room-browser-title">Partidas disponibles</h2></div>
          <button className="room-browser-close" onClick={onClose} aria-label="Cerrar partidas disponibles">✕</button>
        </header>
        <p className="room-browser-intro">Encuentra tu lugar en la próxima mesa.</p>
        <div className="room-browser-toolbar"><span aria-live="polite">{loading ? 'Buscando mesas…' : `${rooms.length} ${rooms.length === 1 ? 'mesa disponible' : 'mesas disponibles'}`}</span>
          <button onClick={onRefresh} disabled={loading}><span className={loading ? 'room-refresh-spinning' : ''} aria-hidden="true">↻</span> Actualizar</button>
        </div>
        <div className="room-browser-list" aria-busy={loading}>
          {error && <div className="room-browser-error" role="alert">{error}<span>Intenta actualizar para volver a buscar.</span></div>}
          {loading && rooms.length === 0 && <div className="room-browser-empty" role="status"><span className="room-search-mark" aria-hidden="true">◇</span><strong>Buscando tu próxima partida</strong><p>Consultando las mesas abiertas…</p></div>}
          {!loading && !error && rooms.length === 0 && <div className="room-browser-empty"><span aria-hidden="true">◇</span><strong>La próxima mesa puede ser tuya</strong><p>No hay partidas abiertas por ahora.<br />Crea una sala e invita a tus amigos.</p></div>}
          {rooms.map(room => {
            const full = room.player_count >= room.max_players
            return <article key={room.room_id} className="available-room">
              <div className="available-room-mark" aria-hidden="true">◇</div>
              <div className="available-room-info"><strong>{room.room_code}</strong><span>{room.player_count} / {room.max_players} jugadores · {timeAgo(room.created_at)}</span>
                <div className="available-room-seats" aria-hidden="true">{Array.from({ length: Math.min(room.max_players, 8) }, (_, index) => <i key={index} className={index < room.player_count ? 'occupied' : ''} />)}</div>
              </div>
              <button onClick={() => onJoin(room)} disabled={full || loading} aria-label={`Unirse a la mesa ${room.room_code}`}>{full ? 'Llena' : 'Unirse ↗'}</button>
            </article>
          })}
        </div>
        <footer className="room-browser-footer"><button onClick={onCreate}>＋ Crear nueva sala</button><p>Tu mesa, tu código, tus amigos.</p></footer>
      </div>
    </div>
  )
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="room-browser-backdrop" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="rules-title" className="nexo-rules-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="rules-title" className="text-white font-black text-lg">Cómo jugar a NEXO</h2>
          <button onClick={onClose} aria-label="Cerrar reglas" className="room-browser-close">✕</button>
        </div>

        <Section title="🎯 Objetivo">
          <p>Ser el primero en quedarse sin cartas. Solo puedes ganar jugando una <strong>carta de número</strong> (0–9) como última carta.</p>
        </Section>

        <Section title="🃏 El mazo">
          <ul>
            <li>108 cartas en total</li>
            <li>4 colores: Rojo, Azul, Verde, Amarillo</li>
            <li>Números del 0 al 9 (×2 por color, excepto 0)</li>
            <li>Especiales: Salta, Reversa, +2 (×2 por color)</li>
            <li>Comodín (elige color) y Comodín +4 (×4 cada uno)</li>
          </ul>
        </Section>

        <Section title="▶️ Turno normal">
          <ul>
            <li>Juega una carta que coincida en <strong>color</strong> o <strong>tipo</strong> con la carta superior.</li>
            <li>Si no tienes carta jugable, roba 1 carta del mazo.</li>
            <li>Si la carta robada es jugable, puedes jugarla en el mismo turno.</li>
          </ul>
        </Section>

        <Section title="⚡ Cartas especiales">
          <ul>
            <li><strong>Salta:</strong> el siguiente jugador pierde su turno.</li>
            <li><strong>Reversa:</strong> invierte el sentido de juego. Con 2 jugadores actúa como Salta.</li>
            <li><strong>+2:</strong> el siguiente jugador roba 2 cartas y pierde su turno (a menos que contraataque).</li>
            <li><strong>Comodín:</strong> elige el color que quieras.</li>
            <li><strong>Comodín +4:</strong> elige color y el siguiente jugador roba 4 cartas.</li>
          </ul>
        </Section>

        <Section title="🔗 Apilamiento (+2 / +4)">
          <ul>
            <li>Puedes apilar +2 sobre otro +2 o +4.</li>
            <li>Puedes apilar +4 sobre cualquier stack activo.</li>
            <li>Una Reversa del color activo también puede contraatacar un stack, devolviendo la penalidad al jugador anterior.</li>
            <li>Si no puedes contraatacar, debes robar todas las cartas acumuladas.</li>
          </ul>
        </Section>

        <Section title="📢 Última carta">
          <ul>
            <li>Cuando te quede <strong>1 carta</strong>, debes gritar <strong>¡ÚLTIMA!</strong> antes de que otro jugador lo note.</li>
            <li>Si te pillan sin avisar de tu última carta, recibes <strong>4 cartas de penalización</strong> (regla europea).</li>
            <li>Si llega tu siguiente turno y aún no pulsaste <strong>¡ÚLTIMA!</strong>, robas automáticamente <strong>4 cartas</strong> y puedes continuar tu turno. El botón desaparece al avisar.</li>
          </ul>
        </Section>

        <Section title="🏆 Victoria">
          <ul>
            <li>Solo puedes ganar jugando una <strong>carta de número (0–9)</strong> como última carta.</li>
            <li>Si tu última carta es especial (Salta, Reversa, +2, Comodín, Comodín +4), <strong>no puedes ganarla</strong> — debes robar y continuar.</li>
          </ul>
        </Section>

        <Section title="🔒 Salas">
          <ul>
            <li><strong>Sala pública:</strong> cualquiera puede unirse con el código o mediante "Buscar Partida".</li>
            <li><strong>Sala privada:</strong> solo quienes tengan el código <em>y</em> la contraseña pueden entrar.</li>
          </ul>
        </Section>

        <button
          onClick={onClose}
          className="nexo-primary-button"
        >
          ¡Entendido!
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="rules-section-title">{title}</p>
      <div className="text-gray text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1 [&_strong]:text-white">
        {children}
      </div>
    </div>
  )
}

export function Home({ onEnter }: Props) {
  const [name,       setName]       = useState('')
  const [code,       setCode]       = useState('')
  const [password,   setPassword]   = useState('')
  const [joinPass,   setJoinPass]   = useState('')
  const [isPrivate,  setIsPrivate]  = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [showRules,  setShowRules]  = useState(false)
  const [tab,        setTab]        = useState<'create' | 'join' | 'find'>('find')
  const [showRoomList, setShowRoomList] = useState(false)
  const [publicRooms,  setPublicRooms]  = useState<PublicRoom[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [roomListError, setRoomListError] = useState('')

  async function handleCreate() {
    if (!name.trim()) return setError('Escribe tu nombre')
    setLoading(true); setError('')
    try {
      const session = await createRoom(name.trim(), isPrivate, isPrivate ? password : undefined)
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
      const session = await joinRoom(code.trim(), name.trim(), joinPass || undefined)
      onEnter(session, 'lobby')
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  async function handleFind() {
    if (!name.trim()) return setError('Escribe tu nombre')
    setLoading(true); setError('')
    try {
      const session = await findPublicRoom(name.trim())
      onEnter(session, 'lobby')
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  async function loadRooms() {
    setLoadingRooms(true)
    setRoomListError('')
    try {
      const rooms = await listPublicRooms()
      setPublicRooms(rooms)
    } catch {
      setRoomListError('No pudimos consultar las partidas disponibles.')
    } finally {
      setLoadingRooms(false)
    }
  }

  async function handleOpenFind() {
    if (!name.trim()) return setError('Escribe tu nombre')
    setError('')
    setShowRoomList(true)
    await loadRooms()
  }

  async function handleJoinFromModal(room: PublicRoom) {
    setShowRoomList(false)
    setLoading(true); setError('')
    try {
      const session = await joinRoom(room.room_code, name.trim())
      onEnter(session, 'lobby')
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  function handleCreateFromModal() {
    setShowRoomList(false)
    setTab('create')
  }

  return (
    <div className="multiplayer-home min-h-screen flex flex-col items-center justify-center px-6">

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {showRoomList && (
        <RoomListModal
          rooms={publicRooms}
          loading={loadingRooms}
          error={roomListError}
          onRefresh={loadRooms}
          onJoin={handleJoinFromModal}
          onCreate={handleCreateFromModal}
          onClose={() => setShowRoomList(false)}
        />
      )}

      <div className="multiplayer-card">
      <p className="multiplayer-eyebrow">JUEGA EN COMPAÑÍA</p>
      {/* Logo + botón reglas */}
      <div className="relative mb-4">
        <div className="multiplayer-logo">
          <span className="text-white text-5xl font-black">NEXO</span>
        </div>
        <button
          onClick={() => setShowRules(true)}
          className="absolute -top-2 -right-3 bg-surface border border-border text-gray text-[10px] font-bold px-2 py-1 rounded-lg hover:text-white hover:border-uno-yellow transition-colors"
          title="Ver reglas del juego"
        >
          ? Reglas
        </button>
      </div>
      <p className="text-gray text-sm mb-6">Crea una mesa, invita a tus amigos y cambia el rumbo.</p>

      <label htmlFor="online-name" className="online-input-label">Tu nombre en la mesa</label>
      {/* Campo de nombre */}
      <input
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-gray text-sm mb-5 outline-none focus:border-uno-yellow"
        id="online-name"
        placeholder="Tu nombre de jugador"
        maxLength={20}
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <CharacterCustomizer />
      {/* Tabs */}
      <div className="w-full flex bg-surface rounded-xl p-1 mb-5 gap-1">
        {([
          { id: 'find',   label: '🔍 Buscar' },
          { id: 'create', label: '+ Crear'   },
          { id: 'join',   label: '→ Unirse'  },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setError('') }}
            className={[
              'flex-1 text-xs font-bold py-2 rounded-lg transition-all',
              tab === t.id
                ? 'bg-uno-red text-white'
                : 'text-gray hover:text-white',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel: Buscar Partida */}
      {tab === 'find' && (
        <div className="w-full">
          <p className="text-gray text-xs mb-3 text-center">
            Descubre mesas abiertas y únete a la próxima partida.
          </p>
          <button
            onClick={handleOpenFind}
            disabled={loading}
            className="w-full bg-uno-yellow text-black font-black py-4 rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 text-base"
          >
            {loading ? 'Buscando…' : '🔍 Buscar Partida'}
          </button>
        </div>
      )}

      {/* Panel: Crear Sala */}
      {tab === 'create' && (
        <div className="w-full">
          {/* Toggle público / privado */}
          <div className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-3 mb-3">
            <div>
              <p className="text-white text-sm font-bold">{isPrivate ? '🔒 Sala privada' : '🌐 Sala pública'}</p>
              <p className="text-gray text-[10px] mt-0.5">
                {isPrivate ? 'Solo con código + contraseña' : 'Cualquiera puede unirse con el código'}
              </p>
            </div>
            <button
              role="switch" aria-checked={isPrivate} aria-label="Sala privada"
              onClick={() => { setIsPrivate(p => !p); setPassword('') }}
              className={[
                'w-11 h-6 rounded-full transition-colors relative',
                isPrivate ? 'bg-uno-red' : 'bg-border',
              ].join(' ')}
            >
              <span className={[
                'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                isPrivate ? 'translate-x-5' : 'translate-x-0',
              ].join(' ')} />
            </button>
          </div>

          {isPrivate && (
            <input
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-gray text-sm mb-3 outline-none focus:border-uno-yellow"
              aria-label="Contraseña de la nueva sala"
              placeholder="Contraseña de sala (opcional)"
              type="password"
              maxLength={30}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          )}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-uno-red text-white font-bold py-4 rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Creando…' : `+ Crear Sala ${isPrivate ? '🔒' : '🌐'}`}
          </button>
        </div>
      )}

      {/* Panel: Unirse */}
      {tab === 'join' && (
        <div className="w-full">
          <input
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-gray text-sm mb-3 outline-none focus:border-uno-yellow uppercase tracking-widest"
            aria-label="Código de sala"
            placeholder="Código de sala — ej: A7F3K2"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
          />
          <input
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-gray text-sm mb-3 outline-none focus:border-uno-yellow"
            aria-label="Contraseña de la sala"
            placeholder="Contraseña (si la sala es privada)"
            type="password"
            maxLength={30}
            value={joinPass}
            onChange={e => setJoinPass(e.target.value)}
          />
          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full bg-surface text-white font-bold py-4 rounded-xl hover:bg-surface2 active:scale-95 transition-all border border-border disabled:opacity-50"
          >
            {loading ? 'Uniéndose…' : 'Unirse a la partida →'}
          </button>
        </div>
      )}

      {error && <p className="text-uno-red text-sm text-center mt-4">{error}</p>}

      <p className="online-features">◈ 2–8 jugadores <span>↻ Reglas europeas</span> <span>☺ Reacciones en vivo</span></p>
      </div>
    </div>
  )
}
