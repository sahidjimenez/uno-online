import type { CardColor } from '../types'

interface Props {
  onSelect: (color: CardColor) => void
  onCancel: () => void
}

const OPTIONS: { color: CardColor; label: string; symbol: string }[] = [
  { color: 'red',    label: 'Rojo',     symbol: '◆'    },
  { color: 'blue',   label: 'Azul',     symbol: '●'   },
  { color: 'green',  label: 'Verde',    symbol: '▲'  },
  { color: 'yellow', label: 'Amarillo', symbol: '✦' },
]

export function ColorPicker({ onSelect, onCancel }: Props) {
  return (
    <div className="nexo-color-backdrop fixed inset-0 flex items-center justify-center z-50">
      <div role="dialog" aria-modal="true" aria-labelledby="color-picker-title" className="nexo-color-dialog rounded-3xl p-6 w-80 shadow-2xl" onKeyDown={event => { if (event.key === 'Escape') onCancel() }}>
        <h2 id="color-picker-title" className="text-white text-lg font-bold text-center mb-1">¿Qué color eliges?</h2>
        <p className="text-gray text-sm text-center mb-5">Elige el color de tu comodín</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {OPTIONS.map(({ color, label, symbol }) => (
            <button
              key={color}
              onClick={() => onSelect(color)}
              autoFocus={color === 'red'}
              style={{ backgroundColor: `var(--card-${color})` }}
              className="nexo-color-option h-24 rounded-2xl flex flex-col items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all"
            >
              <span className="text-3xl" aria-hidden="true">{symbol}</span>
              <span className="font-bold text-sm">{label}</span>
            </button>
          ))}
        </div>

        <button onClick={onCancel} className="w-full text-gray text-sm text-center py-2 hover:text-white transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}
