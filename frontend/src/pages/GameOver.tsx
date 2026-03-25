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

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center px-6 pt-10">

      {/* Confetti decorativo */}
      <div className="absolute top-0 left-0 w-full h-40 overflow-hidden pointer-events-none">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className={`absolute w-2 h-3 opacity-70 ${
              ['bg-uno-red','bg-uno-yellow','bg-uno-blue','bg-uno-green'][i % 4]
            }`}
            style={{
              left: `${i * 6.5}%`,
              top:  `${20 + Math.sin(i) * 30}%`,
              transform: `rotate(${i * 23}deg)`,
            }}
          />
        ))}
      </div>

      {/* Trofeo */}
      <div className="text-7xl mb-2">🏆</div>
      <p className="text-gray text-sm mb-1">¡Ganó!</p>
      <p className="text-uno-yellow text-3xl font-black mb-2">{winner?.name ?? '?'}</p>
      {iWon && <p className="text-uno-green text-sm font-bold mb-6">¡Esa eres tú! 🎉</p>}
      {!iWon && <p className="text-gray text-sm mb-6">Mejor suerte la próxima</p>}

      {/* Tabla de resultados */}
      <div className="w-full bg-surface rounded-2xl p-4 mb-6">
        <p className="text-gray text-xs mb-3">Puntuaciones finales</p>
        {sorted.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div className="flex items-center gap-3">
              <span className="text-gray text-sm w-5">{i + 1}</span>
              <span className={`text-sm font-bold ${p.id === winnerId ? 'text-uno-yellow' : 'text-white'}`}>
                {p.name} {p.id === winnerId && '🏆'} {p.id === session.playerId && '(tú)'}
              </span>
            </div>
            <span className="text-gray text-sm">{p.hand_count ?? 0} cartas restantes</span>
          </div>
        ))}
      </div>

      {/* Acciones */}
      <button
        onClick={onRematch}
        className="w-full bg-uno-green text-white font-bold py-4 rounded-xl mb-3 hover:brightness-110 active:scale-95 transition-all"
      >
        ¡Revancha!
      </button>
      <button
        onClick={onLobby}
        className="w-full bg-surface text-white font-bold py-3 rounded-xl hover:bg-surface2 transition-colors border border-border"
      >
        Ir al lobby
      </button>
    </div>
  )
}
