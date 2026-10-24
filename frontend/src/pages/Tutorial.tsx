import { useEffect, useRef, useState } from 'react'
import { UnoCard } from '../components/UnoCard'
import { canPlay } from '../engine/rules'
import { attackSteps, createLesson, lessonInstruction, lessons, readTutorialProgress, specialSteps, TUTORIAL_PROGRESS_KEY, tutorialAction, tutorialSession, type TutorialState } from '../engine/tutorial'
import { Board } from './Board'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ColorPicker } from '../components/ColorPicker'
import type { CardColor, LocalSession } from '../types'
import './Tutorial.css'

const colors = { red: 'rojo', blue: 'azul', green: 'verde', yellow: 'amarillo', wild: 'comodín' }
const cardLabels: Record<string, string> = { skip: 'Salto', reverse: 'Reversa', wild: 'Comodín', wild4: '+4', draw2: '+2' }

export function Tutorial({ onExit, onPractice }: { onExit: () => void; onPractice: () => void }) {
  const [completed, setCompleted] = useState(readTutorialProgress)
  const [state, setState] = useState<TutorialState | null>(null)
  const [feedback, setFeedback] = useState('')
  const [storageWarning, setStorageWarning] = useState(false)
  const [pendingWild, setPendingWild] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<LocalSession | null>(null)
  const [challengeResult, setChallengeResult] = useState<'won' | 'lost' | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [state?.level, state?.step])
  function start(level: number) { setState(createLesson(level)); setFeedback(''); setPendingWild(null); setChallengeResult(null) }
  function saveProgress(level: number) {
    const progress = Math.max(completed, level + 1)
    setCompleted(progress)
    try { localStorage.setItem(TUTORIAL_PROGRESS_KEY, String(progress)) } catch { setStorageWarning(true) }
  }
  function act(action: 'play' | 'draw' | 'uno', cardId?: string, color?: CardColor) {
    if (!state) return
    if (action === 'play' && !color && state.game.hands.student.find(card => card.id === cardId)?.card_color === 'wild') {
      setPendingWild(cardId!); return
    }
    const next = tutorialAction(state, action, cardId, color)
    if (next === state) {
      setFeedback(color ? 'Para este ejercicio, elige azul. Vuelve a pulsar el comodín.' : 'Sigue la indicación de arriba: la acción resaltada te permite continuar.')
      return
    }
    setFeedback('')
    setState(next)
    if (next.step === 'complete') {
      saveProgress(next.level)
    }
  }
  const lesson = state ? lessons[state.level] : null
  const complete = state?.step === 'complete'
  const frozen = complete || state?.step === 'explained'
  if (challenge) return <ErrorBoundary onReset={() => setChallenge(null)}>
    <div className="tutorial-challenge">
      <Board local key={challenge.roomId} session={challenge} onExit={() => setChallenge(null)} onFinish={winner => {
        const won = winner === challenge.playerId
        setChallengeResult(won ? 'won' : 'lost')
        if (won) { saveProgress(6); setState(current => current ? { ...current, step: 'complete' } : current) }
        setChallenge(null)
      }} />
      <button className="tutorial-challenge-exit" onClick={() => setChallenge(null)}>← Volver al desafío</button>
    </div>
  </ErrorBoundary>
  return <main className="tutorial">
    <header className="tutorial-header"><span className="tutorial-brand">NEXO <small>ESCUELA DE CARTAS</small></span><button onClick={onExit}>← Salir del tutorial</button></header>
    {!state ? <section className="tutorial-menu">
      <span className="tutorial-kicker">APRENDE JUGANDO</span>
      <h1 ref={heading} tabIndex={-1}>Tu primera mesa empieza aquí.</h1>
      <p>Siete retos para aprender, paso a paso. Practica sin prisas y termina con una partida contra un bot.</p>
      <p className="tutorial-progress">{completed} de {lessons.length} niveles completados</p>
      <div className="tutorial-levels">{lessons.map((item, index) => <button key={item.title} disabled={index > completed} onClick={() => start(index)}>
        <span className="tutorial-level-number">{index < completed ? '✓' : `0${index + 1}`}</span>
        <strong>{item.title}</strong><span>{item.description}</span>
        <small>{index < completed ? 'Repetir nivel ↗' : index === completed ? 'Empezar nivel ↗' : 'Completa el nivel anterior'}</small>
      </button>)}</div>
      {completed === lessons.length && <button className="tutorial-primary" onClick={onPractice}>Practicar contra bots ↗</button>}
      <p className="tutorial-note">El progreso se guarda en este navegador.</p>
    </section> : <div className="tutorial-lesson">
      <nav className="tutorial-navigation" aria-label="Progreso del tutorial">
        <button onClick={() => { setState(null); setFeedback('') }}>← Niveles</button><span>Nivel {state.level + 1} de {lessons.length}</span><button onClick={() => start(state.level)}>Reiniciar</button>
      </nav>
      <section className={`tutorial-coach ${complete ? 'tutorial-success' : ''}`} aria-live="polite" aria-atomic="true">
        <span className="tutorial-kicker">{complete ? '✓ NIVEL COMPLETADO' : state.level === 3 || state.level === 4 ? `PASO ${state.phase + 1} DE ${state.level === 3 ? 3 : 4}` : state.step === 'drawn' ? 'PASO 2 DE 2 · JUEGA LA CARTA' : state.level === 2 ? 'PASO 1 DE 2 · ROBA UNA CARTA' : 'TU TURNO · SIGUE LA PISTA'}</span>
        <h1 ref={heading} tabIndex={-1}>{lesson!.title}</h1>
        <p>{lessonInstruction(state)}</p>
        {!complete && state.level === 2 && state.step === 'drawn' && <small>Si la carta robada no se puede jugar, el turno pasa al siguiente jugador.</small>}
      </section>
      {state.level === 6 ? <section className="tutorial-challenge-intro">
        {challengeResult === 'lost' && <p role="status">El bot ganó esta ronda. El nivel sigue disponible: vuelve a intentarlo cuando quieras.</p>}
        <p>Una partida completa, dos jugadores y las mismas reglas del juego. Elige tus jugadas sin una carta marcada por el tutorial.</p>
        <button className="tutorial-primary" onClick={() => {
          setChallengeResult(null)
          setChallenge({ ...tutorialSession, roomId: crypto.randomUUID(), name: 'Tú', playerCount: 2 })
        }}>{complete ? 'Jugar de nuevo' : challengeResult === 'lost' ? 'Reintentar desafío →' : 'Comenzar desafío →'}</button>
      </section> : <section className="tutorial-table" aria-label="Mesa de práctica">
        <div className="tutorial-guide"><span aria-hidden="true">◇</span><strong>Guía</strong><small>{complete ? '¡Bien jugado!' : 'Te espero. Tómate tu tiempo.'}</small></div>
        <div className="tutorial-piles">
          <div><button className={`tutorial-deck ${(state.level === 2 || (state.level === 4 && state.phase === 3)) && state.step === 'action' ? 'tutorial-target' : ''}`} disabled={frozen} onClick={() => act('draw')} aria-label="Robar una carta del mazo">
            <UnoCard faceDown color="wild" type="wild" size="lg" />
          </button><span>MAZO · ROBAR</span></div>
          <div><UnoCard color={state.game.gameState.top_card_color!} type={state.game.gameState.top_card_type!} size="lg" /><span>EN LA MESA · {colors[state.game.gameState.current_color!]}</span></div>
        </div>
        {state.game.gameState.draw_stack > 0 && <p className="tutorial-stack" role="status">+{state.game.gameState.draw_stack} cartas acumuladas</p>}
        {state.level >= 3 && <p className="tutorial-hand-caption">{state.game.gameState.direction === 1 ? '↻ Sentido horario' : '↺ Sentido antihorario'} · {state.game.gameState.current_player_id === 'student' ? 'Tu turno' : 'Turno del guía'}</p>}
        {state.step === 'announce' && <div className="tutorial-announce"><button className="tutorial-primary tutorial-target" onClick={() => act('uno')}>¡NEXO!</button></div>}
        <div className="tutorial-hand" aria-label="Tus cartas">{state.game.hands[tutorialSession.playerId].map(card => {
          const expected = state.level === 3 ? specialSteps[state.phase].card : state.level === 4 ? attackSteps[state.phase].card : state.level === 5 && state.step === 'action' ? 'skip' : null
          const target = !frozen && state.step !== 'announce' && canPlay(card, state.game.gameState) && (!expected || card.card_type === expected)
          return <div key={card.id} className={target ? 'tutorial-target' : ''}>
            <UnoCard color={card.card_color} type={card.card_type} size="lg" playable={!frozen} onClick={frozen ? undefined : () => act('play', card.id)} />
            <span>{cardLabels[card.card_type] ?? card.card_type}{card.card_color !== 'wild' && ` · ${colors[card.card_color]}`}</span>
          </div>
        })}</div>
        <p className="tutorial-hand-caption">{frozen ? 'Jugada completada' : 'TU MANO · Sigue la indicación de arriba'}</p>
      </section>}
      <p className="tutorial-feedback" role="status">{feedback}</p>
      {state.step === 'explained' && <div className="tutorial-finish"><button className="tutorial-primary" onClick={() => { setState(createLesson(state.level, state.phase + 1)); setFeedback('') }}>Siguiente paso →</button></div>}
      {pendingWild && <ColorPicker onSelect={color => { const id = pendingWild; setPendingWild(null); act('play', id, color) }} onCancel={() => setPendingWild(null)} />}
      {complete && <div className="tutorial-finish">
        <button onClick={() => start(state.level)}>Repetir nivel</button>
        <button className="tutorial-primary" onClick={() => state.level < lessons.length - 1 ? start(state.level + 1) : onPractice()}>{state.level < lessons.length - 1 ? 'Siguiente nivel →' : 'Practicar contra bots →'}</button>
        {state.level === lessons.length - 1 && <p>¡Completaste los siete niveles! Puedes repetir cualquier lección o seguir jugando.</p>}
      </div>}
    </div>}
    {storageWarning && <p role="status" className="tutorial-note">Puedes seguir jugando, pero este navegador no permitió guardar tu progreso.</p>}
  </main>
}

