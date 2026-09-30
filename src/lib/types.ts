export type ID = string

export type ISODate = string

export type Flow = 'income' | 'expense'
export type TxKind = Flow | 'transfer'

export type AccountType = 'bank' | 'cash' | 'savings' | 'investment' | 'credit'

export interface Account {
  id: ID
  name: string
  type: AccountType
  openingBalance: number
  liquid: boolean
  archived?: boolean
}

export interface Category {
  id: ID
  name: string
  kind: Flow
  color: string
  icon: string
  budget?: number
  archived?: boolean
}

export interface Tx {
  id: ID
  date: ISODate
  kind: TxKind
  amount: number
  categoryId?: ID
  accountId: ID
  toAccountId?: ID
  goalId?: ID
  note?: string
  recurringId?: ID
}

export type Freq = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export interface Recurring {
  id: ID
  name: string
  kind: Flow
  amount: number
  categoryId?: ID
  accountId: ID
  freq: Freq
  startDate: ISODate
  endDate?: ISODate
  active: boolean
  yearlyChangePct?: number
  note?: string
}

export interface Goal {
  id: ID
  name: string
  icon: string
  color: string
  target: number
  saved: number
  deadline?: ISODate
  monthly?: number
  note?: string
  done?: boolean
}

export type Theme = 'light' | 'dark' | 'system'

export interface Settings {
  theme: Theme
  horizonMonths: number
  emergencyMonths: number
  targetSavingRate: number
  currency: string
}

export interface DB {
  version: number
  accounts: Account[]
  categories: Category[]
  transactions: Tx[]
  recurring: Recurring[]
  goals: Goal[]
  settings: Settings
}

export interface Scenario {
  incomeChangePct: number
  expenseChangePct: number
  extraMonthlySaving: number
  oneOffAmount: number
  oneOffMonth: string | null
  oneOffLabel: string
  includeRecurringOnly: boolean
}
