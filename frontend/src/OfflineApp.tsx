import { useState } from 'react'
import { Board } from './pages/Board'
import { GameOver } from './pages/GameOver'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { LocalSession, Player } from './types'

export function OfflineApp() {
  const [name, setName] = useState('')
  const [playerCount, setPlayerCount] = useState(4)
  const [session, setSession] = useState<LocalSession | null>(null)
  const [result, setResult] = useState<{ winner: string; players: Player[] } | null>(null)
  function start() {
    setResult(null)
    setSession({ playerId: 'local-player', roomId: crypto.randomUUID(), roomCode: 'LOCAL', name: name.trim() || 'Tú', playerCount })
  }
  if (!session) return (
    <main className="local-welcome min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="table-brand justify-center mb-6"><strong>NEXO</strong><span>Mesa 3D</span></div>
        <h1 className="text-2xl font-black mb-3">La mesa está lista</h1>
        <p className="text-gray text-sm mb-7">Conecta colores. Cambia el rumbo. Una mesa para jugar a tu ritmo.</p>
        <form onSubmit={event => { event.preventDefault(); start() }}>
          <label htmlFor="local-name" className="block text-left text-sm text-gray mb-2">Tu nombre</label>
          <input id="local-name" value={name} onChange={event => setName(event.target.value)} maxLength={20}
            placeholder="¿Cómo te llamas?" className="w-full bg-surface border border-border rounded-xl px-4 py-3 mb-4" />
          <fieldset className="player-count-picker">
            <legend>Jugadores en la mesa</legend>
            <div className="player-count-options">
              {[2, 3, 4, 5, 6, 7, 8].map(count => <label key={count} className={playerCount === count ? 'count-selected' : ''}>
                <input type="radio" name="player-count" value={count} checked={playerCount === count} onChange={() => setPlayerCount(count)} />
                <span>{count}</span>
              </label>)}
            </div>
            <p>Tú + {playerCount - 1} {playerCount === 2 ? 'rival automático' : 'rivales automáticos'}</p>
          </fieldset>
          <button className="local-start-button w-full bg-uno-red font-bold py-4 rounded-xl hover:brightness-110">Jugar ahora</button>
        </form>
        <p className="text-gray text-xs mt-5">Modo local · {playerCount} jugadores · Solo números para ganar</p>
      </div>
    </main>
  )
  if (result) return <GameOver session={session} players={result.players} winnerId={result.winner}
    onRematch={start} onLobby={() => { setSession(null); setResult(null) }} />
  return <ErrorBoundary onReset={() => setSession(null)}>
    <div className="relative">
      <Board key={session.roomId} session={session} onFinish={(winner, players) => setResult({ winner, players })} />
      <button onClick={() => setSession(null)} className="fixed bottom-3 left-3 z-10 text-xs text-gray bg-surface rounded-full px-3 py-2">← Salir</button>
    </div>
  </ErrorBoundary>
}
