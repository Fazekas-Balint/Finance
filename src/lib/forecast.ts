import {
  addDays,
  addMonths,
  endOfMonth,
  fmtMonth,
  fromISO,
  monthKey,
  monthRange,
  startOfMonth,
  today,
  toISO,
} from './date'
import { sum } from './money'
import { averageCompleteMonths, totalBalance } from './analytics'
import type { DB, Freq, ISODate, Recurring, Scenario } from './types'

const MONTHLY_FACTOR: Record<Freq, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
}

export function monthlyEquivalent(r: Recurring): number {
  return r.amount * MONTHLY_FACTOR[r.freq]
}

export const FREQ_LABEL: Record<Freq, string> = {
  weekly: 'hetente',
  biweekly: 'kéthetente',
  monthly: 'havonta',
  quarterly: 'negyedévente',
  yearly: 'évente',
}

function monthShift(base: Date, months: number): Date {
  const y = base.getFullYear()
  const m = base.getMonth() + months
  const lastDay = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(base.getDate(), lastDay))
}

function nthOccurrence(r: Recurring, i: number): Date {
  const s = fromISO(r.startDate)
  switch (r.freq) {
    case 'weekly':
      return addDays(s, 7 * i)
    case 'biweekly':
      return addDays(s, 14 * i)
    case 'monthly':
      return monthShift(s, i)
    case 'quarterly':
      return monthShift(s, 3 * i)
    case 'yearly':
      return monthShift(s, 12 * i)
  }
}

export interface Occurrence {
  date: ISODate
  amount: number
  recurring: Recurring
}

export function occurrencesBetween(r: Recurring, from: Date, to: Date): Occurrence[] {
  if (!r.active) return []
  const out: Occurrence[] = []
  const start = fromISO(r.startDate)
  const end = r.endDate ? fromISO(r.endDate) : null
  if (start > to) return []

  const dayGap = Math.max(0, Math.floor((from.getTime() - start.getTime()) / 86_400_000))
  let i = 0
  if (r.freq === 'weekly') i = Math.max(0, Math.floor(dayGap / 7) - 1)
  else if (r.freq === 'biweekly') i = Math.max(0, Math.floor(dayGap / 14) - 1)
  else {
    const monthsGap =
      (from.getFullYear() - start.getFullYear()) * 12 + (from.getMonth() - start.getMonth())
    const per = r.freq === 'monthly' ? 1 : r.freq === 'quarterly' ? 3 : 12
    i = Math.max(0, Math.floor(monthsGap / per) - 1)
  }

  for (let guard = 0; guard < 5000; guard++, i++) {
    const d = nthOccurrence(r, i)
    if (d > to) break
    if (end && d > end) break
    if (d >= from) {
      const years = Math.floor(
        ((d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth())) / 12,
      )
      const factor = r.yearlyChangePct ? Math.pow(1 + r.yearlyChangePct / 100, years) : 1
      out.push({ date: toISO(d), amount: r.amount * factor, recurring: r })
    }
  }
  return out
}

export function recurringInMonth(db: DB, key: string): Occurrence[] {
  const [y, m] = key.split('-').map(Number)
  const from = new Date(y, m - 1, 1)
  const to = endOfMonth(from)
  return db.recurring.flatMap((r) => occurrencesBetween(r, from, to))
}

export function recurringMonthlyTotals(db: DB): { income: number; expense: number } {
  let income = 0
  let expense = 0
  for (const r of db.recurring) {
    if (!r.active) continue
    const eq = monthlyEquivalent(r)
    if (r.kind === 'income') income += eq
    else expense += eq
  }
  return { income, expense }
}

export interface ProjectionPoint {
  key: string
  label: string
  income: number
  expense: number
  net: number
  balance: number
  actual: boolean
  current: boolean
}

export interface Projection {
  points: ProjectionPoint[]
  assumptions: {
    recurringIncome: number
    recurringExpense: number
    variableIncome: number
    variableExpense: number
    baseMonths: number
    monthlyNet: number
  }
}

export const NEUTRAL_SCENARIO: Scenario = {
  incomeChangePct: 0,
  expenseChangePct: 0,
  extraMonthlySaving: 0,
  oneOffAmount: 0,
  oneOffMonth: null,
  oneOffLabel: '',
  includeRecurringOnly: false,
}

export interface ProjectionOptions {
  pastMonths?: number
  futureMonths?: number
  scenario?: Scenario
}

