import type { Player } from '../types'

interface Props {
  player:    Player
  cardCount: number
  isActive:  boolean
  compact?:  boolean
  direction?: 'h' | 'v'
  onCatch?:  () => void
}

const AVATAR_COLORS = [
  'bg-uno-red', 'bg-uno-blue', 'bg-uno-green', 'bg-uno-yellow',
  'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
]

export function OpponentPanel({ player, cardCount, isActive, compact, direction = 'h', onCatch }: Props) {
  const avatarColor = AVATAR_COLORS[player.seat_order % AVATAR_COLORS.length]
  const miniCards   = Math.min(cardCount, compact ? 4 : 6)

  if (direction === 'v') {
    return (
      <div className={[
        'flex flex-col items-center gap-1 bg-surface/90 rounded-xl p-2',
        isActive ? 'ring-2 ring-yellow ring-offset-1 ring-offset-table' : '',
        !player.is_connected ? 'opacity-40' : '',
        compact ? 'w-20 py-1' : 'w-20',
      ].join(' ')}>
        <div className={`${avatarColor} w-6 h-6 rounded-full`} />
        <span className="text-white text-[10px] font-bold truncate w-full text-center">
          {player.name.substring(0, 7)}
        </span>
        <span className="text-gray text-[9px]">{cardCount}✦</span>
        <div className="flex gap-[3px]">
          {Array.from({ length: miniCards }).map((_, i) => (
            <div key={i} className="w-2 h-3 bg-surface2 rounded-[2px]" />
          ))}
        </div>
        {player.has_called_uno && (
          <span className="text-[9px] font-black text-uno-yellow">UNO!</span>
        )}
        {onCatch && cardCount === 1 && !player.has_called_uno && (
          <button
            onClick={onCatch}
            className="text-[8px] font-black bg-uno-red text-white px-1.5 py-0.5 rounded-full animate-bounce-in"
          >
            ¡UNO!
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={[
      'flex items-center gap-2 bg-surface/90 rounded-xl px-3 py-2',
      isActive ? 'ring-2 ring-uno-yellow ring-offset-1 ring-offset-table' : '',
      !player.is_connected ? 'opacity-40' : '',
    ].join(' ')}>
      <div className={`${avatarColor} ${compact ? 'w-5 h-5' : 'w-7 h-7'} rounded-full shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className={`text-white font-bold truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>
          {player.name}
        </p>
        <p className="text-gray text-[9px]">{cardCount}✦ cartas</p>
      </div>
      <div className="flex gap-[3px] shrink-0">
        {Array.from({ length: miniCards }).map((_, i) => (
          <div key={i} className={`${compact ? 'w-2 h-3' : 'w-2.5 h-4'} bg-surface2 rounded-[2px]`} />
        ))}
      </div>
      {player.has_called_uno && (
        <span className="text-[10px] font-black text-uno-yellow ml-1">UNO!</span>
      )}
      {onCatch && cardCount === 1 && !player.has_called_uno && (
        <button
          onClick={onCatch}
          className="text-[9px] font-black bg-uno-red text-white px-2 py-0.5 rounded-full ml-1 animate-bounce-in"
        >
          ¡UNO!
        </button>
      )}
      {!player.is_connected && (
        <span className="text-[9px] text-gray ml-1">⚡off</span>
      )}
    </div>
  )
}
