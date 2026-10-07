import type { LocalSession, Player } from '../types'

interface Props {
  session:  LocalSession
  players:  Player[]
  winnerId: string
  onRematch: () => void
  onLobby:   () => void
}

export function GameOver({ session, players, winnerId, onRematch, onLobby }: Props) {
  const winner = players.find(p => p.id === winnerId)
  const iWon   = winnerId === session.playerId

  const sorted = [...players].sort((a, b) => (a.hand_count ?? 0) - (b.hand_count ?? 0))

  return <main className="nexo-results-screen"><section className="nexo-results-card">
    <div className="table-brand"><strong>NEXO</strong><span>Fin de partida</span></div>
    <div className="winner-emblem" aria-hidden="true">◇<span>✦</span></div>
    <p className="multiplayer-eyebrow">{iWon ? 'LA MESA ES TUYA' : 'UNA GRAN PARTIDA'}</p>
    <h1>{iWon ? '¡Ganaste!' : `¡Ganó ${winner?.name ?? 'el ganador'}!`}</h1>
    <p className="results-subtitle">{iWon ? 'Sin cartas. Con todo el mérito.' : 'El próximo cambio de rumbo puede ser tuyo.'}</p>
    <div className="results-list"><div className="results-list-heading"><strong>Así quedó la mesa</strong><span>Cartas restantes</span></div>
      {sorted.map((player, index) => <div key={player.id} className={`result-row ${player.id === winnerId ? 'result-winner' : ''}`}>
        <span className="result-rank">{player.id === winnerId ? '✦' : index + 1}</span>
        <strong>{player.name}{player.id === session.playerId && <small> Tú</small>}</strong>
        <span className="result-count">{player.hand_count ?? 0}</span>
      </div>)}
    </div>
    <button onClick={onRematch} className="nexo-primary-button">Otra ronda ↻</button>
    <button onClick={onLobby} className="nexo-secondary-button">Volver al inicio</button>
  </section></main>
}
