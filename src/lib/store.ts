import { useSyncExternalStore } from 'react'
import type {
  Account,
  Category,
  DB,
  Goal,
  ID,
  Recurring,
  Settings,
  Tx,
} from './types'
import { today } from './date'
import { normalizeIcon } from '../components/icons'

export const STORAGE_KEY = 'penziranytu-v1'
const VERSION = 1

export function uid(): ID {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

export const PALETTE = [
  'var(--s1)',
  'var(--s2)',
  'var(--s3)',
  'var(--s4)',
  'var(--s5)',
  'var(--s6)',
  'var(--s7)',
  'var(--s8)',
]

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  horizonMonths: 12,
  emergencyMonths: 6,
  targetSavingRate: 20,
  currency: 'HUF',
}

export function starterCategories(): Category[] {
  const expense: Array<[string, string, string]> = [
    ['Lakhatás', 'home', 'var(--s1)'],
    ['Élelmiszer', 'cart', 'var(--s2)'],
    ['Közlekedés', 'car', 'var(--s3)'],
    ['Rezsi', 'utilities', 'var(--s4)'],
    ['Szórakozás', 'entertainment', 'var(--s5)'],
    ['Egészség', 'health', 'var(--s6)'],
    ['Előfizetések', 'phone', 'var(--s7)'],
    ['Egyéb', 'package', 'var(--s8)'],
  ]
  const income: Array<[string, string, string]> = [
    ['Fizetés', 'work', 'var(--s1)'],
    ['Mellékállás', 'tools', 'var(--s3)'],
    ['Egyéb bevétel', 'extra', 'var(--s4)'],
  ]
  return [
    ...expense.map(([name, icon, color]) => ({
      id: uid(),
      name,
      icon,
      color,
      kind: 'expense' as const,
    })),
    ...income.map(([name, icon, color]) => ({
      id: uid(),
      name,
      icon,
      color,
      kind: 'income' as const,
    })),
  ]
}

export function starterAccounts(): Account[] {
  return [
    { id: uid(), name: 'Bankszámla', type: 'bank', openingBalance: 0, liquid: true },
    { id: uid(), name: 'Készpénz', type: 'cash', openingBalance: 0, liquid: true },
    { id: uid(), name: 'Megtakarítás', type: 'savings', openingBalance: 0, liquid: false },
  ]
}

export function emptyDB(): DB {
  return {
    version: VERSION,
    accounts: starterAccounts(),
    categories: starterCategories(),
    transactions: [],
    recurring: [],
    goals: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}

function migrate(raw: any): DB {
  const base = emptyDB()
  if (!raw || typeof raw !== 'object') return base

  const categories =
    Array.isArray(raw.categories) && raw.categories.length
      ? raw.categories.map((c: any) => ({ ...c, icon: normalizeIcon(c?.icon, 'package') }))
      : base.categories
  const goals = Array.isArray(raw.goals)
    ? raw.goals.map((g: any) => ({ ...g, icon: normalizeIcon(g?.icon, 'target') }))
    : []

  return {
    version: VERSION,
    accounts: Array.isArray(raw.accounts) && raw.accounts.length ? raw.accounts : base.accounts,
    categories,
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    recurring: Array.isArray(raw.recurring) ? raw.recurring : [],
    goals,
    settings: { ...base.settings, ...(raw.settings ?? {}) },
  }
}

function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyDB()
    return migrate(JSON.parse(raw))
  } catch {
    return emptyDB()
  }
}

let db: DB = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch (e) {
    console.warn('Nem sikerült menteni a localStorage-be', e)
  }
}

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function getSnapshot() {
  return db
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getSnapshot)
}

export function getDB(): DB {
  return db
}

function set(next: DB, { save = true } = {}) {
  db = next
  if (save) persist()
  emit()
}

function upsert<T extends { id: ID }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return [...list, item]
  const copy = list.slice()
  copy[i] = item
  return copy
}

