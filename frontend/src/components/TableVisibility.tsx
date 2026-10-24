import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, X } from 'lucide-react'

export const VISIBILITY_GROUPS = [
  ['names', 'Nombres sobre los jugadores', 'Incluye tu propio letrero en la sala 3D.'],
  ['views', 'Selector de vistas', 'Vista de mesa, recorrer sala y vista clásica.'],
  ['navigation', 'Movimiento y ayuda', 'Flechas, subir, bajar e instrucciones.'],
  ['header', 'Cabecera', 'Personaje, sonido e información de la sala.'],
  ['players', 'Lista de jugadores', 'Resumen de jugadores y cantidad de cartas.'],
  ['speed', 'Velocidad de bots', 'Selector de velocidad en partidas locales.'],
  ['actions', 'Acciones de juego', 'Mazo, carta en mesa y botón ¡NEXO!.'],
  ['hand', 'Tu mano', 'Tus cartas y la indicación de turno.'],
  ['messages', 'Reacciones y voz', 'Botones de reacciones y notas de voz.'],
] as const
export type VisibilityGroup = typeof VISIBILITY_GROUPS[number][0]
export type TableVisibility = Record<VisibilityGroup, boolean>
export const DEFAULT_VISIBILITY: TableVisibility = { names: true, views: true, navigation: true, header: true, players: true, speed: true, actions: true, hand: true, messages: true }

export function TableVisibilityControl({ value, onChange }: { value: TableVisibility; onChange: (next: TableVisibility) => void }) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const element = dialog.current!
    element.showModal()
    return () => { element.close(); trigger.current?.focus({ preventScroll: true }) }
  }, [open])
  return <>
    <button ref={trigger} type="button" className="table-visibility-eye" aria-label="Mostrar u ocultar controles" title="Mostrar u ocultar controles" aria-haspopup="dialog" onClick={() => setOpen(true)}><Eye size={19} aria-hidden="true" /></button>
    {open && createPortal(<dialog ref={dialog} className="table-visibility-dialog" aria-labelledby="table-visibility-title" onCancel={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false) }}>
      <div className="table-visibility-content">
        <header><h2 id="table-visibility-title">Elementos de la pantalla</h2><button type="button" aria-label="Cerrar panel de visibilidad" onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button></header>
        <p>Elige qué quieres ver. El ojo siempre estará disponible.</p>
        <div className="table-visibility-options">{VISIBILITY_GROUPS.map(([key, label, description]) => <label key={key}>
          <span><strong>{label}</strong><small>{description}</small></span>
          <input type="checkbox" checked={value[key]} onChange={event => onChange({ ...value, [key]: event.target.checked })} />
        </label>)}</div>
        <footer><button type="button" onClick={() => onChange({ ...DEFAULT_VISIBILITY })}>Mostrar todo</button><button type="button" onClick={() => setOpen(false)}>Listo</button></footer>
      </div>
    </dialog>, document.body)}
  </>
}
