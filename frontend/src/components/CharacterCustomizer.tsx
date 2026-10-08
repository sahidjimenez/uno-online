import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CLOTHING_COLORS, HAIR_COLORS, saveCharacter, type CharacterAppearance } from '../lib/character'
import { useCharacter } from '../hooks/useCharacter'
import './CharacterCustomizer.css'

const CharacterPreview = lazy(() => import('./CharacterPreview'))
const FIELDS = [
  { key: 'hair', label: 'Cabello', colors: HAIR_COLORS },
  { key: 'shirt', label: 'Camisa', colors: CLOTHING_COLORS },
  { key: 'pants', label: 'Pantalón', colors: CLOTHING_COLORS },
  { key: 'shoes', label: 'Zapatos', colors: CLOTHING_COLORS },
] as const

function Editor({ initial, onClose, onSave }: { initial: CharacterAppearance; onClose: () => void; onSave: (value: CharacterAppearance) => void }) {
  const [draft, setDraft] = useState(initial)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const element = dialog.current!; element.showModal(); return () => element.close() }, [])
  return createPortal(<dialog ref={dialog} className="character-dialog" aria-labelledby="character-title" onCancel={onClose}>
    <header className="character-heading"><div><p>TU ESTILO EN LA MESA</p><h2 id="character-title">Personaliza tu personaje</h2></div><button type="button" onClick={onClose} aria-label="Cerrar personalización">×</button></header>
    <div className="character-editor-body">
      <div className="character-preview-panel"><span className="character-preview-tag">VISTA PREVIA · 3D</span><Suspense fallback={<div className="character-preview-loading" role="status">Preparando tu personaje…</div>}><CharacterPreview appearance={draft} /></Suspense><p>Un lugar en la mesa. Un estilo propio.</p></div>
      <div className="character-options">
        <fieldset className="character-gender"><legend>Personaje</legend><div>{(['man', 'woman'] as const).map(gender => <label key={gender} className={draft.gender === gender ? 'is-selected' : ''}>
          <input type="radio" name="character-gender" value={gender} checked={draft.gender === gender} onChange={() => setDraft(value => ({ ...value, gender }))} />{gender === 'man' ? 'Hombre' : 'Mujer'}
        </label>)}</div></fieldset>
        {FIELDS.map(({ key, label, colors }) => <fieldset key={key} className="character-colors"><legend>{label} <span>{colors.find(color => color.id === draft[key])?.name}</span></legend><div>
          {colors.map(color => <label key={color.id} className={draft[key] === color.id ? 'is-selected' : ''} title={color.name}>
            <input type="radio" name={`character-${key}`} value={color.id} aria-label={`${label}: ${color.name}`} checked={draft[key] === color.id} onChange={() => setDraft(value => ({ ...value, [key]: color.id }))} />
            <span className="character-swatch" style={{ background: color.hex, color: color.id === 'white' || color.id === 'blonde' ? '#142b25' : '#fff' }}>{draft[key] === color.id ? '✓' : ''}</span><span>{color.name}</span>
          </label>)}
        </div></fieldset>)}
      </div>
    </div>
    <footer className="character-footer"><p>Tu apariencia se guarda en este navegador.</p><div><button type="button" className="character-cancel" onClick={onClose}>Cancelar</button><button type="button" className="character-save" onClick={() => onSave(draft)}>Guardar personaje</button></div></footer>
  </dialog>, document.body)
}

export function CharacterCustomizer({ compact = false }: { compact?: boolean }) {
  const appearance = useCharacter()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus()
    wasOpen.current = open
  }, [open])
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 5000); return () => clearTimeout(timer) }, [message])
  function close() { setOpen(false) }
  return <>
    <button ref={trigger} type="button" className={compact ? 'table-view-label character-trigger-compact' : 'character-trigger'} onClick={() => setOpen(true)} aria-haspopup="dialog">
      <span aria-hidden="true">◈</span> {compact ? 'Personaje' : 'Personalizar personaje'}{!compact && <span aria-hidden="true">→</span>}
    </button>
    {open && <Editor initial={appearance} onClose={close} onSave={value => { const persisted = saveCharacter(value); close(); setMessage(persisted ? 'Personaje guardado' : 'Personaje aplicado. El navegador no permite guardarlo para otra visita.') }} />}
    {message && <div className="character-save-message" role="status">{message}</div>}
  </>
}
