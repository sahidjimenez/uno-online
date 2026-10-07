import { StatusScreen } from './components/StatusScreen'
import { OFFLINE_MODE } from './lib/offline'
import { OfflineApp } from './OfflineApp'
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

function OnlineApp({ onLocal }: { onLocal: () => void }) {
  const [screen,   setScreen]   = useState<Screen>('home')
  const [session,  setSession]  = useState<LocalSession | null>(null)
  const [winner,   setWinner]   = useState<string | null>(null)
  const [players,  setPlayers]  = useState<Player[]>([])
  const [ready,    setReady]    = useState(false)
  const [connectionError, setConnectionError] = useState(false)

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
    }).catch(() => { setConnectionError(true); setReady(true) })
  }, [])

  if (connectionError) return <StatusScreen title="No pudimos conectar" description="Puedes jugar con bots mientras vuelve la conexión.">
    <button onClick={onLocal} className="nexo-primary-button">Jugar local con bots</button>
    <button onClick={() => window.location.reload()} className="nexo-secondary-button">Reintentar conexión</button>
  </StatusScreen>
  if (!ready) return <StatusScreen loading title="Conectando con la mesa" description="Preparando tu lugar en NEXO…">
    <button onClick={onLocal} className="nexo-secondary-button">Jugar local con bots</button>
  </StatusScreen>

  return (
    <>
      {screen === 'home' && <button onClick={onLocal} className="mode-switch-button online-mode-switch">← Jugar local con bots</button>}
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

export default function App() {
  const [local, setLocal] = useState(OFFLINE_MODE)
  return local ? <OfflineApp onOnline={() => setLocal(false)} /> : <OnlineApp onLocal={() => setLocal(true)} />
}
