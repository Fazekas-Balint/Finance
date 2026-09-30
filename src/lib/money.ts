const nf0 = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 })

export function fmtFt(n: number): string {
  return `${nf0.format(Math.round(n))} Ft`
}

export function fmtFtSigned(n: number): string {
  const s = fmtFt(Math.abs(n))
  if (Math.round(n) === 0) return s
  return n > 0 ? `+${s}` : `−${s}`
}

export function fmtNum(n: number): string {
  return nf0.format(Math.round(n))
}

export function fmtCompact(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000_000) return `${sign}${nf1.format(abs / 1_000_000_000)} Mrd`
  if (abs >= 1_000_000) return `${sign}${nf1.format(abs / 1_000_000)} M`
  if (abs >= 10_000) return `${sign}${nf0.format(abs / 1000)} e`
  if (abs >= 1000) return `${sign}${nf1.format(abs / 1000)} e`
  return `${sign}${nf0.format(abs)}`
}

export function fmtPct(n: number, digits = 0): string {
  return `${nf1.format(Number(n.toFixed(digits)))}%`
}

export function pctChange(current: number, base: number): number | null {
  if (!isFinite(base) || base === 0) return null
  return ((current - base) / Math.abs(base)) * 100
}

export function parseAmount(s: string): number {
  const cleaned = s
    .replace(/\s| /g, '')
    .replace(/ft$/i, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.')
  const n = Number(cleaned)
  return isFinite(n) ? n : 0
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}
