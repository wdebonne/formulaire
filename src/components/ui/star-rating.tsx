'use client'

import { useState } from 'react'
import { Star, Heart, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StarIconType = 'star' | 'heart' | 'thumb'
export type StarSize = 'sm' | 'md' | 'lg'

const ICONS = {
  star: Star,
  heart: Heart,
  thumb: ThumbsUp,
}

const SIZE_CLASSES: Record<StarSize, string> = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-11 h-11',
}

const GAP_CLASSES: Record<StarSize, string> = {
  sm: 'gap-1',
  md: 'gap-2',
  lg: 'gap-3',
}

export const DEFAULT_STAR_COLOR = '#FACC15'

// Le nombre d'icônes reprend la valeur Max du bloc, borné pour rester lisible
export function getStarCount(max?: number): number {
  const parsed = Math.round(Number(max))
  if (!Number.isFinite(parsed)) return 5
  return Math.min(Math.max(parsed, 1), 20)
}

interface StarRatingProps {
  count: number
  value?: number
  onChange?: (value: number) => void
  icon?: StarIconType
  color?: string
  emptyColor?: string
  size?: StarSize
  readOnly?: boolean
  showValue?: boolean
  className?: string
}

export function StarRating({
  count,
  value,
  onChange,
  icon = 'star',
  color = DEFAULT_STAR_COLOR,
  emptyColor,
  size = 'md',
  readOnly = false,
  showValue = true,
  className,
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const Icon = ICONS[icon] || Star
  const current = Number(value) || 0
  const displayed = hovered ?? current
  const interactive = !readOnly && !!onChange

  const handleClick = (rating: number) => {
    if (!interactive) return
    onChange?.(rating === current ? 0 : rating)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className={cn('flex flex-wrap items-center', GAP_CLASSES[size])}
        onMouseLeave={() => setHovered(null)}
      >
        {Array.from({ length: count }, (_, i) => i + 1).map((rating) => {
          const filled = rating <= displayed
          return (
            <button
              key={rating}
              type="button"
              disabled={!interactive}
              aria-label={`${rating} / ${count}`}
              aria-pressed={rating <= current}
              onClick={() => handleClick(rating)}
              onMouseEnter={() => interactive && setHovered(rating)}
              onFocus={() => interactive && setHovered(rating)}
              onBlur={() => setHovered(null)}
              className={cn(
                'transition-transform outline-none',
                interactive
                  ? 'cursor-pointer hover:scale-110 active:scale-95 focus-visible:scale-110'
                  : 'cursor-default'
              )}
            >
              <Icon
                className={cn(SIZE_CLASSES[size], 'transition-colors')}
                style={{
                  color: filled ? color : emptyColor || color,
                  fill: filled ? color : 'transparent',
                  opacity: filled ? 1 : 0.35,
                }}
                strokeWidth={1.5}
              />
            </button>
          )
        })}
      </div>

      {showValue && (
        <span className="text-sm font-medium" style={{ color: emptyColor }}>
          {current > 0 ? `${current} / ${count}` : ''}
        </span>
      )}
    </div>
  )
}
