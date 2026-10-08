import { StatusScreen } from '../components/StatusScreen'
import { TableMessages } from '../components/TableMessages'
import { useEffectSounds } from '../hooks/useEffectSounds'
import { detectTableEffect } from '../engine/tableEffects'
import { lazy, Suspense, useState, useMemo, useEffect, useRef, type CSSProperties } from 'react'
import { useOnlineGame } from '../hooks/useGame'
import { useOfflineGame } from '../hooks/useOfflineGame'
import { UnoCard } from '../components/UnoCard'
import { OpponentPanel } from '../components/OpponentPanel'
import { ColorPicker } from '../components/ColorPicker'
import { EffectOverlay } from '../components/EffectOverlay'
import { canPlay, canWinWith } from '../engine/rules'
import { supabase } from '../lib/supabase'
import type { LocalSession, Card, CardColor, Player } from '../types'
import '../components/Room3D.css'
import { CharacterCustomizer } from '../components/CharacterCustomizer'
import { useCharacter } from '../hooks/useCharacter'

const Room3D = lazy(() => import('../components/Room3D'))

interface Props {
  local?: boolean
  session:  LocalSession
  onFinish: (winnerId: string, players: Player[]) => void
}

export function Board(props: Props) {
  return props.local ? <LocalBoard {...props} /> : <OnlineBoard {...props} />
}
function LocalBoard(props: Props) {
  const game = useOfflineGame(props.session)
  return <BoardView {...props} game={game} />
}
function OnlineBoard(props: Props) {
  const game = useOnlineGame(props.session)
  return <BoardView {...props} game={game} />
}
function BoardView({ session, onFinish, game }: Props & { game: ReturnType<typeof useOfflineGame> | ReturnType<typeof useOnlineGame> }) {
  const { gameState, players, myHand, lastEvent, unoPenalty, loading, isMyTurn, localPlay, localDraw, localUno, localCatch } = game
  const [pendingWild,      setPendingWild]      = useState<Card | null>(null)
  const [room3D, setRoom3D] = useState(true)
  const appearance = useCharacter()
  const [tableEffect, setTableEffect] = useState<{ type: NonNullable<ReturnType<typeof detectTableEffect>>['type'] | 'uno_penalty'; stack: number; id: string; playerId?: string } | null>(null)
  const [unoAcknowledged, setUnoAcknowledged] = useState<string | null>(null)
  const unoPending = useRef(false)
  const seenPenalty = useRef<string | null>(null)
  const { soundEnabled, toggleSound } = useEffectSounds(tableEffect)
  const previousState = useRef(gameState)
  const [prevHandIds,      setPrevHandIds]       = useState<Set<string>>(new Set())
  const [winBlockMsg,      setWinBlockMsg]       = useState<string | null>(null)

  // Navegar a GameOver cuando haya un ganador
  useEffect(() => {
    if (gameState?.winner_id) {
      onFinish(gameState.winner_id, players)
    }
  }, [gameState?.winner_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trackear qué cartas son nuevas en la mano para animarlas
  useEffect(() => {
    setPrevHandIds(new Set(myHand.map(c => c.id)))
  }, [myHand])

  const opponents = useMemo(
    () => players.filter(p => p.id !== session.playerId),
    [players, session.playerId]
  )
  const me = players.find(p => p.id === session.playerId)
  useEffect(() => { if (myHand.length !== 1) setUnoAcknowledged(null) }, [myHand.length])

  useEffect(() => {
    if (gameState && previousState.current) {
      const effect = detectTableEffect(previousState.current, gameState)
      if (effect) setTableEffect(current => current?.type === 'uno_penalty' ? current : { ...effect, id: `${gameState.room_id}-${gameState.version}` })
    }
    previousState.current = gameState
  }, [gameState])
  useEffect(() => {
    if (!unoPenalty || seenPenalty.current === unoPenalty.id) return
    seenPenalty.current = unoPenalty.id
    setTableEffect({ type: 'uno_penalty', id: unoPenalty.id, stack: Number(unoPenalty.payload.cards_given ?? 4),
      playerId: String(unoPenalty.payload.accused_id ?? unoPenalty.player_id) })
  }, [unoPenalty])
  useEffect(() => {
    if (!tableEffect) return
    const timer = setTimeout(() => setTableEffect(null), 1900)
    return () => clearTimeout(timer)
  }, [tableEffect])

  async function playCard(card: Card, chosenColor?: CardColor) {
    if (!isMyTurn || !gameState) return
    if (!canPlay(card, gameState)) return

    // Regla europea: solo se puede ganar con carta de número
    if (myHand.length === 1 && !canWinWith(card)) {
      setWinBlockMsg('¡Solo puedes ganar con una carta de número!')
      setTimeout(() => setWinBlockMsg(null), 2500)
      return
    }

    if ((card.card_type === 'wild' || card.card_type === 'wild4') && !chosenColor) {
      setPendingWild(card)
      return
    }

    if (localPlay) { localPlay(card, chosenColor); return }
    await supabase.functions.invoke('play-card', {
      body: {
        room_id:      session.roomId,
        player_id:    session.playerId,
        card_id:      card.id,
        chosen_color: chosenColor ?? null,
        version:      gameState.version,
      },
    })
  }

  async function drawCard() {
    if (!isMyTurn || !gameState) return
    if (localDraw) { localDraw(); return }
    await supabase.functions.invoke('draw-card', {
      body: {
        room_id:   session.roomId,
        player_id: session.playerId,
        version:   gameState.version,
      },
    })
  }

  async function callUno() {
    if (myHand.length !== 1 || me?.has_called_uno || unoPending.current || unoAcknowledged === myHand[0].id) return
    unoPending.current = true
    setUnoAcknowledged(myHand[0].id)
    try {
      if (localUno) localUno()
      else {
        const { error } = await supabase.functions.invoke('call-uno', {
          body: { room_id: session.roomId, player_id: session.playerId },
        })
        if (error) throw error
      }
    } catch {
      setUnoAcknowledged(null)
      setWinBlockMsg('No se pudo avisar. Vuelve a pulsar ¡ÚLTIMA!')
      setTimeout(() => setWinBlockMsg(null), 3000)
    } finally { unoPending.current = false }
  }

  async function catchUno(accusedId: string) {
    if (localCatch) { localCatch(accusedId); return }
    await supabase.functions.invoke('penalize-uno', {
      body: { room_id: session.roomId, accuser_id: session.playerId, accused_id: accusedId },
    })
  }

  async function handleReverseCounter() {
    if (!gameState) return
    const revCard = myHand.find(c => c.card_type === 'reverse' && c.card_color === gameState.top_card_color)
    if (revCard) await playCard(revCard)
  }

  if (loading || !gameState) {
    return (
      <StatusScreen loading title="Preparando la mesa" description="Estamos repartiendo las cartas…" />
    )
  }

  const currentPlayer = players.find(p => p.id === gameState.current_player_id)
  const colorNames = { red: 'Rojo', blue: 'Azul', green: 'Verde', yellow: 'Amarillo', wild: 'Comodín' }

  return (
    <div className={`game-room ${room3D ? 'immersive-room' : ''} ${tableEffect?.type === 'reverse' ? 'table-reversing' : ''}`}>
      {room3D && <Suspense fallback={<div className="room3d-loading" role="status">Preparando la sala 3D…</div>}>
        <Room3D players={players} gameState={gameState} playerId={session.playerId} appearance={appearance} onFallback={() => setRoom3D(false)} />
      </Suspense>}
      <header className="table-header">
        <div className="table-brand"><strong>NEXO</strong><span>Mesa 3D</span></div>
        <div className="table-room-code">{localPlay ? 'MODO LOCAL' : 'SALA'} <strong>{localPlay ? 'CONTRA BOTS' : session.roomCode}</strong></div>
        <div className="table-header-actions">
        <CharacterCustomizer compact />
        <button onClick={() => setRoom3D(value => !value)} className="table-view-label" aria-pressed={room3D}>{room3D ? 'Vista clásica' : 'Entrar a sala 3D'}</button>
        <button onClick={toggleSound} className="table-view-label sound-toggle" aria-pressed={soundEnabled}
          aria-label={soundEnabled ? 'Silenciar efectos de sonido' : 'Activar efectos de sonido'}>
          <span aria-hidden="true">{soundEnabled ? '🔊' : '🔇'}</span> {soundEnabled ? 'Sonido activo' : 'Sin sonido'}
        </button>
        </div>
      </header>

      {'botSpeed' in game && <div className="bot-speed-control">
        <label htmlFor="bot-speed">Velocidad de bots</label>
        <select id="bot-speed" value={game.botSpeed} onChange={event => game.changeBotSpeed(Number(event.target.value))}>
          <option value={0.5}>Tranquila · 0.5×</option>
          <option value={1}>Normal · 1×</option>
          <option value={2}>Rápida · 2×</option>
          <option value={3}>Muy rápida · 3×</option>
        </select>
      </div>}
      <main className="table-stage" aria-label="Mesa de juego NEXO">
        {!room3D && <>
        <div className="walnut-table" aria-hidden="true"><div className="table-grain" /></div>
        <div className={`opponent-seats ${opponents.length > 4 ? 'many-seats' : ''}`}>
          {opponents.map((player, index) => {
            const angle = opponents.length === 1 ? -90 : -165 + index * (150 / (opponents.length - 1))
            const radians = angle * Math.PI / 180
            return (
              <div key={player.id} className="opponent-seat" style={{
                left: `${50 + Math.cos(radians) * 40}%`,
                top: `${36 + Math.sin(radians) * 27}%`,
              }}>
                <OpponentPanel player={player} cardCount={player.hand_count ?? 0}
                  isActive={gameState.current_player_id === player.id} compact={opponents.length > 4}
                  onCatch={() => catchUno(player.id)} />
                <div className="opponent-hand" aria-hidden="true">
                  {Array.from({ length: Math.min(player.hand_count ?? 0, 7) }).map((_, i) => (
                    <div key={i} style={{ transform: `rotate(${(i - Math.min(player.hand_count ?? 0, 7) / 2) * 5}deg)` }}>
                      <UnoCard color="wild" type="wild" faceDown size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="table-center">
          <div className={`turn-orbit ${gameState.direction === -1 ? 'is-reversed' : ''}`} aria-label={gameState.direction === 1 ? 'Sentido horario' : 'Sentido antihorario'}>↻</div>
          <div className="table-piles">
            <div className="pile-column">
              <button onClick={drawCard} disabled={!isMyTurn} className="draw-deck" aria-label="Robar carta">
                <UnoCard color="wild" type="wild" faceDown size="lg" />
              </button>
              <span className="pile-caption">ROBAR · {gameState.draw_pile_count}</span>
            </div>
            <div className="pile-column discard-pile">
              {gameState.top_card_color && gameState.top_card_type && (
                <UnoCard key={`${gameState.top_card_color}-${gameState.top_card_type}-${gameState.version}`}
                  color={gameState.top_card_color} type={gameState.top_card_type} size="lg" />
              )}
              <span className="pile-caption color-caption"><i style={{ background: `var(--card-${gameState.current_color})` }} />{colorNames[gameState.current_color ?? 'wild']}</span>
            </div>
          </div>
          {gameState.draw_stack > 0 && <div key={gameState.draw_stack} className="draw-stack-notice">+{gameState.draw_stack} acumulado{isMyTurn && ' · ¡te toca!'}</div>}
        </div>
        </>}

        {room3D && <>
          <div className="room3d-roster" aria-label="Jugadores">
            {opponents.map(player => <OpponentPanel key={player.id} player={player} cardCount={player.hand_count ?? 0}
              isActive={gameState.current_player_id === player.id} compact onCatch={() => catchUno(player.id)} />)}
          </div>
          <div className="room3d-game-status">
            <span>EN LA MESA</span>
            {gameState.top_card_color && gameState.top_card_type && <UnoCard color={gameState.top_card_color} type={gameState.top_card_type} size="sm" />}
            <strong style={{ color: `var(--card-${gameState.current_color})` }}>{colorNames[gameState.current_color ?? 'wild']}</strong>
            <span>{gameState.direction === 1 ? '↻ Horario' : '↺ Antihorario'}</span>
            {gameState.draw_stack > 0 && <strong>+{gameState.draw_stack} acumulado</strong>}
            <button onClick={drawCard} disabled={!isMyTurn}>Robar {gameState.draw_stack || 1} {gameState.draw_stack > 1 ? 'cartas' : 'carta'}<small>{gameState.draw_pile_count} en el mazo</small></button>
          </div>
        </>}

        {myHand.length === 1 && !me?.has_called_uno && unoAcknowledged !== myHand[0].id &&
          <button onClick={callUno} className="table-uno-button">¡ÚLTIMA!<span>Avísalo antes de tu próximo turno</span></button>}

        <section className="player-area" aria-label="Tu mano">
          <div className="player-hand-scroll">
            <div className="player-hand">
              {myHand.map((card, index) => {
                const offset = index - (myHand.length - 1) / 2
                return <div key={card.id} className="hand-card" style={{
                  '--fan-angle': `${offset * Math.min(5, 40 / Math.max(myHand.length, 1))}deg`,
                  '--fan-lift': `${Math.abs(offset) * Math.min(5, 30 / Math.max(myHand.length, 1))}px`,
                } as CSSProperties}>
                  <UnoCard color={card.card_color} type={card.card_type} size="lg"
                    playable={isMyTurn && canPlay(card, gameState)}
                    animate={!prevHandIds.has(card.id) ? 'draw' : undefined}
                    onClick={isMyTurn && canPlay(card, gameState) ? () => playCard(card) : undefined} />
                </div>
              })}
            </div>
          </div>
          <div className={`turn-status ${isMyTurn ? 'your-turn' : ''}`} role="status">
            <span>{isMyTurn ? '▶' : '◷'}</span>{isMyTurn ? 'Tu turno' : `Turno de ${currentPlayer?.name ?? '…'}`}
          </div>
          <p className="hand-caption">{me?.name ?? 'Tú'} · {myHand.length} cartas <span>{isMyTurn ? 'Elige una carta iluminada o roba del mazo' : 'La mesa está en juego'}</span></p>
        </section>
      </main>

      <TableMessages session={session} players={players} local={!!localPlay} />

      {/* Aviso de victoria bloqueada */}
      {winBlockMsg && (
        <div className="fixed top-16 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <div className="bg-uno-red text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-lg animate-bounce-in">
            {winBlockMsg}
          </div>
        </div>
      )}

      {/* Selector de color para Wild */}
      {pendingWild && (
        <ColorPicker
          onSelect={color => { playCard(pendingWild, color); setPendingWild(null) }}
          onCancel={() => setPendingWild(null)}
        />
      )}

      {/* Overlay informativo — solo animación, no bloquea interacción */}
      {tableEffect && (
        <EffectOverlay
          key={tableEffect.id}
          type={tableEffect.type}
          stack={tableEffect.stack}
          byPlayer={players.find(p => p.id === (tableEffect.playerId ?? lastEvent?.player_id))?.name}
          color={gameState.top_card_color ?? undefined}
        />
      )}
    </div>
  )
}
