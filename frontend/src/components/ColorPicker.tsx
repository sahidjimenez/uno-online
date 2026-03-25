import type { CardColor } from '../types'

interface Props {
  onSelect: (color: CardColor) => void
  onCancel: () => void
}

const OPTIONS: { color: CardColor; label: string; bg: string }[] = [
  { color: 'red',    label: 'Rojo',     bg: 'bg-uno-red'    },
  { color: 'blue',   label: 'Azul',     bg: 'bg-uno-blue'   },
  { color: 'green',  label: 'Verde',    bg: 'bg-uno-green'  },
  { color: 'yellow', label: 'Amarillo', bg: 'bg-uno-yellow' },
]

export function ColorPicker({ onSelect, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 animate-bounce-in">
      <div className="bg-surface rounded-3xl p-6 w-80 shadow-2xl">
        <h2 className="text-white text-lg font-bold text-center mb-1">¿Qué color eliges?</h2>
        <p className="text-gray text-sm text-center mb-5">Carta Wild jugada</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {OPTIONS.map(({ color, label, bg }) => (
            <button
              key={color}
              onClick={() => onSelect(color)}
              className={`${bg} h-24 rounded-2xl flex flex-col items-center justify-center gap-2
                         hover:brightness-110 active:scale-95 transition-all`}
            >
              <div className="w-7 h-7 rounded-full bg-white/25" />
              <span className="text-white font-bold text-sm">{label}</span>
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
