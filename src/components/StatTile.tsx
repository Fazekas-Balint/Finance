import React from 'react'
import { Sparkline } from './charts'
import { Icon, type IconKey } from './icons'
import { fmtPct } from '../lib/money'

export interface StatTileProps {
  label: string
  value: string
  delta?: number | null
  deltaLabel?: string
  upIsGood?: boolean
  hint?: string
  icon?: IconKey
  trend?: number[]
  trendColor?: string
  hero?: boolean
}

export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  upIsGood = true,
  hint,
  icon,
  trend,
  trendColor = 'var(--accent)',
  hero = false,
}: StatTileProps) {
  const hasDelta = delta !== undefined && delta !== null && isFinite(delta)
  const positive = hasDelta && (delta as number) > 0
  const neutral = hasDelta && Math.abs(delta as number) < 0.5
  const good = positive === upIsGood
  const deltaColor = neutral ? 'var(--ink-3)' : good ? 'var(--good)' : 'var(--critical)'

  return (
    <div className="rounded-md border border-line bg-panel px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow truncate">{label}</span>
        {icon && (
          <span className="shrink-0 text-muted">
            <Icon name={icon} size={14} />
          </span>
        )}
      </div>

      <div
        className={`num mt-1.5 font-semibold text-ink ${
          hero ? 'text-[clamp(1.6rem,3.4vw,2.1rem)] leading-none' : 'text-[19px] leading-tight'
        }`}
      >
        {value}
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {hasDelta && (
            <span
              className="inline-flex items-center gap-1 text-[11.5px] font-medium"
              style={{ color: deltaColor }}
            >
              <Icon name={neutral ? 'arrowRight' : positive ? 'up' : 'down'} size={12} />
              <span className="num">{fmtPct(Math.abs(delta as number), 1)}</span>
              {deltaLabel && <span className="font-normal text-muted">{deltaLabel}</span>}
            </span>
          )}
          {!hasDelta && hint && <span className="text-[11.5px] text-muted">{hint}</span>}
          {hasDelta && hint && <div className="mt-0.5 text-[11.5px] text-muted">{hint}</div>}
        </div>
        {trend && trend.length > 1 && (
          <div className="shrink-0">
            <Sparkline values={trend} color={trendColor} />
          </div>
        )}
      </div>
    </div>
  )
}