export function buildProjection(db: DB, opts: ProjectionOptions = {}): Projection {
  const { pastMonths = 6, futureMonths = 12 } = opts
  const sc = { ...NEUTRAL_SCENARIO, ...(opts.scenario ?? {}) }

  const now = new Date()
  const curKey = monthKey(now)
  const firstMonth = addMonths(startOfMonth(now), -pastMonths)
  const keys = monthRange(firstMonth, pastMonths + 1 + futureMonths)

  let balance = totalBalance(db, toISO(addDays(firstMonth, -1)))

  const avg = averageCompleteMonths(db, 3)
  const rec = recurringMonthlyTotals(db)
  const variableIncome = sc.includeRecurringOnly ? 0 : Math.max(0, avg.income - rec.income)
  const variableExpense = sc.includeRecurringOnly ? 0 : Math.max(0, avg.expense - rec.expense)

  const incomeMul = 1 + sc.incomeChangePct / 100
  const expenseMul = 1 + sc.expenseChangePct / 100

  const todayISO = today()
  const bookedRecurringThisMonth = new Set(
    db.transactions
      .filter((t) => monthKey(t.date) === curKey && t.recurringId)
      .map((t) => t.recurringId as string),
  )

  const points: ProjectionPoint[] = keys.map((key) => {
    const past = key < curKey
    const current = key === curKey

    let income = 0
    let expense = 0

    if (past || current) {
      for (const t of db.transactions) {
        if (monthKey(t.date) !== key) continue
        if (t.kind === 'income') income += t.amount
        else if (t.kind === 'expense') expense += t.amount
      }
    }

    if (current) {
      for (const occ of recurringInMonth(db, key)) {
        if (occ.date <= todayISO) continue
        if (bookedRecurringThisMonth.has(occ.recurring.id)) continue
        if (occ.recurring.kind === 'income') income += occ.amount
        else expense += occ.amount
      }
    }

    if (!past && !current) {
      let recIncome = 0
      let recExpense = 0
      for (const occ of recurringInMonth(db, key)) {
        if (occ.recurring.kind === 'income') recIncome += occ.amount
        else recExpense += occ.amount
      }
      income = (recIncome + variableIncome) * incomeMul
      expense = (recExpense + variableExpense) * expenseMul - sc.extraMonthlySaving
      if (sc.oneOffMonth === key) expense += sc.oneOffAmount
      expense = Math.max(0, expense)
    }

    const net = income - expense
    balance += net
    return {
      key,
      label: fmtMonth(key, key.endsWith('-01') || key === keys[0]),
      income,
      expense,
      net,
      balance,
      actual: past,
      current,
    }
  })

  return {
    points,
    assumptions: {
      recurringIncome: rec.income,
      recurringExpense: rec.expense,
      variableIncome,
      variableExpense,
      baseMonths: avg.months,
      monthlyNet:
        (rec.income + variableIncome) * incomeMul -
        Math.max(0, (rec.expense + variableExpense) * expenseMul - sc.extraMonthlySaving),
    },
  }
}

export function monthReaching(
  points: ProjectionPoint[],
  amount: number,
): ProjectionPoint | null {
  return points.find((p) => !p.actual && p.balance >= amount) ?? null
}

/** Az első hónap, ahol a vagyon nullába fordul – ha van ilyen. */
export function firstShortfall(points: ProjectionPoint[]): ProjectionPoint | null {
  return points.find((p) => !p.actual && p.balance < 0) ?? null
}


export interface GoalForecast {
  remaining: number
  pct: number
  monthly: number
  monthsToGo: number | null
  etaKey: string | null
  requiredMonthly: number | null
  monthsToDeadline: number | null
  onTrack: boolean | null
}

export function goalForecast(
  goal: { target: number; saved: number; deadline?: string; monthly?: number },
  fallbackMonthly: number,
): GoalForecast {
  const remaining = Math.max(0, goal.target - goal.saved)
  const pct = goal.target > 0 ? Math.min(100, (goal.saved / goal.target) * 100) : 0
  const monthly = goal.monthly && goal.monthly > 0 ? goal.monthly : Math.max(0, fallbackMonthly)

  const monthsToGo = remaining === 0 ? 0 : monthly > 0 ? Math.ceil(remaining / monthly) : null
  const etaKey =
    monthsToGo === null ? null : monthKey(addMonths(startOfMonth(new Date()), monthsToGo))

  let monthsToDeadline: number | null = null
  let requiredMonthly: number | null = null
  if (goal.deadline) {
    const d = fromISO(goal.deadline)
    monthsToDeadline = Math.max(
      0,
      (d.getFullYear() - new Date().getFullYear()) * 12 + (d.getMonth() - new Date().getMonth()),
    )
    requiredMonthly = monthsToDeadline > 0 ? remaining / monthsToDeadline : remaining
  }

  const onTrack =
    monthsToDeadline === null
      ? null
      : monthsToGo !== null && monthsToGo <= monthsToDeadline

  return {
    remaining,
    pct,
    monthly,
    monthsToGo,
    etaKey,
    requiredMonthly,
    monthsToDeadline,
    onTrack,
  }
}

export function goalsMonthlyCommitment(db: DB): number {
  return sum(db.goals.filter((g) => !g.done).map((g) => g.monthly ?? 0))
}
