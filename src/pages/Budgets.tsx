import React, { useMemo, useState } from 'react'
import { actions, useDB } from '../lib/store'
import { budgetRows, categoryAverage, lastMonths } from '../lib/analytics'
import { fmtMonthLong, monthKey } from '../lib/date'
import { fmtFt, fmtPct, parseAmount, sum } from '../lib/money'
import { StatTile } from '../components/StatTile'
import {
  AmountInput,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  IconChip,
  Meter,
  Modal,
  Select,
} from '../components/ui'
import { Icon } from '../components/icons'
import type { Category, DB } from '../lib/types'

export function Budgets() {
  const db = useDB()
  const [month, setMonth] = useState(monthKey(new Date()))
  const [editing, setEditing] = useState<Category | null>(null)

  const months = useMemo(() => lastMonths(12).reverse(), [])
  const rows = useMemo(() => budgetRows(db, month), [db, month])

  const totalBudget = sum(rows.map((r) => r.budget))
  const totalSpent = sum(rows.map((r) => r.spent))
  const isCurrent = month === monthKey(new Date())

  const unbudgeted = useMemo(
    () =>
      db.categories
        .filter((c) => c.kind === 'expense' && !c.archived && !(c.budget ?? 0))
        .map((c) => ({ category: c, avg: categoryAverage(db, c.id, 3) }))
        .filter((x) => x.avg > 0)
        .sort((a, b) => b.avg - a.avg),
    [db],
  )

  const overall = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          hero
          label={`Elköltve · ${fmtMonthLong(month)}`}
          value={fmtFt(totalSpent)}
          hint={totalBudget > 0 ? `${fmtFt(totalBudget)} keretből` : 'nincs beállított keret'}
        />
        <StatTile
          label="Keretből maradt"
          value={fmtFt(Math.max(0, totalBudget - totalSpent))}
          hint={
            totalBudget > 0 && totalSpent > totalBudget
              ? `${fmtFt(totalSpent - totalBudget)} túllépés`
              : 'a hónap végéig'
          }
          icon="coins"
        />
        <StatTile
          label="Keret kihasználtsága"
          value={totalBudget > 0 ? fmtPct(overall) : '—'}
          hint={rows.length ? `${rows.length} kategóriában` : ''}
          icon="budget"
        />
        <StatTile
          label="Túllépett kategóriák"
          value={String(rows.filter((r) => r.state === 'over').length)}
          hint={`${rows.filter((r) => r.state === 'warning').length} figyelmeztetés`}
          icon="warning"
        />
      </div>

      <Card
        title="Havi költségkeretek"
        subtitle={
          isCurrent
            ? 'A függőleges vonal mutatja, hol kellene tartanod a hónapból eltelt idő arányában.'
            : 'Lezárt hónap – a tényleges költés a kerethez képest.'
        }
        action={
          <Select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
            aria-label="Hónap"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {fmtMonthLong(m)}
              </option>
            ))}
          </Select>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon="budget"
            title="Még nincs beállított keret"
            body="A keret egy havi felső határ egy kategóriára. Ha beállítod, azonnal látod, hol tartasz a hónap közepén, és időben tudsz korrigálni. Alul találsz javaslatot az eddigi átlagaid alapján."
          />
        ) : (
          <ul className="space-y-4">
            {rows.map((r) => (
              <li key={r.category.id}>
                <div className="mb-1.5 flex items-center gap-2.5">
                  <IconChip icon={r.category.icon} color={r.category.color} size={24} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                    {r.category.name}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[11.5px] font-medium"
                    style={{
                      color:
                        r.state === 'over'
                          ? 'var(--critical)'
                          : r.state === 'warning'
                            ? 'var(--serious)'
                            : 'var(--ink-3)',
                    }}
                  >
                    {r.state === 'over' && <Icon name="warning" size={12} />}
                    <span className="num">{fmtPct(r.pct)}</span>
                  </span>
                  <IconButton
                    label="Keret módosítása"
                    icon="edit"
                    onClick={() => setEditing(r.category)}
                  />
                </div>
                <Meter
                  value={r.spent}
                  max={r.budget}
                  height={10}
                  tone={r.state === 'over' ? 'critical' : r.state === 'warning' ? 'serious' : 'accent'}
                  marker={isCurrent ? r.expectedPct : undefined}
                />
                <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[11.5px]">
                  <span className="num text-ink-2">
                    {fmtFt(r.spent)} / {fmtFt(r.budget)}
                  </span>
                  <span
                    className="num"
                    style={{ color: r.remaining < 0 ? 'var(--critical)' : 'var(--ink-3)' }}
                  >
                    {r.remaining < 0
                      ? `${fmtFt(-r.remaining)} túllépés`
                      : `${fmtFt(r.remaining)} maradt`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {unbudgeted.length > 0 && (
        <Card
          title="Keret nélküli kategóriák"
          subtitle="Az elmúlt 3 hónap átlaga alapján – egy kattintással beállítható"
        >
          <ul className="divide-y divide-line -mx-1">
            {unbudgeted.map(({ category, avg }) => (
              <li key={category.id} className="flex items-center gap-2.5 py-2">
                <IconChip icon={category.icon} color={category.color} size={24} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                  {category.name}
                </span>
                <span className="num text-[11.5px] text-muted">átlag {fmtFt(avg)} / hó</span>
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() =>
                    actions.saveCategory({ ...category, budget: Math.round(avg / 1000) * 1000 })
                  }
                >
                  Keret: {fmtFt(Math.round(avg / 1000) * 1000)}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <BudgetModal category={editing} onClose={() => setEditing(null)} db={db} />
    </div>
  )
}

function BudgetModal({
  category,
  onClose,
  db,
}: {
  category: Category | null
  onClose: () => void
  db: DB
}) {
  const [value, setValue] = useState('')

  React.useEffect(() => {
    setValue(category?.budget ? String(category.budget) : '')
  }, [category])

  const avg = category ? categoryAverage(db, category.id, 3) : 0

  return (
    <Modal
      open={Boolean(category)}
      onClose={onClose}
      width="max-w-sm"
      title={category ? `Keret – ${category.name}` : ''}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              if (category) actions.saveCategory({ ...category, budget: undefined })
              onClose()
            }}
          >
            Keret törlése
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (category)
                actions.saveCategory({ ...category, budget: parseAmount(value) || undefined })
              onClose()
            }}
          >
            Mentés
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Havi keret">
          <AmountInput value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </Field>
        {avg > 0 && (
          <p className="text-[13px] text-muted">
            Az elmúlt 3 hónapban átlagosan {fmtFt(avg)}-ot költöttél erre.{' '}
            <button
              className="underline underline-offset-2 hover:text-ink"
              onClick={() => setValue(String(Math.round(avg / 1000) * 1000))}
            >
              Beírom ezt
            </button>
          </p>
        )}
      </div>
    </Modal>
  )
}
