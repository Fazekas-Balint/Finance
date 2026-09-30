import React, { useEffect, useMemo, useState } from 'react'
import { actions, useDB } from '../lib/store'
import { averageCompleteMonths } from '../lib/analytics'
import { FREQ_LABEL, monthlyEquivalent, occurrencesBetween } from '../lib/forecast'
import { addDays, fmtDateShort, today } from '../lib/date'
import { fmtFt, fmtPct, parseAmount, sum } from '../lib/money'
import {
  AmountInput,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  Field,
  IconButton,
  Input,
  IconChip,
  Meter,
  Modal,
  Segmented,
  Select,
  Toggle,
} from '../components/ui'
import { StatTile } from '../components/StatTile'
import type { Freq, Recurring } from '../lib/types'

const FREQS: Array<{ value: Freq; label: string }> = [
  { value: 'weekly', label: 'Hetente' },
  { value: 'biweekly', label: 'Kéthetente' },
  { value: 'monthly', label: 'Havonta' },
  { value: 'quarterly', label: 'Negyedévente' },
  { value: 'yearly', label: 'Évente' },
]

export function RecurringPage() {
  const db = useDB()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Recurring | null>(null)
  const [deleting, setDeleting] = useState<Recurring | null>(null)

  const income = db.recurring.filter((r) => r.kind === 'income')
  const expense = db.recurring.filter((r) => r.kind === 'expense')

  const monthlyIncome = sum(income.filter((r) => r.active).map(monthlyEquivalent))
  const monthlyExpense = sum(expense.filter((r) => r.active).map(monthlyEquivalent))
  const avg = averageCompleteMonths(db, 3)
  const fixedShare = avg.income > 0 ? (monthlyExpense / avg.income) * 100 : 0

  const upcoming = useMemo(() => {
    const from = new Date()
    const to = addDays(from, 30)
    return db.recurring
      .flatMap((r) => occurrencesBetween(r, from, to))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(0, 8)
  }, [db.recurring])

  const upcomingNet = useMemo(
    () =>
      sum(
        db.recurring
          .flatMap((r) => occurrencesBetween(r, new Date(), addDays(new Date(), 30)))
          .map((o) => (o.recurring.kind === 'income' ? o.amount : -o.amount)),
      ),
    [db.recurring],
  )

  function startNew() {
    setEditing(null)
    setOpen(true)
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Fix bevétel / hó" value={fmtFt(monthlyIncome)} icon="recurring" />
        <StatTile label="Fix kiadás / hó" value={fmtFt(monthlyExpense)} icon="bill" />
        <StatTile
          label="Fix kiadás éves szinten"
          value={fmtFt(monthlyExpense * 12)}
          hint="ennyibe kerül egy év, ha semmi nem változik"
        />
        <StatTile
          label="A bevételed hány százaléka fix"
          value={avg.income > 0 ? fmtPct(fixedShare) : '—'}
          hint={fixedShare > 60 ? 'Magas – kevés a mozgástered' : '50% alatt kényelmes'}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card
            title="Rendszeres bevételek"
            subtitle="Fizetés, bérleti díj, minden ami menetrend szerint érkezik"
            action={
              <Button variant="soft" size="sm" icon="plus" onClick={startNew}>
                Új tétel
              </Button>
            }
            bodyClassName={income.length ? 'pt-0' : ''}
          >
            {income.length ? (
              <RecurringList
                items={income}
                onEdit={(r) => {
                  setEditing(r)
                  setOpen(true)
                }}
                onDelete={setDeleting}
              />
            ) : (
              <EmptyState
                icon="work"
                title="Nincs rögzített rendszeres bevétel"
                body="A fizetésed felvételével az előrejelzés azonnal sokkal pontosabb lesz."
                action={
                  <Button variant="primary" onClick={startNew}>
                    Bevétel hozzáadása
                  </Button>
                }
              />
            )}
          </Card>

          <Card
            title="Rendszeres kiadások"
            subtitle="Albérlet, rezsi, előfizetések, biztosítás"
            action={
              <Button variant="soft" size="sm" icon="plus" onClick={startNew}>
                Új tétel
              </Button>
            }
            bodyClassName={expense.length ? 'pt-0' : ''}
          >
            {expense.length ? (
              <RecurringList
                items={expense}
                onEdit={(r) => {
                  setEditing(r)
                  setOpen(true)
                }}
                onDelete={setDeleting}
              />
            ) : (
              <EmptyState
                icon="bill"
                title="Nincs rögzített fix költség"
                body="Vedd fel a havi állandó tételeidet – ezek adják az előrejelzés gerincét, és itt derül ki, mennyibe kerülnek éves szinten."
                action={
                  <Button variant="primary" onClick={startNew}>
                    Fix költség hozzáadása
                  </Button>
                }
              />
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Következő 30 nap"
            subtitle={`Várható egyenleg: ${upcomingNet >= 0 ? '+' : '−'}${fmtFt(Math.abs(upcomingNet))}`}
          >
            {upcoming.length ? (
              <ul className="space-y-2.5">
                {upcoming.map((o, i) => (
                  <li key={`${o.recurring.id}-${o.date}-${i}`} className="flex items-center gap-3">
                    <span className="num w-16 shrink-0 text-[11.5px] text-muted">
                      {fmtDateShort(o.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                      {o.recurring.name}
                    </span>
                    <span
                      className="num text-[12.5px] font-semibold"
                      style={{
                        color: o.recurring.kind === 'income' ? 'var(--income)' : 'var(--ink)',
                      }}
                    >
                      {o.recurring.kind === 'income' ? '+' : '−'}
                      {fmtFt(o.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">
                A következő 30 napban nincs esedékes rendszeres tétel.
              </p>
            )}
          </Card>

          {expense.length > 0 && (
            <Card title="Mi viszi a legtöbbet" subtitle="Havi átlagra vetítve">
              <ul className="space-y-3">
                {[...expense]
                  .filter((r) => r.active)
                  .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))
                  .slice(0, 6)
                  .map((r) => (
                    <li key={r.id}>
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className="text-[13px] text-ink truncate">{r.name}</span>
                        <span className="text-[13px] font-medium text-ink num shrink-0">
                          {fmtFt(monthlyEquivalent(r))}
                        </span>
                      </div>
                      <Meter
                        value={monthlyEquivalent(r)}
                        max={monthlyExpense}
                        tone="accent"
                        height={6}
                      />
                    </li>
                  ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <RecurringModal
        open={open}
        onClose={() => {
          setOpen(false)
          setEditing(null)
        }}
        editing={editing}
      />
      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && actions.deleteRecurring(deleting.id)}
        title="Rendszeres tétel törlése"
        body={
          deleting
            ? `A(z) „${deleting.name}” sablon törlődik. A már rögzített tranzakciók megmaradnak, de az előrejelzésben ez a tétel nem szerepel többé.`
            : ''
        }
      />
    </div>
  )
}

function RecurringList({
  items,
  onEdit,
  onDelete,
}: {
  items: Recurring[]
  onEdit: (r: Recurring) => void
  onDelete: (r: Recurring) => void
}) {
  const db = useDB()
  return (
    <ul className="divide-y divide-line -mx-1">
      {[...items]
        .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))
        .map((r) => {
          const cat = db.categories.find((c) => c.id === r.categoryId)
          return (
            <li key={r.id} className="group flex items-center gap-3 py-2.5">
              <span style={{ opacity: r.active ? 1 : 0.45 }}>
                <IconChip
                  icon={cat?.icon ?? (r.kind === 'income' ? 'money' : 'bill')}
                  color={cat?.color}
                  size={28}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="truncate text-[13px] font-medium text-ink"
                    style={{ opacity: r.active ? 1 : 0.45 }}
                  >
                    {r.name}
                  </span>
                  {!r.active && (
                    <span className="rounded-sm border border-line px-1.5 text-[10.5px] text-muted">
                      szünetel
                    </span>
                  )}
                </div>
                <div className="truncate text-[11.5px] text-muted">
                  {FREQ_LABEL[r.freq]}
                  {cat ? ` · ${cat.name}` : ''}
                  {r.yearlyChangePct ? ` · évi +${r.yearlyChangePct}%` : ''}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="num text-[13px] font-semibold text-ink">{fmtFt(r.amount)}</div>
                {r.freq !== 'monthly' && (
                  <div className="num text-[10.5px] text-muted">
                    {fmtFt(monthlyEquivalent(r))} / hó
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <IconButton label="Szerkesztés" icon="edit" onClick={() => onEdit(r)} />
                <IconButton label="Törlés" icon="trash" onClick={() => onDelete(r)} />
              </div>
            </li>
          )
        })}
    </ul>
  )
}

function RecurringModal({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing: Recurring | null
}) {
  const db = useDB()
  const accounts = db.accounts.filter((a) => !a.archived)

  const [name, setName] = useState('')
  const [kind, setKind] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [freq, setFreq] = useState<Freq>('monthly')
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [indexPct, setIndexPct] = useState('')
  const [active, setActive] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setKind(editing.kind)
      setAmount(String(editing.amount))
      setFreq(editing.freq)
      setStartDate(editing.startDate)
      setEndDate(editing.endDate ?? '')
      setCategoryId(editing.categoryId ?? '')
      setAccountId(editing.accountId)
      setIndexPct(editing.yearlyChangePct ? String(editing.yearlyChangePct) : '')
      setActive(editing.active)
    } else {
      setName('')
      setKind('expense')
      setAmount('')
      setFreq('monthly')
      setStartDate(today())
      setEndDate('')
      setCategoryId('')
      setAccountId(accounts[0]?.id ?? '')
      setIndexPct('')
      setActive(true)
    }
    setError('')
  }, [open, editing])

  const categories = db.categories.filter((c) => !c.archived && c.kind === kind)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!name.trim()) return setError('Adj nevet a tételnek.')
    if (value <= 0) return setError('Az összeg legyen nullánál nagyobb.')
    if (!accountId) return setError('Válassz számlát.')

    actions.saveRecurring({
      id: editing?.id,
      name: name.trim(),
      kind,
      amount: value,
      freq,
      startDate,
      endDate: endDate || undefined,
      categoryId: categoryId || undefined,
      accountId,
      yearlyChangePct: indexPct ? Number(indexPct.replace(',', '.')) : undefined,
      active,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Rendszeres tétel szerkesztése' : 'Új rendszeres tétel'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Mégsem
          </Button>
          <Button variant="primary" type="submit" form="rec-form">
            {editing ? 'Mentés' : 'Hozzáadás'}
          </Button>
        </>
      }
    >
      <form id="rec-form" onSubmit={submit} className="space-y-4">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Kiadás' },
            { value: 'income', label: 'Bevétel' },
          ]}
        />

        <Field label="Megnevezés">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pl. Albérlet, Munkabér, Netflix"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Összeg">
            <AmountInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Gyakoriság">
            <Select value={freq} onChange={(e) => setFreq(e.target.value as Freq)}>
              {FREQS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Első alkalom" hint="Ettől a naptól számoljuk a ritmust.">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Utolsó alkalom" hint="Üresen hagyva végtelenségig fut.">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategória">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Nincs besorolva</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Számla">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Éves változás (%)"
          hint="Pl. 5, ha évente ennyivel emelkedik. Az előrejelzés ezzel számol tovább."
        >
          <Input
            value={indexPct}
            onChange={(e) => setIndexPct(e.target.value)}
            placeholder="0"
            inputMode="decimal"
          />
        </Field>

        <Toggle checked={active} onChange={setActive} label="Aktív (számoljunk vele)" />

        {error && (
          <p className="text-[13px] font-medium" style={{ color: 'var(--critical)' }}>
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