export const actions = {
  saveTx(tx: Omit<Tx, 'id'> & { id?: ID }) {
    const full: Tx = { ...tx, id: tx.id ?? uid() }
    set({ ...db, transactions: upsert(db.transactions, full) })
    return full
  },
  saveManyTx(list: Array<Omit<Tx, 'id'> & { id?: ID }>) {
    let txs = db.transactions
    for (const t of list) txs = upsert(txs, { ...t, id: t.id ?? uid() } as Tx)
    set({ ...db, transactions: txs })
  },
  deleteTx(id: ID) {
    set({ ...db, transactions: db.transactions.filter((t) => t.id !== id) })
  },

  saveCategory(c: Omit<Category, 'id'> & { id?: ID }) {
    const full: Category = { ...c, id: c.id ?? uid() }
    set({ ...db, categories: upsert(db.categories, full) })
    return full
  },
  deleteCategory(id: ID) {
    const used = db.transactions.some((t) => t.categoryId === id)
    if (used) {
      set({
        ...db,
        categories: db.categories.map((c) => (c.id === id ? { ...c, archived: true } : c)),
      })
      return 'archived' as const
    }
    set({ ...db, categories: db.categories.filter((c) => c.id !== id) })
    return 'deleted' as const
  },

  saveAccount(a: Omit<Account, 'id'> & { id?: ID }) {
    const full: Account = { ...a, id: a.id ?? uid() }
    set({ ...db, accounts: upsert(db.accounts, full) })
    return full
  },
  deleteAccount(id: ID) {
    if (db.accounts.length <= 1) return 'last' as const
    const used = db.transactions.some((t) => t.accountId === id || t.toAccountId === id)
    if (used) {
      set({
        ...db,
        accounts: db.accounts.map((a) => (a.id === id ? { ...a, archived: true } : a)),
      })
      return 'archived' as const
    }
    set({ ...db, accounts: db.accounts.filter((a) => a.id !== id) })
    return 'deleted' as const
  },

  saveRecurring(r: Omit<Recurring, 'id'> & { id?: ID }) {
    const full: Recurring = { ...r, id: r.id ?? uid() }
    set({ ...db, recurring: upsert(db.recurring, full) })
    return full
  },
  deleteRecurring(id: ID) {
    set({ ...db, recurring: db.recurring.filter((r) => r.id !== id) })
  },

  saveGoal(g: Omit<Goal, 'id'> & { id?: ID }) {
    const full: Goal = { ...g, id: g.id ?? uid() }
    set({ ...db, goals: upsert(db.goals, full) })
    return full
  },
  deleteGoal(id: ID) {
    set({ ...db, goals: db.goals.filter((g) => g.id !== id) })
  },
  contributeToGoal(goalId: ID, amount: number, fromAccountId: ID, toAccountId: ID) {
    const goal = db.goals.find((g) => g.id === goalId)
    if (!goal) return
    const tx: Tx = {
      id: uid(),
      date: today(),
      kind: 'transfer',
      amount,
      accountId: fromAccountId,
      toAccountId,
      goalId,
      note: `Félretéve: ${goal.name}`,
    }
    set({
      ...db,
      transactions: [...db.transactions, tx],
      goals: db.goals.map((g) =>
        g.id === goalId
          ? { ...g, saved: g.saved + amount, done: g.saved + amount >= g.target }
          : g,
      ),
    })
  },

  setSettings(patch: Partial<Settings>) {
    set({ ...db, settings: { ...db.settings, ...patch } })
  },
  replaceDB(next: DB) {
    set(migrate(next))
  },
  reset() {
    set(emptyDB())
  },
  clearTransactions() {
    set({ ...db, transactions: [] })
  },
}

export function catById(d: DB, id?: ID): Category | undefined {
  return id ? d.categories.find((c) => c.id === id) : undefined
}
export function accById(d: DB, id?: ID): Account | undefined {
  return id ? d.accounts.find((a) => a.id === id) : undefined
}
export function goalById(d: DB, id?: ID): Goal | undefined {
  return id ? d.goals.find((g) => g.id === id) : undefined
}
