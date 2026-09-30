import React, { useMemo, useState } from 'react'
import { actions, useDB } from '../lib/store'
import { txSortDesc } from '../lib/analytics'
import { fmtDate, fmtMonthLong, monthKey } from '../lib/date'
import { fmtFt, sum } from '../lib/money'
import { backupFilename, download, transactionsToCSV } from '../lib/csv'
import {
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  Field,
  Input,
  Segmented,
  Select,
} from '../components/ui'
import { TxRow } from '../components/TxRow'
import { TxModal } from '../components/TxForm'
import type { Tx } from '../lib/types'

type KindFilter = 'all' | 'expense' | 'income' | 'transfer'

export function Transactions() {
  const db = useDB()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [month, setMonth] = useState('')
  const [editing, setEditing] = useState<Tx | null>(null)
  const [deleting, setDeleting] = useState<Tx | null>(null)
  const [limit, setLimit] = useState(60)

  const months = useMemo(() => {
    const keys = new Set(db.transactions.map((t) => monthKey(t.date)))
    return [...keys].sort().reverse()
  }, [db.transactions])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return db.transactions
      .filter((t) => {
        if (kind !== 'all' && t.kind !== kind) return false
        if (categoryId && t.categoryId !== categoryId) return false
        if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) return false
        if (month && monthKey(t.date) !== month) return false
        if (needle) {
          const cat = db.categories.find((c) => c.id === t.categoryId)?.name ?? ''
          const acc = db.accounts.find((a) => a.id === t.accountId)?.name ?? ''
          const hay = `${t.note ?? ''} ${cat} ${acc} ${t.amount}`.toLowerCase()
          if (!hay.includes(needle)) return false
        }
        return true
      })
      .sort(txSortDesc)
  }, [db, q, kind, categoryId, accountId, month])

  const totals = useMemo(() => {
    const income = sum(filtered.filter((t) => t.kind === 'income').map((t) => t.amount))
    const expense = sum(filtered.filter((t) => t.kind === 'expense').map((t) => t.amount))
    return { income, expense, net: income - expense, count: filtered.length }
  }, [filtered])

  const grouped = useMemo(() => {
    const out: Array<{ date: string; items: Tx[] }> = []
    for (const t of filtered.slice(0, limit)) {
      const last = out[out.length - 1]
      if (last && last.date === t.date) last.items.push(t)
      else out.push({ date: t.date, items: [t] })
    }
    return out
  }, [filtered, limit])

  const hasFilter = Boolean(q || kind !== 'all' || categoryId || accountId || month)

  return (
    <div className="space-y-5">
      <Card bodyClassName="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Keresés megjegyzésben, kategóriában, összegben…"
              aria-label="Keresés"
            />
          </div>
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: 'all', label: 'Mind' },
              { value: 'expense', label: 'Kiadás' },
              { value: 'income', label: 'Bevétel' },
              { value: 'transfer', label: 'Átvezetés' },
            ]}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Hónap">
            <Select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Összes hónap</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {fmtMonthLong(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kategória">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Összes kategória</option>
              {db.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Számla">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Összes számla</option>
              {db.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3.5">
          <Summary label="Tételek" value={String(totals.count)} />
          <Summary label="Bevétel" value={fmtFt(totals.income)} color="var(--income)" />
          <Summary label="Kiadás" value={fmtFt(totals.expense)} color="var(--expense)" />
          <Summary label="Egyenleg" value={fmtFt(totals.net)} />
          <div className="ml-auto flex items-center gap-2">
            {hasFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ('')
                  setKind('all')
                  setCategoryId('')
                  setAccountId('')
                  setMonth('')
                }}
              >
                Szűrők törlése
              </Button>
            )}
            <Button
              variant="soft"
              size="sm"
              disabled={!filtered.length}
              onClick={() =>
                download(
                  backupFilename('tetelek', 'csv'),
                  transactionsToCSV(db, filtered),
                  'text/csv;charset=utf-8',
                )
              }
            >
              CSV export
            </Button>
          </div>
        </div>
      </Card>

      <Card bodyClassName="pt-0">
        {grouped.length === 0 ? (
          <EmptyState
            icon="analyze"
            title={hasFilter ? 'Nincs találat' : 'Még nincs egyetlen tétel sem'}
            body={
              hasFilter
                ? 'Próbáld meg lazítani a szűrőket, vagy törölj néhányat.'
                : 'Kattints a fejlécben az „Új tétel” gombra, vagy nyomd meg az N billentyűt.'
            }
          />
        ) : (
          <>
            {grouped.map((g) => {
              const dayNet = sum(
                g.items.map((t) =>
                  t.kind === 'income' ? t.amount : t.kind === 'expense' ? -t.amount : 0,
                ),
              )
              return (
                <div key={g.date}>
                  <div className="sticky top-14 z-10 -mx-4 flex items-baseline justify-between gap-3 border-b border-line bg-panel px-4 py-1.5">
                    <span className="num text-[11.5px] font-semibold text-ink-2">
                      {fmtDate(g.date)}
                    </span>
                    <span className="num text-[11.5px] text-muted">
                      {dayNet >= 0 ? '+' : '−'}
                      {fmtFt(Math.abs(dayNet))}
                    </span>
                  </div>
                  <ul className="divide-y divide-line">
                    {g.items.map((t) => (
                      <TxRow
                        key={t.id}
                        tx={t}
                        db={db}
                        onEdit={setEditing}
                        onDelete={setDeleting}
                      />
                    ))}
                  </ul>
                </div>
              )
            })}
            {filtered.length > limit && (
              <div className="pt-4 text-center">
                <Button variant="soft" onClick={() => setLimit((l) => l + 60)}>
                  További {Math.min(60, filtered.length - limit)} tétel betöltése
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <TxModal open={Boolean(editing)} onClose={() => setEditing(null)} editing={editing} />
      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && actions.deleteTx(deleting.id)}
        title="Tétel törlése"
        body={
          deleting
            ? `Biztosan törlöd? ${fmtDate(deleting.date)} · ${fmtFt(deleting.amount)}${deleting.note ? ` · ${deleting.note}` : ''}. A művelet nem vonható vissza.`
            : ''
        }
      />
    </div>
  )
}

function Summary({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="num text-[14px] font-semibold" style={{ color: color ?? 'var(--ink)' }}>
        {value}
      </div>
    </div>
  )
}
