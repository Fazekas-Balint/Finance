import React, { useEffect, useMemo, useState } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fmtCompact, fmtFt, fmtPct } from '../lib/money'
import { fmtMonthLong } from '../lib/date'
import { Dot } from './ui'
import { Icon } from './icons'

const VAR_RE = /^var\((--[a-zA-Z0-9-]+)\)$/

export interface ChartTheme {
  surface: string
  ink: string
  ink2: string
  muted: string
  grid: string
  axis: string
  income: string
  expense: string
  balance: string
  accent: string
  good: string
  warning: string
  critical: string
  series: string[]
  fontMono: string
  resolve: (color: string) => string
}

export function useChartTheme(): ChartTheme {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    const mo = new MutationObserver(bump)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', bump)
    return () => {
      mo.disconnect()
      mq.removeEventListener('change', bump)
    }
  }, [])

  return useMemo(() => {
    const cs = getComputedStyle(document.documentElement)
    const v = (name: string) => cs.getPropertyValue(name).trim()
    const names = [
      '--panel',
      '--ink',
      '--ink-2',
      '--ink-3',
      '--grid',
      '--axis',
      '--income',
      '--expense',
      '--balance',
      '--accent',
      '--good',
      '--warning',
      '--critical',
      '--s1',
      '--s2',
      '--s3',
      '--s4',
      '--s5',
      '--s6',
      '--s7',
      '--s8',
    ]
    const map: Record<string, string> = {}
    for (const n of names) map[n] = v(n) || '#888888'

    const resolve = (color: string) => {
      const m = VAR_RE.exec(color?.trim() ?? '')
      if (!m) return color || map['--ink-3']
      return map[m[1]] ?? v(m[1]) ?? map['--ink-3']
    }

    return {
      surface: map['--panel'],
      ink: map['--ink'],
      ink2: map['--ink-2'],
      muted: map['--ink-3'],
      grid: map['--grid'],
      axis: map['--axis'],
      income: map['--income'],
      expense: map['--expense'],
      balance: map['--balance'],
      accent: map['--accent'],
      good: map['--good'],
      warning: map['--warning'],
      critical: map['--critical'],
      series: [
        map['--s1'],
        map['--s2'],
        map['--s3'],
        map['--s4'],
        map['--s5'],
        map['--s6'],
        map['--s7'],
        map['--s8'],
      ],
      fontMono:
        v('--font-mono') ||
        'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      resolve,
    }
  }, [tick])
}

