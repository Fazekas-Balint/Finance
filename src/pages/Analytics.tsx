import React, { useMemo, useState } from 'react'
import { useDB } from '../lib/store'
import { capSlices, categoryBreakdown, recentMonths, savingRate } from '../lib/analytics'
import { addMonths, fmtMonth, startOfMonth, toISO } from '../lib/date'
import { buildInsights } from '../lib/insights'
import { fmtFt, fmtPct, pctChange, sum } from '../lib/money'
import { CategoryDonut, CategoryTrendChart, IncomeExpenseChart } from '../components/charts'
import { StatTile } from '../components/StatTile'
import { Card, EmptyState, Segmented } from '../components/ui'
import { InsightList } from '../components/InsightList'
import { TxRow } from '../components/TxRow'

type Period = '1' | '3' | '6' | '12'

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: '1', label: 'Ez a hónap' },
  { value: '3', label: '3 hónap' },
  { value: '6', label: '6 hónap' },
  { value: '12', label: '12 hónap' },
]

export function Analytics() {
  const db = useDB()
  const [period, setPeriod] = useState<Period>('3')
  const [flow, setFlow] = useState<'expense' | 'income'>('expense')

  const n = Number(period)

  const range = useMemo(() => {
    const start = startOfMonth(addMonths(new Date(), -(n - 1)))
    const prevStart = startOfMonth(addMonths(new Date(), -(2 * n - 1)))
    return {
      from: toISO(start),
      to: toISO(new Date()),
      prevFrom: toISO(prevStart),
      prevTo: toISO(addMonths(new Date(), -n)),
    }
  }, [n])

  const slices = useMemo(
    () => capSlices(categoryBreakdown(db, flow, range.from, range.to)),
    [db, flow, range],
  )
  const prevSlices = useMemo(
    () => categoryBreakdown(db, flow, range.prevFrom, range.prevTo),
    [db, flow, range],
  )

  const total = sum(slices.map((s) => s.value))
  const prevTotal = sum(prevSlices.map((s) => s.value))

  const trendRows = useMemo(
    () =>
      slices
        .filter((s) => s.id !== '__other__')
        .slice(0, 8)
        .map((s) => ({
          name: s.name,
          icon: s.icon,
          color: s.color,
          current: s.value,
          previous: prevSlices.find((p) => p.id === s.id)?.value ?? 0,
        })),
    [slices, prevSlices],
  )

  const months12 = useMemo(() => recentMonths(db, 12), [db])
  const insights = useMemo(() => buildInsights(db), [db])

  const periodTx = useMemo(
    () => db.transactions.filter((t) => t.date >= range.from && t.date <= range.to),
    [db.transactions, range],
  )
  const income = sum(periodTx.filter((t) => t.kind === 'income').map((t) => t.amount))
  const expense = sum(periodTx.filter((t) => t.kind === 'expense').map((t) => t.amount))
  const rate = savingRate(income, expense)

  const biggest = useMemo(
    () =>
      [...periodTx]
        .filter((t) => t.kind === 'expense')
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6),
    [periodTx],
  )

  if (!db.transactions.length) {
    return (
      <Card>
        <EmptyState
          icon="analyze"
          title="Az elemzéshez tételek kellenek"
          body="Rögzíts néhány bevételt és kiadást – utána itt látod majd, mire megy el a pénzed, mely kategóriák nőttek, és hol tudsz a legtöbbet faragni."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented options={PERIODS} value={period} onChange={setPeriod} />
        <Segmented
          value={flow}
          onChange={setFlow}
          options={[
            { value: 'expense', label: 'Kiadások' },
            { value: 'income', label: 'Bevételek' },
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          hero
          label={`Kiadás · ${n === 1 ? 'ez a hónap' : `${n} hónap`}`}
          value={fmtFt(expense)}
          hint={n > 1 ? `havi átlag ${fmtFt(expense / n)}` : ''}
        />
        <StatTile
          label="Bevétel"
          value={fmtFt(income)}
          hint={n > 1 ? `havi átlag ${fmtFt(income / n)}` : ''}
          icon="up"
        />
        <StatTile
          label="Megmaradt"
          value={fmtFt(income - expense)}
          hint={rate !== null ? `${fmtPct(rate)} megtakarítási ráta` : ''}
          icon="coins"
        />
        <StatTile
          label="Változás az előző időszakhoz"
          value={fmtFt(total)}
          delta={pctChange(total, prevTotal)}
          deltaLabel={`vs. előző ${n} hónap`}
          upIsGood={flow === 'income'}
          icon="scale"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card
          title={flow === 'expense' ? 'Mire megy el a pénz' : 'Honnan jön a pénz'}
          subtitle={`Összesen ${fmtFt(total)}`}
        >
          {slices.length ? (
            <CategoryDonut
              slices={slices}
              total={total}
              totalLabel={flow === 'expense' ? 'Összes kiadás' : 'Összes bevétel'}
            />
          ) : (
            <EmptyState
              icon="pie"
              title="Nincs adat ebben az időszakban"
              body="Válassz hosszabb időszakot, vagy rögzíts tételeket."
            />
          )}
        </Card>

        <Card
          title="Kategóriák változása"
          subtitle={`A kiválasztott ${n} hónap az azt megelőző ${n} hónaphoz képest`}
        >
          {trendRows.length ? (
            <CategoryTrendChart rows={trendRows} />
          ) : (
            <EmptyState
              icon="bars"
              title="Nincs mit összehasonlítani"
              body="Ehhez legalább két időszaknyi adat kell."
            />
          )}
        </Card>
      </div>

      <Card title="Havi mérleg" subtitle="Az elmúlt 12 hónap">
        <IncomeExpenseChart
          points={months12.map((m) => ({ ...m, label: fmtMonth(m.key) }))}
          height={280}
        />
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card title="Minden javaslat" subtitle="A saját számaidból, hatás szerint sorrendben">
          <InsightList insights={insights} />
        </Card>

        <Card title="Legnagyobb kiadások" subtitle="A kiválasztott időszakban" bodyClassName="pt-0">
          {biggest.length ? (
            <ul className="divide-y divide-line -mx-1">
              {biggest.map((t) => (
                <TxRow key={t.id} tx={t} db={db} />
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted pt-4">Nincs kiadás ebben az időszakban.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
