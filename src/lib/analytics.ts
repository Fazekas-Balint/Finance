import {
  addMonths,
  endOfMonth,
  fromISO,
  monthKey,
  monthRange,
  startOfMonth,
  today,
  toISO,
} from './date'
import { sum } from './money'
import type { Category, DB, Flow, ID, Tx } from './types'

export interface AccountBalance {
  id: ID
  name: string
  type: string
  liquid: boolean
  balance: number
}

export function accountBalances(db: DB, until: string = today()): AccountBalance[] {
  const map = new Map<ID, number>()
  for (const a of db.accounts) map.set(a.id, a.openingBalance)

  for (const t of db.transactions) {
    if (t.date > until) continue
    const cur = map.get(t.accountId)
    if (t.kind === 'income') map.set(t.accountId, (cur ?? 0) + t.amount)
    else if (t.kind === 'expense') map.set(t.accountId, (cur ?? 0) - t.amount)
    else {
      map.set(t.accountId, (cur ?? 0) - t.amount)
      if (t.toAccountId) map.set(t.toAccountId, (map.get(t.toAccountId) ?? 0) + t.amount)
    }
  }

  return db.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    liquid: a.liquid,
    balance: map.get(a.id) ?? 0,
  }))
}

export function totalBalance(db: DB, until: string = today()): number {
  return sum(accountBalances(db, until).map((b) => b.balance))
}

/** Csak a azonnal elérhető (likvid) pénz – a vésztartalék-számításhoz. */
export function liquidBalance(db: DB, until: string = today()): number {
  return sum(
    accountBalances(db, until)
      .filter((b) => b.liquid)
      .map((b) => b.balance),
  )
}


export interface MonthTotals {
  key: string
  income: number
  expense: number
  net: number
}

export function monthTotals(txs: Tx[], key: string): MonthTotals {
  let income = 0
  let expense = 0
  for (const t of txs) {
    if (monthKey(t.date) !== key) continue
    if (t.kind === 'income') income += t.amount
    else if (t.kind === 'expense') expense += t.amount
  }
  return { key, income, expense, net: income - expense }
}

export function recentMonths(db: DB, count: number): MonthTotals[] {
  const start = addMonths(startOfMonth(new Date()), -(count - 1))
  return monthRange(start, count).map((k) => monthTotals(db.transactions, k))
}

export function averageCompleteMonths(
  db: DB,
  count = 3,
): { income: number; expense: number; net: number; months: number } {
  const start = addMonths(startOfMonth(new Date()), -count)
  const keys = monthRange(start, count)
  const rows = keys
    .map((k) => monthTotals(db.transactions, k))
    .filter((r) => r.income !== 0 || r.expense !== 0)

  if (!rows.length) {
    const cur = monthTotals(db.transactions, monthKey(new Date()))
    return cur.income || cur.expense
      ? { income: cur.income, expense: cur.expense, net: cur.net, months: 1 }
      : { income: 0, expense: 0, net: 0, months: 0 }
  }

  const n = rows.length
  const income = sum(rows.map((r) => r.income)) / n
  const expense = sum(rows.map((r) => r.expense)) / n
  return { income, expense, net: income - expense, months: n }
}

export function savingRate(income: number, expense: number): number | null {
  if (income <= 0) return null
  return ((income - expense) / income) * 100
}

export interface CategorySlice {
  id: ID
  name: string
  color: string
  icon: string
  value: number
  share: number
  count: number
}

export function categoryBreakdown(
  db: DB,
  kind: Flow,
  from: string,
  to: string,
): CategorySlice[] {
  const totals = new Map<ID, { value: number; count: number }>()
  for (const t of db.transactions) {
    if (t.kind !== kind) continue
    if (t.date < from || t.date > to) continue
    const key = t.categoryId ?? '__none__'
    const cur = totals.get(key) ?? { value: 0, count: 0 }
    totals.set(key, { value: cur.value + t.amount, count: cur.count + 1 })
  }

  const grand = sum([...totals.values()].map((v) => v.value))
  const rows: CategorySlice[] = [...totals.entries()].map(([id, v]) => {
    const cat = db.categories.find((c) => c.id === id)
    return {
      id,
      name: cat?.name ?? 'Besorolatlan',
      color: cat?.color ?? 'var(--ink-3)',
      icon: cat?.icon ?? 'unknown',
      value: v.value,
      count: v.count,
      share: grand > 0 ? (v.value / grand) * 100 : 0,
    }
  })
  return rows.sort((a, b) => b.value - a.value)
}

