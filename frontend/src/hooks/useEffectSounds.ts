import { useCallback, useEffect, useRef, useState } from 'react'

type SoundType = 'skip' | 'reverse' | 'draw_stack' | 'draw_resolved' | 'uno_penalty'
interface SoundEffect { id: string; type: SoundType; stack: number }
const STORAGE_KEY = 'nexo-sound-enabled'

// Original synthesized cues: no downloaded audio assets.
export function useEffectSounds(effect: SoundEffect | null) {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== 'false' } catch { return true }
  })
  const contextRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const enabledRef = useRef(enabled)
  const playedRef = useRef<string | null>(null)
  const unlock = useCallback(() => {
    if (!enabledRef.current || !window.AudioContext) return
    try {
      let context = contextRef.current
      if (!context) {
        context = new AudioContext()
        const master = context.createGain()
        master.gain.value = 0.22
        master.connect(context.destination)
        contextRef.current = context
        masterRef.current = master
      }
      if (context.state === 'suspended') void context.resume().catch(() => {})
    } catch { /* Audio is optional; the game remains playable. */ }
  }, [])
  useEffect(() => {
    document.addEventListener('pointerdown', unlock)
    document.addEventListener('keydown', unlock)
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
      const context = contextRef.current
      contextRef.current = null
      masterRef.current = null
      if (context && context.state !== 'closed') void context.close().catch(() => {})
    }
  }, [unlock])
  useEffect(() => {
    if (!effect || playedRef.current === effect.id) return
    playedRef.current = effect.id
    const context = contextRef.current
    const master = masterRef.current
    if (!enabledRef.current || !context || !master || context.state !== 'running' || document.hidden) return
    const tone = (frequency: number, endFrequency: number, delay: number, duration: number, type: OscillatorType = 'sine') => {
      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      const start = context.currentTime + delay
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, start)
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
      envelope.gain.setValueAtTime(0, start)
      envelope.gain.linearRampToValueAtTime(0.35, start + 0.015)
      envelope.gain.exponentialRampToValueAtTime(0.001, start + duration)
      oscillator.connect(envelope)
      envelope.connect(master)
      oscillator.start(start)
      oscillator.stop(start + duration + 0.02)
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect() }
    }
    if (effect.type === 'uno_penalty') {
      tone(180, 95, 0, 0.28, 'triangle')
      for (let i = 0; i < 4; i++) tone(520 - i * 70, 180, 0.32 + i * 0.12, 0.1, 'triangle')
    } else if (effect.type === 'reverse') {
      tone(240, 850, 0, 0.2, 'triangle')
      tone(850, 280, 0.17, 0.3, 'triangle')
    } else if (effect.type === 'draw_stack') {
      const boost = Math.min(effect.stack, 16) * 12
      ;[330, 440, 554].forEach((note, i) => tone(note + boost, note + boost, i * 0.085, 0.2, 'triangle'))
    } else if (effect.type === 'draw_resolved') {
      const count = Math.min(Math.max(effect.stack, 2), 6)
      for (let i = 0; i < count; i++) tone(350 - i * 30, 150, i * 0.075, 0.09, 'triangle')
    } else {
      tone(440, 440, 0, 0.09)
      tone(220, 220, 0.12, 0.16)
    }
  }, [effect])
  const toggle = useCallback(() => {
    const next = !enabledRef.current
    enabledRef.current = next
    setEnabled(next)
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* Storage may be unavailable. */ }
    const context = contextRef.current
    if (context && masterRef.current) {
      masterRef.current.gain.cancelScheduledValues(context.currentTime)
      masterRef.current.gain.setValueAtTime(next ? 0.22 : 0, context.currentTime)
    }
    if (next) unlock()
  }, [unlock])
  return { soundEnabled: enabled, toggleSound: toggle }
}
