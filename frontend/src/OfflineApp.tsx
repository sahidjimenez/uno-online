import { Entrance } from './components/Entrance'
import { useState } from 'react'
import { Board } from './pages/Board'
import { GameOver } from './pages/GameOver'
import { ErrorBoundary } from './components/ErrorBoundary'
import { CharacterCustomizer } from './components/CharacterCustomizer'
import type { LocalSession, Player } from './types'

export function OfflineApp({ onOnline, onLearn }: { onOnline: () => void; onLearn: () => void }) {
  const [name, setName] = useState('')
  const [playerCount, setPlayerCount] = useState(4)
  const [session, setSession] = useState<LocalSession | null>(null)
  const [result, setResult] = useState<{ winner: string; players: Player[] } | null>(null)
  function start() {
    setResult(null)
    setSession({ playerId: 'local-player', roomId: crypto.randomUUID(), roomCode: 'LOCAL', name: name.trim() || 'Tú', playerCount })
  }
  if (!session) return (
    <Entrance mode="bots" onSwitch={onOnline}>
      <div className="entrance-heading"><span className="entrance-kicker">TU PARTIDA, A TU RITMO</span>
        <h1>Una ronda para ti.</h1>
        <p>Practica, prueba tu estrategia y desafía a los bots. La mesa siempre está lista.</p>
      </div>
      <div className="entrance-benefits"><span>Sin conexión</span><span>De 1 a 7 bots</span><span>Sin esperas</span></div>
        <CharacterCustomizer />
        <form onSubmit={event => { event.preventDefault(); start() }}>
          <label htmlFor="local-name" className="block text-left text-sm text-gray mb-2">Tu nombre</label>
          <input id="local-name" value={name} onChange={event => setName(event.target.value)} maxLength={20}
            placeholder="¿Cómo te llamas?" className="w-full bg-surface border border-border rounded-xl px-4 py-3 mb-4" />
          <fieldset className="player-count-picker">
            <legend>Tamaño de la mesa</legend>
            <div className="player-count-options">
              {[2, 3, 4, 5, 6, 7, 8].map(count => <label key={count} className={playerCount === count ? 'count-selected' : ''}>
                <input type="radio" name="player-count" value={count} checked={playerCount === count} onChange={() => setPlayerCount(count)} />
                <span>{count}</span>
              </label>)}
            </div>
            <p>Tú + {playerCount - 1} {playerCount === 2 ? 'rival automático' : 'rivales automáticos'}</p>
          </fieldset>
          <button className="local-start-button w-full bg-uno-red font-bold py-4 rounded-xl hover:brightness-110">Empezar partida <span aria-hidden="true">↗</span></button>
        </form>
        <button className="tutorial-entry" onClick={onLearn}>Aprender a jugar · 7 niveles →</button>
        <p className="entrance-footnote">Tú + {playerCount - 1} bots · Solo números para ganar</p>
    </Entrance>
  )
  if (result) return <GameOver session={session} players={result.players} winnerId={result.winner}
    onRematch={start} onLobby={() => { setSession(null); setResult(null) }} />
  return <ErrorBoundary onReset={() => setSession(null)}>
    <div className="relative">
      <Board local key={session.roomId} session={session} onExit={() => setSession(null)} onFinish={(winner, players) => setResult({ winner, players })} />
      <button onClick={() => setSession(null)} className="desktop-exit-game fixed bottom-3 left-3 z-10 text-xs text-gray bg-surface rounded-full px-3 py-2">← Salir</button>
    </div>
  </ErrorBoundary>
}