export function capSlices(rows: CategorySlice[], max = 8): CategorySlice[] {
  if (rows.length <= max) return rows
  const head = rows.slice(0, max - 1)
  const tail = rows.slice(max - 1)
  head.push({
    id: '__other__',
    name: 'Egyéb kategóriák',
    color: 'var(--ink-3)',
    icon: 'plus',
    value: sum(tail.map((r) => r.value)),
    count: sum(tail.map((r) => r.count)),
    share: sum(tail.map((r) => r.share)),
  })
  return head
}

export function categoryMonthlySeries(
  db: DB,
  categoryId: ID,
  count: number,
): Array<{ key: string; value: number }> {
  const start = addMonths(startOfMonth(new Date()), -(count - 1))
  const keys = monthRange(start, count)
  const byMonth = new Map(keys.map((k) => [k, 0]))
  for (const t of db.transactions) {
    if (t.categoryId !== categoryId) continue
    const k = monthKey(t.date)
    if (byMonth.has(k)) byMonth.set(k, (byMonth.get(k) ?? 0) + t.amount)
  }
  return keys.map((k) => ({ key: k, value: byMonth.get(k) ?? 0 }))
}

export interface BudgetRow {
  category: Category
  budget: number
  spent: number
  remaining: number
  pct: number
  expectedPct: number
  state: 'ok' | 'warning' | 'over'
}

export function budgetRows(db: DB, key: string): BudgetRow[] {
  const monthStart = key
    ? new Date(Number(key.split('-')[0]), Number(key.split('-')[1]) - 1, 1)
    : startOfMonth(new Date())
  const daysTotal = endOfMonth(monthStart).getDate()
  const now = new Date()
  const elapsed =
    monthKey(now) === key ? now.getDate() : now > endOfMonth(monthStart) ? daysTotal : 0
  const expectedPct = (elapsed / daysTotal) * 100

  return db.categories
    .filter((c) => c.kind === 'expense' && !c.archived && (c.budget ?? 0) > 0)
    .map((c) => {
      const spent = sum(
        db.transactions
          .filter((t) => t.kind === 'expense' && t.categoryId === c.id && monthKey(t.date) === key)
          .map((t) => t.amount),
      )
      const budget = c.budget ?? 0
      const pct = budget > 0 ? (spent / budget) * 100 : 0
      const state: BudgetRow['state'] =
        pct > 100 ? 'over' : pct > Math.max(expectedPct, 80) ? 'warning' : 'ok'
      return {
        category: c,
        budget,
        spent,
        remaining: budget - spent,
        pct,
        expectedPct,
        state,
      }
    })
    .sort((a, b) => b.pct - a.pct)
}

export function monthBounds(key: string): { from: string; to: string } {
  const [y, m] = key.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  return { from: toISO(start), to: toISO(endOfMonth(start)) }
}

export function firstDataMonth(db: DB): string {
  const dates = db.transactions.map((t) => t.date).sort()
  return dates.length ? monthKey(dates[0]) : monthKey(new Date())
}

export function txSortDesc(a: Tx, b: Tx): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return a.id < b.id ? 1 : -1
}

export function signedAmount(t: Tx): number {
  if (t.kind === 'income') return t.amount
  if (t.kind === 'expense') return -t.amount
  return 0
}

export function isSameMonth(date: string, key: string): boolean {
  return monthKey(date) === key
}

export function lastMonths(count: number): string[] {
  return monthRange(addMonths(startOfMonth(new Date()), -(count - 1)), count)
}

export function txInRange(db: DB, from: string, to: string): Tx[] {
  return db.transactions.filter((t) => t.date >= from && t.date <= to)
}

export function categoryAverage(db: DB, categoryId: ID, months: number): number {
  const series = categoryMonthlySeries(db, categoryId, months + 1).slice(0, months)
  if (!series.length) return 0
  return sum(series.map((s) => s.value)) / series.length
}

export function fromISOSafe(s?: string): Date | null {
  if (!s) return null
  try {
    return fromISO(s)
  } catch {
    return null
  }
}
