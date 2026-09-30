import React from 'react'
import type { Insight, InsightLevel } from '../lib/insights'
import { fmtFt } from '../lib/money'
import { Icon, type IconKey } from './icons'
import { Button, EmptyState } from './ui'

const LEVEL: Record<InsightLevel, { color: string; label: string; icon: IconKey }> = {
  critical: { color: 'var(--critical)', label: 'Sürgős', icon: 'warning' },
  warning: { color: 'var(--warning)', label: 'Figyelj rá', icon: 'warning' },
  info: { color: 'var(--balance)', label: 'Tipp', icon: 'info' },
  good: { color: 'var(--good)', label: 'Jól áll', icon: 'check' },
}

export function InsightList({
  insights,
  onNavigate,
}: {
  insights: Insight[]
  onNavigate?: (page: string) => void
}) {
  if (!insights.length) {
    return (
      <EmptyState
        icon="check"
        title="Most nincs mit javasolni"
        body="A számok rendben vannak: nincs túllépett keret, a megtakarítási rátád tartja magát. Ahogy gyűlnek az adatok, itt jelennek meg az új észrevételek."
      />
    )
  }

  return (
    <ul className="space-y-2">
      {insights.map((i) => {
        const lv = LEVEL[i.level]
        return (
          <li
            key={i.id}
            className="flex items-start gap-3 rounded-sm border border-line bg-panel-2 p-3"
            style={{ borderLeft: `2px solid ${lv.color}` }}
          >
            <span className="mt-0.5 shrink-0 text-ink-2">
              <Icon name={i.icon as IconKey} size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.09em]"
                  style={{ color: lv.color }}
                >
                  <Icon name={lv.icon} size={11} />
                  {lv.label}
                </span>
                {i.impact !== undefined && Math.abs(i.impact) >= 1000 && (
                  <span className="num text-[11px] text-muted">
                    ~{fmtFt(Math.abs(i.impact))} / év
                  </span>
                )}
              </div>
              <h3 className="mt-1 text-[13px] font-semibold text-ink">{i.title}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{i.body}</p>
              {i.action && onNavigate && (
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="arrowRight"
                    className="-ml-2.5"
                    onClick={() => onNavigate(i.action!.page)}
                  >
                    {i.action.label}
                  </Button>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
