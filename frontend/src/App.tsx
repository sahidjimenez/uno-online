import { useState, useEffect } from 'react'
import { ensureAnonSession } from './lib/supabase'
import { loadSession, clearSession, reconnect, fetchGameState } from './services/room.service'
import { Home }          from './pages/Home'
import { Lobby }         from './pages/Lobby'
import { Board }         from './pages/Board'
import { GameOver }      from './pages/GameOver'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { LocalSession, Player } from './types'

type Screen = 'home' | 'lobby' | 'board' | 'gameover'

export default function App() {
  const [screen,   setScreen]   = useState<Screen>('home')
  const [session,  setSession]  = useState<LocalSession | null>(null)
  const [winner,   setWinner]   = useState<string | null>(null)
  const [players,  setPlayers]  = useState<Player[]>([])
  const [ready,    setReady]    = useState(false)

  useEffect(() => {
    ensureAnonSession().then(async () => {
      const saved = loadSession()
      if (saved) {
        // Intentar reconectar al servidor (reactiva is_connected + heartbeat)
        const refreshed = await reconnect(saved.roomCode)
        if (!refreshed) {
          // La sesión ya no es válida (sala borrada o expirada)
          clearSession()
          setReady(true)
          return
        }
        setSession(refreshed)

        // Determinar pantalla correcta según el estado actual del juego
        const gs = await fetchGameState(refreshed.roomId)
        if (gs?.status === 'playing') {
          setScreen('board')
        } else if (gs?.status === 'finished') {
          clearSession()
        } else {
          setScreen('lobby')
        }
      }
      setReady(true)
    })
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-uno-red border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      {screen === 'home' && (
        <Home
          onEnter={(s, mode) => {
            setSession(s)
            setScreen(mode)
          }}
        />
      )}

      {screen === 'lobby' && session && (
        <Lobby
          session={session}
          onStart={() => setScreen('board')}
          onLeave={() => { clearSession(); setSession(null); setScreen('home') }}
        />
      )}

      {screen === 'board' && session && (
        <ErrorBoundary onReset={() => { clearSession(); setSession(null); setScreen('home') }}>
          <Board
            session={session}
            onFinish={(winnerId, finalPlayers) => {
              setWinner(winnerId)
              setPlayers(finalPlayers)
              setScreen('gameover')
            }}
          />
        </ErrorBoundary>
      )}

      {screen === 'gameover' && session && (
        <GameOver
          session={session}
          players={players}
          winnerId={winner ?? ''}
          onRematch={() => setScreen('lobby')}
          onLobby={() => { clearSession(); setSession(null); setScreen('home') }}
        />
      )}
    </>
  )
}