export function Legend({
  items,
}: {
  items: Array<{ color: string; label: string; dashed?: boolean }>
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2 text-[11.5px] text-ink-2">
          {it.dashed ? (
            <span
              aria-hidden
              className="inline-block h-0.5 w-4 shrink-0"
              style={{
                backgroundImage: `repeating-linear-gradient(90deg, ${it.color} 0 4px, transparent 4px 7px)`,
              }}
            />
          ) : (
            <Dot color={it.color} />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  )
}

function TooltipShell({ title, rows }: { title: string; rows: React.ReactNode }) {
  return (
    <div className="min-w-44 rounded-sm border border-line-strong bg-panel px-3 py-2 shadow-xl">
      <div className="mb-1.5 text-[11.5px] font-semibold text-ink">{title}</div>
      <div className="space-y-1">{rows}</div>
    </div>
  )
}

function TipRow({
  color,
  label,
  value,
  dashed,
}: {
  color: string
  label: string
  value: string
  dashed?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-[11.5px]">
      <span className="flex items-center gap-2 text-ink-2">
        {dashed ? (
          <span
            aria-hidden
            className="inline-block h-0.5 w-3 shrink-0"
            style={{
              backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)`,
            }}
          />
        ) : (
          <Dot color={color} size={6} />
        )}
        {label}
      </span>
      <span className="num font-medium text-ink">{value}</span>
    </div>
  )
}

export interface BalancePoint {
  key: string
  label: string
  balance: number
  income: number
  expense: number
  net: number
  actual: boolean
  current: boolean
}

export function BalanceChart({
  points,
  height = 300,
  targetAmount,
  targetLabel,
  baseline,
  baselineLabel = 'Jelenlegi ritmus',
}: {
  points: BalancePoint[]
  height?: number
  targetAmount?: number
  targetLabel?: string
  baseline?: BalancePoint[]
  baselineLabel?: string
}) {
  const t = useChartTheme()
  const axisTick = { fill: t.muted, fontSize: 11, fontFamily: t.fontMono }

  const lastActual = points.reduce((acc, p, i) => (p.actual || p.current ? i : acc), -1)
  const data = points.map((p, i) => ({
    ...p,
    actualBalance: i <= lastActual ? p.balance : null,
    projBalance: i >= lastActual ? p.balance : null,
    baseBalance: baseline && i >= lastActual ? (baseline[i]?.balance ?? null) : null,
  }))

  const nowIndex = points.findIndex((p) => p.current)
  const hasProjection = lastActual < points.length - 1

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="balanceWash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={t.balance} stopOpacity={0.18} />
                <stop offset="100%" stopColor={t.balance} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={t.grid} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="label"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: t.axis }}
              minTickGap={16}
            />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={54}
              tickFormatter={(v: number) => fmtCompact(v)}
            />
            <Tooltip
              cursor={{ stroke: t.axis, strokeWidth: 1 }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as BalancePoint & { baseBalance: number | null }
                return (
                  <TooltipShell
                    title={`${fmtMonthLong(p.key)}${p.actual ? '' : p.current ? ' · részben terv' : ' · előrejelzés'}`}
                    rows={
                      <>
                        <TipRow
                          color={t.balance}
                          label="Vagyon a hó végén"
                          value={fmtFt(p.balance)}
                          dashed={!p.actual}
                        />
                        {p.baseBalance !== null && p.baseBalance !== undefined && (
                          <TipRow
                            color={t.muted}
                            label={baselineLabel}
                            value={fmtFt(p.baseBalance)}
                          />
                        )}
                        <TipRow color={t.income} label="Bevétel" value={fmtFt(p.income)} />
                        <TipRow color={t.expense} label="Kiadás" value={fmtFt(p.expense)} />
                        <TipRow
                          color={p.net >= 0 ? t.good : t.critical}
                          label="Egyenleg"
                          value={fmtFt(p.net)}
                        />
                      </>
                    }
                  />
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="none"
              fill="url(#balanceWash)"
              isAnimationActive={false}
            />
            {targetAmount !== undefined && targetAmount > 0 && (
              <ReferenceLine
                y={targetAmount}
                stroke={t.good}
                strokeWidth={1}
                label={{
                  value: targetLabel ?? fmtFt(targetAmount),
                  position: 'insideTopLeft',
                  fill: t.ink2,
                  fontSize: 11,
                }}
              />
            )}
            <ReferenceLine y={0} stroke={t.axis} strokeWidth={1} />
            {nowIndex >= 0 && (
              <ReferenceLine
                x={points[nowIndex].label}
                stroke={t.axis}
                strokeWidth={1}
                label={{ value: 'ma', position: 'top', fill: t.muted, fontSize: 10 }}
              />
            )}
            {baseline && (
              <Line
                type="monotone"
                dataKey="baseBalance"
                stroke={t.muted}
                strokeWidth={2}
                strokeLinecap="round"
                dot={false}
                activeDot={{ r: 4, stroke: t.surface, strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls
              />
            )}
            <Line
              type="monotone"
              dataKey="actualBalance"
              stroke={t.balance}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 4, stroke: t.surface, strokeWidth: 2 }}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="projBalance"
              stroke={t.balance}
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, stroke: t.surface, strokeWidth: 2 }}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Legend
          items={[
            { color: t.balance, label: 'Eddigi tény' },
            ...(hasProjection ? [{ color: t.balance, label: 'Előrejelzés', dashed: true }] : []),
            ...(baseline ? [{ color: t.muted, label: baselineLabel }] : []),
          ]}
        />
        <span className="num text-[11.5px] text-muted">
          Utolsó pont: {fmtFt(points[points.length - 1]?.balance ?? 0)}
        </span>
      </div>
    </div>
  )
}

export function IncomeExpenseChart({
  points,
  height = 260,
}: {
  points: Array<{ key: string; label: string; income: number; expense: number; net: number }>
  height?: number
}) {
  const t = useChartTheme()
  const axisTick = { fill: t.muted, fontSize: 11, fontFamily: t.fontMono }

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid stroke={t.grid} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="label"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: t.axis }}
              minTickGap={12}
            />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={54}
              tickFormatter={(v: number) => fmtCompact(v)}
            />
            <Tooltip
              cursor={{ fill: t.grid, fillOpacity: 0.4 }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload
                return (
                  <TooltipShell
                    title={fmtMonthLong(p.key)}
                    rows={
                      <>
                        <TipRow color={t.income} label="Bevétel" value={fmtFt(p.income)} />
                        <TipRow color={t.expense} label="Kiadás" value={fmtFt(p.expense)} />
                        <TipRow
                          color={p.net >= 0 ? t.good : t.critical}
                          label="Megmaradt"
                          value={fmtFt(p.net)}
                        />
                      </>
                    }
                  />
                )
              }}
            />
            <Bar
              dataKey="income"
              fill={t.income}
              radius={[3, 3, 0, 0]}
              maxBarSize={20}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expense"
              fill={t.expense}
              radius={[3, 3, 0, 0]}
              maxBarSize={20}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3">
        <Legend
          items={[
            { color: t.income, label: 'Bevétel' },
            { color: t.expense, label: 'Kiadás' },
          ]}
        />
      </div>
    </div>
  )
}

export function CategoryDonut({
  slices,
  total,
  totalLabel = 'Összes kiadás',
  height = 240,
}: {
  slices: Array<{
    id: string
    name: string
    color: string
    icon: string
    value: number
    share: number
  }>
  total: number
  totalLabel?: string
  height?: number
}) {
  const t = useChartTheme()
  const data = slices.map((s) => ({ ...s, fill: t.resolve(s.color) }))

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="92%"
              paddingAngle={2}
              stroke={t.surface}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.id} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload
                return (
                  <TooltipShell
                    title={p.name}
                    rows={
                      <>
                        <TipRow color={p.fill} label="Összeg" value={fmtFt(p.value)} />
                        <TipRow color={p.fill} label="Arány" value={fmtPct(p.share, 1)} />
                      </>
                    }
                  />
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="eyebrow">{totalLabel}</span>
          <span className="num mt-0.5 text-[17px] font-semibold text-ink">
            {fmtCompact(total)} Ft
          </span>
        </div>
      </div>

      <ul className="min-w-0 space-y-1">
        {data.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-2.5 border-b border-line py-1 text-[12.5px] last:border-0"
          >
            <Dot color={s.fill} />
            <span className="shrink-0 text-muted">
              <Icon name={s.icon} size={13} />
            </span>
            <span className="min-w-0 flex-1 truncate text-ink-2">{s.name}</span>
            <span className="num w-10 text-right text-muted">{fmtPct(s.share, 0)}</span>
            <span className="num w-24 text-right font-medium text-ink">{fmtFt(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CategoryTrendChart({
  rows,
  height,
}: {
  rows: Array<{ name: string; icon: string; color: string; current: number; previous: number }>
  height?: number
}) {
  const t = useChartTheme()
  const h = height ?? Math.max(180, rows.length * 44 + 40)
  const axisTick = { fill: t.muted, fontSize: 11, fontFamily: t.fontMono }

  return (
    <div>
      <div style={{ height: h }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
            barGap={2}
          >
            <CartesianGrid stroke={t.grid} strokeWidth={1} horizontal={false} />
            <XAxis
              type="number"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: t.axis }}
              tickFormatter={(v: number) => fmtCompact(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: t.ink2, fontSize: 11.5 }}
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <Tooltip
              cursor={{ fill: t.grid, fillOpacity: 0.4 }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload
                const diff = p.current - p.previous
                return (
                  <TooltipShell
                    title={p.name}
                    rows={
                      <>
                        <TipRow color={t.accent} label="Kiválasztott" value={fmtFt(p.current)} />
                        <TipRow color={t.muted} label="Előző időszak" value={fmtFt(p.previous)} />
                        <TipRow
                          color={diff > 0 ? t.critical : t.good}
                          label="Változás"
                          value={`${diff > 0 ? '+' : ''}${fmtFt(diff)}`}
                        />
                      </>
                    }
                  />
                )
              }}
            />
            <Bar
              dataKey="previous"
              fill={t.muted}
              fillOpacity={0.45}
              radius={[0, 3, 3, 0]}
              maxBarSize={12}
              isAnimationActive={false}
            />
            <Bar
              dataKey="current"
              fill={t.accent}
              radius={[0, 3, 3, 0]}
              maxBarSize={12}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3">
        <Legend
          items={[
            { color: t.accent, label: 'Kiválasztott időszak' },
            { color: t.muted, label: 'Előző időszak' },
          ]}
        />
      </div>
    </div>
  )
}

export function Sparkline({
  values,
  color,
  width = 84,
  height = 24,
}: {
  values: number[]
  color: string
  width?: number
  height?: number
}) {
  if (values.length < 2) return null
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const span = max - min || 1
  const step = width / (values.length - 1)
  const pts = values.map((v, i) => [i * step, height - ((v - min) / span) * (height - 4) - 2])
  const d = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ')
  const last = pts[pts.length - 1]

  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.55}
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={2.5}
        fill={color}
        stroke="var(--panel)"
        strokeWidth={2}
      />
    </svg>
  )
}
