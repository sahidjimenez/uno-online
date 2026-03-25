import { useState, useMemo, useEffect } from 'react'
import { useGame } from '../hooks/useGame'
import { UnoCard } from '../components/UnoCard'
import { OpponentPanel } from '../components/OpponentPanel'
import { ColorPicker } from '../components/ColorPicker'
import { EffectOverlay } from '../components/EffectOverlay'
import { canPlay, canReverseCounter } from '../engine/rules'
import { supabase } from '../lib/supabase'
import type { LocalSession, Card, CardColor, Player } from '../types'

interface Props {
  session:  LocalSession
  onFinish: (winnerId: string, players: Player[]) => void
}

export function Board({ session, onFinish }: Props) {
  const { gameState, players, myHand, lastEvent, loading, isMyTurn } = useGame(session)
  const [pendingWild,      setPendingWild]      = useState<Card | null>(null)
  const [dismissedEventId, setDismissedEventId] = useState<string | null>(null)
  const [prevHandIds,      setPrevHandIds]       = useState<Set<string>>(new Set())

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

  // Detectar overlay de efecto al llegar un nuevo evento
  const activeEffect = useMemo(() => {
    if (!lastEvent) return null
    if (lastEvent.id === dismissedEventId) return null
    // Si es mi turno y hay stack activo, siempre mostrar draw_stack (incluye reverse counter)
    if (isMyTurn && gameState && gameState.draw_stack > 0) return 'draw_stack' as const
    if (lastEvent.type === 'skip_applied')    return 'skip'    as const
    if (lastEvent.type === 'reverse_applied') return 'reverse' as const
    if (lastEvent.type === 'draw_stack_added' && isMyTurn) return 'draw_stack' as const
    return null
  }, [lastEvent, isMyTurn, dismissedEventId, gameState?.draw_stack])

  // Auto-dismiss skip/reverse después de 2s — solo si NO es un reverse counter con stack activo
  useEffect(() => {
    const isReverseCounter = lastEvent?.type === 'reverse_applied' && (gameState?.draw_stack ?? 0) > 0
    if ((activeEffect === 'skip' || activeEffect === 'reverse') && !isReverseCounter) {
      const t = setTimeout(() => setDismissedEventId(lastEvent?.id ?? null), 2000)
      return () => clearTimeout(t)
    }
  }, [activeEffect, lastEvent?.id, gameState?.draw_stack]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasReverseCounter = useMemo(() => {
    if (!gameState || !isMyTurn || gameState.draw_stack === 0) return false
    return myHand.some(c => canReverseCounter(c, gameState))
  }, [gameState, isMyTurn, myHand])

  async function playCard(card: Card, chosenColor?: CardColor) {
    if (!isMyTurn || !gameState) return
    if (!canPlay(card, gameState)) return

    if ((card.card_type === 'wild' || card.card_type === 'wild4') && !chosenColor) {
      setPendingWild(card)
      return
    }

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
    await supabase.functions.invoke('draw-card', {
      body: {
        room_id:   session.roomId,
        player_id: session.playerId,
        version:   gameState.version,
      },
    })
  }

  async function callUno() {
    await supabase.functions.invoke('call-uno', {
      body: { room_id: session.roomId, player_id: session.playerId },
    })
  }

  async function catchUno(accusedId: string) {
    await supabase.functions.invoke('penalize-uno', {
      body: { room_id: session.roomId, accuser_id: session.playerId, accused_id: accusedId },
    })
  }

  async function handleReverseCounter() {
    if (!gameState) return
    const revCard = myHand.find(c => canReverseCounter(c, gameState))
    if (revCard) await playCard(revCard)
    setShowEffect(false)
  }

  if (loading || !gameState) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-gray">Cargando partida…</p>
      </div>
    )
  }

  const playerCount = players.length
  const compact = playerCount >= 7

  // Layout de oponentes según número de jugadores
  function renderOpponents() {
    if (playerCount === 2) {
      return (
        <div className="flex justify-center px-4">
          <OpponentPanel player={opponents[0]} cardCount={opponents[0]?.hand_count ?? 0}
            isActive={gameState!.current_player_id === opponents[0]?.id}
            onCatch={() => catchUno(opponents[0].id)} />
        </div>
      )
    }
    if (playerCount === 3) {
      return (
        <div className="flex justify-between px-2">
          <OpponentPanel player={opponents[0]} cardCount={opponents[0]?.hand_count ?? 0}
            isActive={gameState!.current_player_id === opponents[0]?.id} direction="v"
            onCatch={() => catchUno(opponents[0].id)} />
          <OpponentPanel player={opponents[1]} cardCount={opponents[1]?.hand_count ?? 0}
            isActive={gameState!.current_player_id === opponents[1]?.id} direction="v"
            onCatch={() => catchUno(opponents[1].id)} />
        </div>
      )
    }
    if (playerCount === 4) {
      const top = opponents[1]
      const left = opponents[0]
      const right = opponents[2]
      return (
        <>
          <div className="flex justify-center mb-2 px-4">
            <OpponentPanel player={top} cardCount={top?.hand_count ?? 0}
              isActive={gameState!.current_player_id === top?.id}
              onCatch={() => catchUno(top.id)} />
          </div>
          <div className="flex justify-between px-2">
            <OpponentPanel player={left} cardCount={left?.hand_count ?? 0}
              isActive={gameState!.current_player_id === left?.id} direction="v"
              onCatch={() => catchUno(left.id)} />
            <OpponentPanel player={right} cardCount={right?.hand_count ?? 0}
              isActive={gameState!.current_player_id === right?.id} direction="v"
              onCatch={() => catchUno(right.id)} />
          </div>
        </>
      )
    }
    // 5-8 jugadores: fila top + lados
    const topRow = opponents.slice(0, playerCount <= 6 ? playerCount - 3 : 3)
    const left   = opponents.slice(topRow.length, topRow.length + (compact ? 2 : 1))
    const right  = opponents.slice(topRow.length + left.length)
    return (
      <>
        <div className={`grid grid-cols-${topRow.length} gap-1 px-2 mb-2`}>
          {topRow.map(p => (
            <OpponentPanel key={p.id} player={p} cardCount={p.hand_count ?? 0}
              isActive={gameState!.current_player_id === p.id} compact={compact}
              onCatch={() => catchUno(p.id)} />
          ))}
        </div>
        <div className="flex justify-between px-1">
          <div className="flex flex-col gap-1">
            {left.map(p => (
              <OpponentPanel key={p.id} player={p} cardCount={p.hand_count ?? 0}
                isActive={gameState!.current_player_id === p.id} direction="v" compact={compact}
                onCatch={() => catchUno(p.id)} />
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {right.map(p => (
              <OpponentPanel key={p.id} player={p} cardCount={p.hand_count ?? 0}
                isActive={gameState!.current_player_id === p.id} direction="v" compact={compact}
                onCatch={() => catchUno(p.id)} />
            ))}
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-table flex flex-col">

      {/* Status bar */}
      <div className="bg-bg flex items-center justify-between px-4 h-12 shrink-0">
        <span className="text-gray text-sm">UNO Online</span>
        <span className="text-white text-xs font-bold">
          {isMyTurn ? '→ Tu turno' : `Turno de ${players.find(p => p.id === gameState.current_player_id)?.name ?? '…'}`}
        </span>
        <span className="text-gray text-xs">{gameState.draw_pile_count} ✦</span>
      </div>

      {/* Oponentes */}
      <div className="flex flex-col px-2 pt-3 gap-2">
        {renderOpponents()}
      </div>

      {/* Mesa central */}
      <div className="flex-1 flex items-center justify-center gap-8">

        {/* Mazo */}
        <button onClick={drawCard} disabled={!isMyTurn} className="relative disabled:cursor-not-allowed">
          <div className="w-16 h-24 bg-surface2 rounded-xl" />
          <div className="absolute top-[-4px] left-[4px] w-16 h-24 bg-surface rounded-xl" />
          <p className="text-gray text-[10px] text-center mt-1">Robar</p>
        </button>

        {/* Carta actual + indicador de color */}
        <div className="flex flex-col items-center gap-2">
          {gameState.top_card_color && gameState.top_card_type && (
            <UnoCard
              key={`${gameState.top_card_color}-${gameState.top_card_type}-${gameState.version}`}
              color={gameState.top_card_color}
              type={gameState.top_card_type}
              size="lg"
              animate={
                ['skip','reverse','draw2','wild','wild4'].includes(gameState.top_card_type)
                  ? 'play'
                  : undefined
              }
            />
          )}
          {gameState.draw_stack > 0 && (
            <div className="animate-stack-pulse bg-uno-red text-white text-xs font-black px-3 py-1 rounded-full">
              +{gameState.draw_stack} acumulado
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-full ${
              gameState.current_color === 'red'    ? 'bg-uno-red'    :
              gameState.current_color === 'blue'   ? 'bg-uno-blue'   :
              gameState.current_color === 'green'  ? 'bg-uno-green'  :
              gameState.current_color === 'yellow' ? 'bg-uno-yellow' : 'bg-gray'
            }`} />
            <span className="text-gray text-[10px] capitalize">{gameState.current_color}</span>
          </div>
        </div>
      </div>

      {/* Mano del jugador */}
      <div className="bg-bg/95 pt-2 pb-4 px-4 shrink-0">
        <p className="text-gray text-[10px] mb-2">Tu mano</p>
        <div className="flex gap-2 overflow-x-auto pb-1 justify-center">
          {myHand.map(card => (
            <UnoCard
              key={card.id}
              color={card.card_color}
              type={card.card_type}
              size="md"
              playable={isMyTurn && canPlay(card, gameState)}
              animate={!prevHandIds.has(card.id) ? 'draw' : undefined}
              onClick={isMyTurn ? () => playCard(card) : undefined}
            />
          ))}
        </div>

        {/* Botón UNO */}
        {myHand.length === 1 && (
          <button
            onClick={callUno}
            className="absolute bottom-6 right-4 bg-uno-yellow text-black font-black text-sm px-4 py-2 rounded-full animate-bounce-in"
          >
            ¡UNO!
          </button>
        )}
      </div>

      {/* Selector de color para Wild */}
      {pendingWild && (
        <ColorPicker
          onSelect={color => { playCard(pendingWild, color); setPendingWild(null) }}
          onCancel={() => setPendingWild(null)}
        />
      )}

      {/* Overlay de efectos */}
      {activeEffect && (
        <EffectOverlay
          type={activeEffect}
          byPlayer={players.find(p => p.id === lastEvent?.player_id)?.name}
          stack={gameState.draw_stack}
          color={gameState.top_card_color ?? undefined}
          canCounter={hasReverseCounter}
          onCounter={handleReverseCounter}
          onDraw={async () => { await drawCard(); setDismissedEventId(lastEvent?.id ?? null) }}
          onContinue={() => setDismissedEventId(lastEvent?.id ?? null)}
        />
      )}
    </div>
  )
}
