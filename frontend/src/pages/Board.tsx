import { useState, useMemo, useEffect, type CSSProperties } from 'react'
import { useGame } from '../hooks/useGame'
import { UnoCard } from '../components/UnoCard'
import { OpponentPanel } from '../components/OpponentPanel'
import { ColorPicker } from '../components/ColorPicker'
import { EffectOverlay } from '../components/EffectOverlay'
import { canPlay, canWinWith } from '../engine/rules'
import { supabase } from '../lib/supabase'
import type { LocalSession, Card, CardColor, Player } from '../types'

interface Props {
  session:  LocalSession
  onFinish: (winnerId: string, players: Player[]) => void
}

export function Board({ session, onFinish }: Props) {
  const { gameState, players, myHand, lastEvent, loading, isMyTurn, localPlay, localDraw, localUno, localCatch } = useGame(session)
  const [pendingWild,      setPendingWild]      = useState<Card | null>(null)
  const [dismissedEventId, setDismissedEventId] = useState<string | null>(null)
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

  // Overlay solo para skip y reverse — solo animación informativa, se cierra solo
  const activeEffect = useMemo(() => {
    if (!lastEvent) return null
    if (lastEvent.id === dismissedEventId) return null
    if (lastEvent.type === 'skip_applied')    return 'skip'    as const
    if (lastEvent.type === 'reverse_applied') return 'reverse' as const
    return null
  }, [lastEvent, dismissedEventId])

  // Auto-dismiss skip/reverse tras 1.5s
  useEffect(() => {
    if (activeEffect === 'skip' || activeEffect === 'reverse') {
      const t = setTimeout(() => setDismissedEventId(lastEvent?.id ?? null), 1500)
      return () => clearTimeout(t)
    }
  }, [activeEffect, lastEvent?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (localUno) { localUno(); return }
    await supabase.functions.invoke('call-uno', {
      body: { room_id: session.roomId, player_id: session.playerId },
    })
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
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-gray">Cargando partida…</p>
      </div>
    )
  }

  const currentPlayer = players.find(p => p.id === gameState.current_player_id)
  const colorNames = { red: 'Rojo', blue: 'Azul', green: 'Verde', yellow: 'Amarillo', wild: 'Comodín' }

  return (
    <div className="game-room">
      <header className="table-header">
        <div className="table-brand"><strong>NEXO</strong><span>Mesa 3D</span></div>
        <div className="table-room-code">{localPlay ? 'MODO LOCAL' : 'SALA'} <strong>{localPlay ? 'CONTRA BOTS' : session.roomCode}</strong></div>
        <span className="table-view-label">◉ Vista de mesa</span>
      </header>

      <main className="table-stage" aria-label="Mesa de juego NEXO">
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
          {gameState.draw_stack > 0 && <div className="draw-stack-notice">+{gameState.draw_stack} acumulado{isMyTurn && ' · ¡te toca!'}</div>}
        </div>

        <button onClick={callUno} disabled={myHand.length !== 1} className="table-uno-button">¡ÚLTIMA!<span>¡Cántalo con una carta!</span></button>

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
      {activeEffect && (
        <EffectOverlay
          type={activeEffect}
          byPlayer={players.find(p => p.id === lastEvent?.player_id)?.name}
          color={gameState.top_card_color ?? undefined}
        />
      )}
    </div>
  )
}
