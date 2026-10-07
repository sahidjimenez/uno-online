import type { CardColor, CardType } from '../types'

interface Props {
  color:     CardColor
  type:      CardType
  faceDown?: boolean
  size?:     'sm' | 'md' | 'lg'
  selected?: boolean
  playable?: boolean
  animate?:  'draw' | 'play'
  onClick?:  () => void
}

const COLOR_BG: Record<CardColor, string> = {
  red:    'bg-uno-red',
  blue:   'bg-uno-blue',
  green:  'bg-uno-green',
  yellow: 'bg-uno-yellow',
  wild:   'bg-uno-wild',
}

const COLOR_GLOW: Record<CardColor, string> = {
  red:    'shadow-[0_0_14px_3px_rgba(220,38,38,0.65)]',
  blue:   'shadow-[0_0_14px_3px_rgba(37,99,235,0.65)]',
  green:  'shadow-[0_0_14px_3px_rgba(22,163,74,0.65)]',
  yellow: 'shadow-[0_0_14px_3px_rgba(234,179,8,0.65)]',
  wild:   'shadow-[0_0_14px_3px_rgba(139,92,246,0.65)]',
}

const LABEL: Partial<Record<CardType, string>> = {
  skip:    '⊘',
  reverse: '⇄',
  draw2:   '+2',
  wild:    '★',
  wild4:   '+4',
}

const SIZE = {
  sm: { card: 'w-10 h-14 rounded-lg',  text: 'text-sm',  oval: 'w-7 h-10'  },
  md: { card: 'w-14 h-20 rounded-xl',  text: 'text-lg',  oval: 'w-9 h-14'  },
  lg: { card: 'w-20 h-28 rounded-2xl', text: 'text-3xl', oval: 'w-14 h-20' },
}

export function UnoCard({ color, type, faceDown, size = 'md', selected, playable, animate, onClick }: Props) {
  const s = SIZE[size]
  const label = LABEL[type] ?? type

  if (faceDown) {
    return (
      <div className={`${s.card} uno-card card-back`}>
        <span className="card-back-mark" aria-hidden="true">◇</span><span className="card-back-logo">NEXO</span>
      </div>
    )
  }

  return (
    <button
      aria-label={`${color} ${label}`}
      onClick={onClick}
      disabled={!onClick}
      className={[
        s.card,
        `uno-card card-${color}`,
        COLOR_BG[color],
        'relative flex items-center justify-center shrink-0 overflow-hidden transition-all duration-200',
        selected  ? '-translate-y-3 ring-2 ring-white' : '',
        playable  ? `${COLOR_GLOW[color]} hover:-translate-y-2 cursor-pointer` : '',
        !playable && onClick ? 'opacity-50 cursor-not-allowed' : '',
        animate === 'draw' ? 'animate-card-draw' : '',
        animate === 'play' ? 'animate-card-play' : '',
      ].join(' ')}
    >
      <div className="card-geometry" aria-hidden="true" />
      <span className="card-corner corner-top">{label}</span>
      <span className="card-corner corner-bottom">{label}</span>
      <span className="card-suit" aria-hidden="true">{{ red: '◆', blue: '●', green: '▲', yellow: '✦', wild: '◇' }[color]}</span>
      {/* Label */}
      <span className={`${s.text} font-black text-white relative z-10 drop-shadow`}>
        {label}
      </span>
    </button>
  )
}
