import { addDays, addMonths, endOfMonth, startOfMonth, toISO } from './date'
import { emptyDB, uid } from './store'
import type { DB, Recurring, Tx } from './types'

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const round = (n: number, to = 10) => Math.round(n / to) * to

export function buildDemoDB(): DB {
  const base = emptyDB()
  const rand = rng(20260817)

  const bank = base.accounts.find((a) => a.type === 'bank')!
  const cash = base.accounts.find((a) => a.type === 'cash')!
  const savings = base.accounts.find((a) => a.type === 'savings')!
  bank.openingBalance = 180_000
  cash.openingBalance = 35_000
  savings.openingBalance = 450_000

  const cat = (name: string) => base.categories.find((c) => c.name === name)!
  const lakhatas = cat('Lakhatás')
  const elelmiszer = cat('Élelmiszer')
  const kozlekedes = cat('Közlekedés')
  const rezsi = cat('Rezsi')
  const szorakozas = cat('Szórakozás')
  const egeszseg = cat('Egészség')
  const elofizetes = cat('Előfizetések')
  const egyeb = cat('Egyéb')
  const fizetes = cat('Fizetés')
  const mellek = cat('Mellékállás')

  elelmiszer.budget = 130_000
  kozlekedes.budget = 45_000
  szorakozas.budget = 40_000
  egeszseg.budget = 20_000
  egyeb.budget = 30_000

  const startMonth = addMonths(startOfMonth(new Date()), -13)

  const recurring: Recurring[] = [
    {
      id: uid(),
      name: 'Munkabér',
      kind: 'income',
      amount: 615_000,
      categoryId: fizetes.id,
      accountId: bank.id,
      freq: 'monthly',
      startDate: toISO(addDays(startMonth, 9)),
      active: true,
      yearlyChangePct: 6,
      note: 'Minden hó 10-én',
    },
    {
      id: uid(),
      name: 'Albérlet',
      kind: 'expense',
      amount: 185_000,
      categoryId: lakhatas.id,
      accountId: bank.id,
      freq: 'monthly',
      startDate: toISO(addDays(startMonth, 4)),
      active: true,
      yearlyChangePct: 5,
    },
    {
      id: uid(),
      name: 'Rezsi (víz, gáz, áram)',
      kind: 'expense',
      amount: 42_000,
      categoryId: rezsi.id,
      accountId: bank.id,
      freq: 'monthly',
      startDate: toISO(addDays(startMonth, 14)),
      active: true,
      yearlyChangePct: 8,
    },
    {
      id: uid(),
      name: 'Mobil + internet',
      kind: 'expense',
      amount: 12_900,
      categoryId: elofizetes.id,
      accountId: bank.id,
      freq: 'monthly',
      startDate: toISO(addDays(startMonth, 7)),
      active: true,
    },
    {
      id: uid(),
      name: 'Netflix',
      kind: 'expense',
      amount: 4_490,
      categoryId: elofizetes.id,
      accountId: bank.id,
      freq: 'monthly',
      startDate: toISO(addDays(startMonth, 2)),
      active: true,
    },
    {
      id: uid(),
      name: 'Spotify',
      kind: 'expense',
      amount: 2_790,
      categoryId: elofizetes.id,
      accountId: bank.id,
      freq: 'monthly',
      startDate: toISO(addDays(startMonth, 18)),
      active: true,
    },
    {
      id: uid(),
      name: 'Felhőtárhely',
      kind: 'expense',
      amount: 1_290,
      categoryId: elofizetes.id,
      accountId: bank.id,
      freq: 'monthly',
      startDate: toISO(addDays(startMonth, 21)),
      active: true,
    },
    {
      id: uid(),
      name: 'Konditerem',
      kind: 'expense',
      amount: 11_900,
      categoryId: egeszseg.id,
      accountId: bank.id,
      freq: 'monthly',
      startDate: toISO(addDays(startMonth, 3)),
      active: true,
    },
    {
      id: uid(),
      name: 'Lakásbiztosítás',
      kind: 'expense',
      amount: 27_600,
      categoryId: lakhatas.id,
      accountId: bank.id,
      freq: 'yearly',
      startDate: toISO(addDays(startMonth, 25)),
      active: true,
    },
    {
      id: uid(),
      name: 'Bérlet',
      kind: 'expense',
      amount: 9_500,
      categoryId: kozlekedes.id,
      accountId: bank.id,
      freq: 'monthly',
      startDate: toISO(addDays(startMonth, 1)),
      active: true,
    },
  ]

  const txs: Tx[] = []
  const today = new Date()

  for (let m = 0; m < 14; m++) {
    const month = addMonths(startMonth, m)
    const last = endOfMonth(month)
    const push = (dayOffset: number, tx: Omit<Tx, 'id' | 'date'>) => {
      const d = addDays(month, dayOffset)
      if (d > today) return
      txs.push({ ...tx, id: uid(), date: toISO(d < last ? d : last) })
    }

    for (const r of recurring) {
      const monthsSince = m
      if (r.freq === 'yearly' && monthsSince % 12 !== 0) continue
      const day = Number(r.startDate.slice(8, 10)) - 1
      const drift = r.kind === 'income' ? 0 : Math.floor(rand() * 3) - 1
      const yearFactor = r.yearlyChangePct && m >= 12 ? 1 + r.yearlyChangePct / 100 : 1
      push(Math.max(0, day + drift), {
        kind: r.kind,
        amount: round(r.amount * yearFactor, 10),
        categoryId: r.categoryId,
        accountId: r.accountId,
        recurringId: r.id,
        note: r.name,
      })
    }

    for (let w = 0; w < 4; w++) {
      push(w * 7 + 2, {
        kind: 'expense',
        amount: round(21_000 + rand() * 12_000),
        categoryId: elelmiszer.id,
        accountId: bank.id,
        note: 'Heti bevásárlás',
      })
      push(w * 7 + 5, {
        kind: 'expense',
        amount: round(2_500 + rand() * 5_000),
        categoryId: elelmiszer.id,
        accountId: cash.id,
        note: 'Piac / kisbolt',
      })
    }

    push(8, {
      kind: 'expense',
      amount: round(14_000 + rand() * 12_000),
      categoryId: kozlekedes.id,
      accountId: bank.id,
      note: 'Tankolás',
    })
    push(22, {
      kind: 'expense',
      amount: round(9_000 + rand() * 9_000),
      categoryId: kozlekedes.id,
      accountId: bank.id,
      note: 'Tankolás',
    })

    const funBase = m >= 12 ? 34_000 : 18_000
    push(12, {
      kind: 'expense',
      amount: round(funBase + rand() * 14_000),
      categoryId: szorakozas.id,
      accountId: bank.id,
      note: 'Étterem, mozi',
    })
    push(26, {
      kind: 'expense',
      amount: round(6_000 + rand() * 12_000),
      categoryId: szorakozas.id,
      accountId: cash.id,
      note: 'Program a hétvégén',
    })

    if (rand() > 0.45)
      push(16, {
        kind: 'expense',
        amount: round(4_000 + rand() * 16_000),
        categoryId: egeszseg.id,
        accountId: bank.id,
        note: 'Gyógyszertár',
      })
    push(19, {
      kind: 'expense',
      amount: round(5_000 + rand() * 20_000),
      categoryId: egyeb.id,
      accountId: bank.id,
      note: rand() > 0.5 ? 'Ruházat' : 'Háztartási cikkek',
    })

    if (rand() > 0.6)
      push(23, {
        kind: 'income',
        amount: round(40_000 + rand() * 120_000, 1000),
        categoryId: mellek.id,
        accountId: bank.id,
        note: 'Projektmunka',
      })

    push(11, {
      kind: 'transfer',
      amount: 60_000,
      accountId: bank.id,
      toAccountId: savings.id,
      note: 'Havi félretétel',
    })

    push(1, {
      kind: 'transfer',
      amount: 35_000,
      accountId: bank.id,
      toAccountId: cash.id,
      note: 'Készpénzfelvétel',
    })
  }

  const goalEmergency = {
    id: uid(),
    name: 'Vésztartalék',
    icon: 'emergency',
    color: 'var(--s1)',
    target: 2_400_000,
    saved: 1_290_000,
    monthly: 60_000,
    note: '6 havi kiadás fedezete',
  }
  const goalTrip = {
    id: uid(),
    name: 'Nyaralás',
    icon: 'beach',
    color: 'var(--s3)',
    target: 650_000,
    saved: 180_000,
    monthly: 45_000,
    deadline: toISO(addMonths(startOfMonth(new Date()), 8)),
  }
  const goalLaptop = {
    id: uid(),
    name: 'Új laptop',
    icon: 'laptop',
    color: 'var(--s7)',
    target: 900_000,
    saved: 120_000,
    monthly: 25_000,
    deadline: toISO(addMonths(startOfMonth(new Date()), 6)),
  }

  return {
    ...base,
    accounts: [bank, cash, savings],
    recurring,
    transactions: txs,
    goals: [goalEmergency, goalTrip, goalLaptop],
    settings: { ...base.settings, horizonMonths: 24 },
  }
}
