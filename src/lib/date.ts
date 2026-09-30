import type { ISODate } from './types'

export const HU_MONTHS_SHORT = [
  'jan',
  'febr',
  'márc',
  'ápr',
  'máj',
  'jún',
  'júl',
  'aug',
  'szept',
  'okt',
  'nov',
  'dec',
]

export const HU_MONTHS_LONG = [
  'január',
  'február',
  'március',
  'április',
  'május',
  'június',
  'július',
  'augusztus',
  'szeptember',
  'október',
  'november',
  'december',
]

export function pad(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function today(): ISODate {
  return toISO(new Date())
}

export function monthKey(s: ISODate | Date): string {
  const d = typeof s === 'string' ? fromISO(s) : s
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function monthKeyToDate(key: string): Date {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

export function daysInMonth(d: Date): number {
  return endOfMonth(d).getDate()
}

export function fmtMonth(key: string, withYear = false): string {
  const [y, m] = key.split('-').map(Number)
  const name = HU_MONTHS_SHORT[m - 1] ?? ''
  return withYear ? `${y}. ${name}` : name
}

export function fmtMonthLong(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${y}. ${HU_MONTHS_LONG[m - 1] ?? ''}`
}

export function fmtDate(s: ISODate): string {
  const d = fromISO(s)
  return `${d.getFullYear()}. ${HU_MONTHS_SHORT[d.getMonth()]}. ${d.getDate()}.`
}

export function fmtDateShort(s: ISODate): string {
  const d = fromISO(s)
  return `${HU_MONTHS_SHORT[d.getMonth()]}. ${d.getDate()}.`
}

export function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export function monthRange(start: Date, count: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(monthKey(addMonths(startOfMonth(start), i)))
  return out
}

export function relativeMonths(n: number): string {
  if (n <= 0) return 'már most'
  if (n === 1) return '1 hónap múlva'
  if (n < 12) return `${n} hónap múlva`
  const years = Math.floor(n / 12)
  const rest = n % 12
  if (rest === 0) return years === 1 ? '1 év múlva' : `${years} év múlva`
  return `${years} év ${rest} hónap múlva`
}
