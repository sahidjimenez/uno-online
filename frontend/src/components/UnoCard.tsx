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
      <div className={`${s.card} bg-surface2 border border-border flex items-center justify-center shrink-0`}>
        <div className="w-[70%] h-[80%] bg-border/40 rounded" />
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={[
        s.card,
        COLOR_BG[color],
        'relative flex items-center justify-center shrink-0 overflow-hidden transition-all duration-200',
        selected  ? '-translate-y-3 ring-2 ring-white' : '',
        playable  ? `${COLOR_GLOW[color]} hover:-translate-y-2 cursor-pointer` : '',
        !playable && onClick ? 'opacity-50 cursor-not-allowed' : '',
        animate === 'draw' ? 'animate-card-draw' : '',
        animate === 'play' ? 'animate-card-play' : '',
      ].join(' ')}
    >
      {/* Oval decorativo */}
      <div className={`${s.oval} absolute rounded-full bg-white/15 -rotate-[30deg]`} />
      {/* Label */}
      <span className={`${s.text} font-black text-white relative z-10 drop-shadow`}>
        {label}
      </span>
    </button>
  )
}
