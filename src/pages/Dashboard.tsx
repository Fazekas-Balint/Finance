import React, { useMemo } from 'react'
import { useDB } from '../lib/store'
import {
  accountBalances,
  averageCompleteMonths,
  capSlices,
  categoryBreakdown,
  monthBounds,
  monthTotals,
  recentMonths,
  savingRate,
  txSortDesc,
} from '../lib/analytics'
import { addMonths, fmtMonth, fmtMonthLong, monthKey, startOfMonth } from '../lib/date'
import { buildProjection, goalForecast } from '../lib/forecast'
import { buildInsights } from '../lib/insights'
import { fmtCompact, fmtFt, fmtPct, pctChange, sum } from '../lib/money'
import { BalanceChart, CategoryDonut, IncomeExpenseChart } from '../components/charts'
import { StatTile } from '../components/StatTile'
import { Button, Card, EmptyState, IconChip, Meter, SectionTitle } from '../components/ui'
import { InsightList } from '../components/InsightList'
import { TxRow } from '../components/TxRow'

export function Dashboard({
  onNavigate,
  onAddTx,
}: {
  onNavigate: (page: string) => void
  onAddTx: () => void
}) {
  const db = useDB()

  const curKey = monthKey(new Date())
  const prevKey = monthKey(addMonths(startOfMonth(new Date()), -1))

  const balances = useMemo(() => accountBalances(db), [db])
  const total = useMemo(() => sum(balances.map((b) => b.balance)), [balances])

  const cur = useMemo(() => monthTotals(db.transactions, curKey), [db.transactions, curKey])
  const prev = useMemo(() => monthTotals(db.transactions, prevKey), [db.transactions, prevKey])
  const months12 = useMemo(() => recentMonths(db, 12), [db])
  const avg = useMemo(() => averageCompleteMonths(db, 3), [db])

  const projection = useMemo(
    () => buildProjection(db, { pastMonths: 6, futureMonths: db.settings.horizonMonths }),
    [db],
  )
  const insights = useMemo(() => buildInsights(db), [db])

  const { from, to } = monthBounds(curKey)
  const slices = useMemo(
    () => capSlices(categoryBreakdown(db, 'expense', from, to)),
    [db, from, to],
  )

  const rate = savingRate(avg.income, avg.expense)
  const monthlyNet = projection.assumptions.monthlyNet
  const in12 = projection.points.find((p) => p.key === monthKey(addMonths(new Date(), 12)))
  const lastPoint = projection.points[projection.points.length - 1]

  const recent = useMemo(() => [...db.transactions].sort(txSortDesc).slice(0, 6), [db.transactions])
  const activeGoals = db.goals.filter((g) => !g.done).slice(0, 3)

  if (!db.transactions.length) {
    return (
      <Card>
        <EmptyState
          icon="compass"
          title="Üdv a Pénziránytűben"
          body="Rögzítsd az első bevételedet vagy kiadásodat, és azonnal látni fogod, mire megy el a pénzed, mennyit tudsz félretenni, és mikorra jön össze egy-egy célod. Ha előbb körbenéznél, a Beállítások oldalon egyetlen kattintással betölthetsz 14 hónapnyi mintaadatot."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="primary" icon="plus" onClick={onAddTx}>
                Első tétel rögzítése
              </Button>
              <Button variant="soft" onClick={() => onNavigate('settings')}>
                Mintaadat betöltése
              </Button>
            </div>
          }
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          hero
          label="Teljes vagyon"
          value={fmtFt(total)}
          hint={`${balances.length} számla összesen`}
          trend={months12.map((m) => m.net)}
          trendColor="var(--balance)"
        />
        <StatTile
          label={`Bevétel · ${fmtMonthLong(curKey)}`}
          value={fmtFt(cur.income)}
          delta={pctChange(cur.income, prev.income)}
          deltaLabel="előző hónaphoz"
          upIsGood
          icon="up"
          trend={months12.map((m) => m.income)}
          trendColor="var(--income)"
        />
        <StatTile
          label={`Kiadás · ${fmtMonthLong(curKey)}`}
          value={fmtFt(cur.expense)}
          delta={pctChange(cur.expense, prev.expense)}
          deltaLabel="előző hónaphoz"
          upIsGood={false}
          icon="down"
          trend={months12.map((m) => m.expense)}
          trendColor="var(--expense)"
        />
        <StatTile
          label="Megtakarítási ráta"
          value={rate === null ? '—' : fmtPct(rate)}
          hint={
            avg.months > 0
              ? `${avg.months} lezárt hónap átlaga · havi ${fmtFt(avg.net)}`
              : 'Még nincs lezárt hónap'
          }
          icon="target"
        />
      </div>

      <Card
        title="Mennyi pénzed lesz?"
        subtitle={
          monthlyNet > 0
            ? `A jelenlegi ritmus mellett havonta ${fmtFt(monthlyNet)} marad nálad.`
            : 'A jelenlegi ritmus mellett nem marad félretehető pénz – nézd meg a javaslatokat.'
        }
        action={
          <Button variant="soft" size="sm" icon="arrowRight" onClick={() => onNavigate('forecast')}>
            Mi lenne, ha…
          </Button>
        }
      >
        <BalanceChart points={projection.points} height={290} />
        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
          <Highlight
            label="Egy év múlva"
            value={in12 ? fmtFt(in12.balance) : '—'}
            sub={in12 ? `${fmtMonthLong(in12.key)} végén` : ''}
          />
          <Highlight
            label={`${db.settings.horizonMonths} hónap múlva`}
            value={lastPoint ? fmtFt(lastPoint.balance) : '—'}
            sub={lastPoint ? `${fmtMonthLong(lastPoint.key)} végén` : ''}
          />
          <Highlight
            label="Éves félretétel"
            value={fmtFt(Math.max(0, monthlyNet) * 12)}
            sub="a mostani tempóval"
          />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card
          title="Javaslatok neked"
          subtitle="A saját adataidból számolva, a legnagyobb hatásúak elöl"
          action={
            <Button
              variant="ghost"
              size="sm"
              icon="arrowRight"
              onClick={() => onNavigate('analytics')}
            >
              Részletek
            </Button>
          }
        >
          <InsightList insights={insights.slice(0, 4)} onNavigate={onNavigate} />
        </Card>

        <Card
          title={`Mire ment el a pénz · ${fmtMonthLong(curKey)}`}
          subtitle={`Összesen ${fmtFt(cur.expense)} kiadás`}
          action={
            <Button
              variant="ghost"
              size="sm"
              icon="arrowRight"
              onClick={() => onNavigate('analytics')}
            >
              Elemzés
            </Button>
          }
        >
          {slices.length ? (
            <CategoryDonut slices={slices} total={cur.expense} />
          ) : (
            <EmptyState
              icon="pie"
              title="Ebben a hónapban még nincs kiadás"
              body="Amint rögzítesz néhány tételt, itt látod majd a kategóriánkénti bontást."
            />
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card title="Havi mérleg" subtitle="Az elmúlt 12 hónap bevételei és kiadásai">
          <IncomeExpenseChart points={months12.map((m) => ({ ...m, label: fmtMonth(m.key) }))} />
        </Card>

        <Card
          title="Legutóbbi tételek"
          action={
            <Button
              variant="ghost"
              size="sm"
              icon="arrowRight"
              onClick={() => onNavigate('transactions')}
            >
              Összes
            </Button>
          }
        >
          <ul className="divide-y divide-line">
            {recent.map((t) => (
              <TxRow key={t.id} tx={t} db={db} compact />
            ))}
          </ul>
        </Card>
      </div>

      {activeGoals.length > 0 && (
        <div>
          <SectionTitle
            action={
              <Button
                variant="ghost"
                size="sm"
                icon="arrowRight"
                onClick={() => onNavigate('goals')}
              >
                Összes cél
              </Button>
            }
          >
            Megtakarítási célok
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeGoals.map((g) => {
              const gf = goalForecast(g, Math.max(0, monthlyNet))
              return (
                <Card key={g.id}>
                  <div className="flex items-start gap-3">
                    <IconChip icon={g.icon} color={g.color} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="truncate text-[13px] font-semibold text-ink">{g.name}</h3>
                        <span className="num text-[11.5px] text-muted">{fmtPct(gf.pct)}</span>
                      </div>
                      <div className="mt-2">
                        <Meter
                          value={g.saved}
                          max={g.target}
                          tone={gf.onTrack === false ? 'warning' : 'accent'}
                        />
                      </div>
                      <div className="mt-2 flex items-baseline justify-between gap-2 text-[11.5px]">
                        <span className="num text-ink-2">
                          {fmtCompact(g.saved)} / {fmtCompact(g.target)} Ft
                        </span>
                        <span className="text-muted">
                          {gf.etaKey ? fmtMonthLong(gf.etaKey) : 'nincs tempó'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Highlight({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="num mt-1 text-[17px] font-semibold text-ink">{value}</div>
      {sub && <div className="text-[11.5px] text-muted">{sub}</div>}
    </div>
  )
}
