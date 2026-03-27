import { useState } from 'react'
import { createRoom, joinRoom, findPublicRoom, listPublicRooms } from '../services/room.service'
import type { PublicRoom } from '../services/room.service'
import type { LocalSession } from '../types'

interface Props {
  onEnter: (session: LocalSession, mode: 'lobby') => void
}

function RoomListModal({
  rooms,
  loading,
  onRefresh,
  onJoin,
  onCreate,
  onClose,
}: {
  rooms:     PublicRoom[]
  loading:   boolean
  onRefresh: () => void
  onJoin:    (room: PublicRoom) => void
  onCreate:  () => void
  onClose:   () => void
}) {
  function timeAgo(iso: string) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 1) return 'Ahora mismo'
    if (mins === 1) return 'Hace 1 min'
    return `Hace ${mins} min`
  }

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-md rounded-t-2xl px-6 pt-5 pb-8 max-h-[75vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-lg">Partidas Disponibles</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="text-gray text-xs hover:text-white transition-colors disabled:opacity-40"
            >
              {loading ? '…' : '↻ Actualizar'}
            </button>
            <button onClick={onClose} className="text-gray text-xl leading-none">✕</button>
          </div>
        </div>

        {/* Lista de salas */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0">
          {loading && rooms.length === 0 && (
            <p className="text-gray text-sm text-center py-8">Buscando partidas…</p>
          )}
          {!loading && rooms.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray text-sm mb-1">No hay partidas disponibles</p>
              <p className="text-gray text-xs">Crea una nueva sala para empezar</p>
            </div>
          )}
          {rooms.map(room => (
            <div
              key={room.room_id}
              className="bg-surface2 rounded-xl px-4 py-3 flex items-center justify-between border border-border"
            >
              <div>
                <p className="text-uno-yellow font-black tracking-widest text-sm">{room.room_code}</p>
                <p className="text-gray text-xs mt-0.5">
                  {room.player_count}/{room.max_players} jugadores · {timeAgo(room.created_at)}
                </p>
              </div>
              <button
                onClick={() => onJoin(room)}
                className="bg-uno-red text-white text-xs font-bold px-3 py-2 rounded-lg hover:brightness-110 active:scale-95 transition-all"
              >
                Unirse
              </button>
            </div>
          ))}
        </div>

        {/* Crear sala */}
        <button
          onClick={onCreate}
          className="mt-4 w-full bg-uno-yellow text-black font-black py-3 rounded-xl hover:brightness-110 transition-all"
        >
          + Crear nueva sala
        </button>
      </div>
    </div>
  )
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-md rounded-t-2xl px-6 pt-5 pb-8 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-lg">Reglas — UNO Europeo</h2>
          <button onClick={onClose} className="text-gray text-xl leading-none">✕</button>
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
            <li>Wild (elige color) y Wild +4 (×4 cada uno)</li>
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
            <li><strong>Wild:</strong> elige el color que quieras.</li>
            <li><strong>Wild +4:</strong> elige color y el siguiente jugador roba 4 cartas.</li>
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

        <Section title="📢 UNO">
          <ul>
            <li>Cuando te quede <strong>1 carta</strong>, debes gritar <strong>¡UNO!</strong> antes de que otro jugador lo note.</li>
            <li>Si te pillan sin cantar UNO, recibes <strong>4 cartas de penalización</strong> (regla europea).</li>
          </ul>
        </Section>

        <Section title="🏆 Victoria">
          <ul>
            <li>Solo puedes ganar jugando una <strong>carta de número (0–9)</strong> como última carta.</li>
            <li>Si tu última carta es especial (Salta, Reversa, +2, Wild, Wild +4), <strong>no puedes ganarla</strong> — debes robar y continuar.</li>
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
          className="mt-4 w-full bg-uno-red text-white font-bold py-3 rounded-xl hover:brightness-110 transition-all"
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
      <p className="text-uno-yellow font-bold text-sm mb-1">{title}</p>
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
    try {
      const rooms = await listPublicRooms()
      setPublicRooms(rooms)
    } catch {
      setPublicRooms([])
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
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-8">

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {showRoomList && (
        <RoomListModal
          rooms={publicRooms}
          loading={loadingRooms}
          onRefresh={loadRooms}
          onJoin={handleJoinFromModal}
          onCreate={handleCreateFromModal}
          onClose={() => setShowRoomList(false)}
        />
      )}

      {/* Logo + botón reglas */}
      <div className="relative mb-4">
        <div className="bg-uno-red rounded-[20px] w-40 h-20 flex items-center justify-center shadow-[0_8px_24px_rgba(220,38,38,0.55)]">
          <span className="text-white text-5xl font-black">UNO</span>
        </div>
        <button
          onClick={() => setShowRules(true)}
          className="absolute -top-2 -right-3 bg-surface border border-border text-gray text-[10px] font-bold px-2 py-1 rounded-lg hover:text-white hover:border-uno-yellow transition-colors"
          title="Ver reglas del juego"
        >
          ? Reglas
        </button>
      </div>
      <p className="text-gray text-sm mb-6">Multijugador en tiempo real · Reglas europeas</p>

      {/* Campo de nombre */}
      <input
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-gray text-sm mb-5 outline-none focus:border-uno-yellow"
        placeholder="Tu nombre de jugador"
        maxLength={20}
        value={name}
        onChange={e => setName(e.target.value)}
      />

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
            Entra directo a una sala pública disponible. Si no hay ninguna, se crea una nueva.
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
            placeholder="Código de sala — ej: A7F3K2"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
          />
          <input
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white placeholder-gray text-sm mb-3 outline-none focus:border-uno-yellow"
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

      <p className="text-gray text-xs mt-8">2 – 8 jugadores · PWA instalable · unoreglaseuropeas.com</p>
    </div>
  )
}
