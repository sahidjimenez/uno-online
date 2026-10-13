import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
import { Bot, Users, ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'
import { DEFAULT_CHARACTER } from '../lib/character'
import type { GameState, Player } from '../types'
import './Room3D.css'
import './Entrance.css'

const Room3D = lazy(() => import('./Room3D'))
const EMPTY_PLAYERS: Player[] = []
const PREVIEW_STATE: GameState = {
  id: 'preview', room_id: 'preview', version: 0, status: 'waiting', current_player_id: null,
  direction: 1, current_color: null, top_card_color: null, top_card_type: null,
  draw_stack: 0, draw_pile_count: 8, winner_id: null, updated_at: '',
}

export function Entrance({ mode, onSwitch, children }: {
  mode: 'bots' | 'friends'; onSwitch: () => void; children: ReactNode
}) {
  const [unavailable, setUnavailable] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const fallback = useCallback(() => setUnavailable(true), [])
  return <main className="entrance">
    <div className="entrance-scene" aria-hidden="true">
      {!unavailable && <Suspense fallback={null}><Room3D preview
        players={EMPTY_PLAYERS} gameState={PREVIEW_STATE} playerId="preview" appearance={DEFAULT_CHARACTER}
        cardPlay={null} walking={false} showNames={false} onFallback={fallback} /></Suspense>}
    </div>
    <header className="entrance-topbar"><a href="/" aria-label="NEXO, inicio" className="entrance-brand">◈ NEXO</a><span>BUENAS CARTAS. MEJOR COMPAÑÍA.</span></header>
    <div className="entrance-layout">
      <section className="entrance-intro" aria-label="Bienvenido a NEXO">
        <span className="entrance-kicker"><i /> EL PUNTO DE ENCUENTRO</span>
        <h2>Una mesa.<br /> Mil vueltas.</h2>
        <p>Conecta colores. Cambia el rumbo.<br />Cada ronda es una nueva historia.</p>
        <div className="entrance-scene-caption"><span>01 / LA SALA</span><ArrowUpRight size={18} aria-hidden="true" /></div>
      </section>
      <section className={`entrance-panel multiplayer-card${expanded ? ' entrance-panel-expanded' : ''}`} aria-label="Configura tu partida">
        <div className="entrance-sheet-handle" aria-hidden="true" />
        <nav className="entrance-modes" aria-label="Modo de juego">
          <button aria-pressed={mode === 'bots'} onClick={mode === 'friends' ? onSwitch : undefined}><Bot size={18} aria-hidden="true" /> Con bots</button>
          <button aria-pressed={mode === 'friends'} onClick={mode === 'bots' ? onSwitch : undefined}><Users size={18} aria-hidden="true" /> Con amigos</button>
        </nav>
        <button className="entrance-sheet-toggle" aria-expanded={expanded} aria-controls="entrance-configuration"
          onClick={() => setExpanded(value => !value)}>
          {expanded ? 'Volver a ver la mesa' : 'Configurar partida'}
          {expanded ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronUp size={18} aria-hidden="true" />}
        </button>
        <div id="entrance-configuration" className="entrance-configuration">{children}</div>
      </section>
    </div>
    <footer className="entrance-footer"><span>NEXO · CONECTA Y JUEGA</span></footer>
  </main>
}
