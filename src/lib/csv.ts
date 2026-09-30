import { accById, catById, uid } from './store'
import { fmtDate } from './date'
import type { DB, Tx, TxKind } from './types'

const SEP = ';'

function esc(v: string | number): string {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const KIND_LABEL: Record<TxKind, string> = {
  income: 'bevétel',
  expense: 'kiadás',
  transfer: 'átvezetés',
}

export function transactionsToCSV(db: DB, txs: Tx[]): string {
  const header = [
    'Dátum',
    'Típus',
    'Összeg',
    'Kategória',
    'Számla',
    'Célszámla',
    'Megjegyzés',
  ].join(SEP)

  const rows = txs.map((t) =>
    [
      t.date,
      KIND_LABEL[t.kind],
      t.amount,
      catById(db, t.categoryId)?.name ?? '',
      accById(db, t.accountId)?.name ?? '',
      accById(db, t.toAccountId)?.name ?? '',
      t.note ?? '',
    ]
      .map(esc)
      .join(SEP),
  )

  return '﻿' + [header, ...rows].join('\r\n')
}

export interface ImportResult {
  added: Tx[]
  skipped: number
  errors: string[]
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') inQuotes = false
      else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === sep) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

function normalizeDate(s: string): string | null {
  const t = s.trim().replace(/\.$/, '')
  let m = t.match(/^(\d{4})[-./ ]\s*(\d{1,2})[-./ ]\s*(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = t.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

export function csvToTransactions(db: DB, text: string): ImportResult {
  const errors: string[] = []
  const added: Tx[] = []
  let skipped = 0

  const clean = text.replace(/^﻿/, '').trim()
  if (!clean) return { added, skipped, errors: ['A fájl üres.'] }

  const lines = clean.split(/\r?\n/)
  const sep = (lines[0].match(/;/g) ?? []).length >= (lines[0].match(/,/g) ?? []).length ? ';' : ','

  const header = splitLine(lines[0], sep).map((h) => h.trim().toLowerCase())
  const idx = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)))

  const iDate = idx('dátum', 'datum', 'date')
  const iKind = idx('típus', 'tipus', 'type')
  const iAmount = idx('összeg', 'osszeg', 'amount', 'value')
  const iCat = idx('kategória', 'kategoria', 'category')
  const iAcc = idx('számla', 'szamla', 'account')
  const iTo = idx('célszámla', 'celszamla', 'target')
  const iNote = idx('megjegyzés', 'megjegyzes', 'leírás', 'leiras', 'note', 'description')

  if (iDate === -1 || iAmount === -1) {
    return {
      added,
      skipped,
      errors: [
        'Nem találtam „Dátum" és „Összeg" oszlopot. A legegyszerűbb, ha előbb exportálsz egy CSV-t, és annak a fejlécét használod.',
      ],
    }
  }

  const defaultAccount = db.accounts.find((a) => !a.archived) ?? db.accounts[0]

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.trim()) continue
    const cells = splitLine(raw, sep)

    const date = normalizeDate(cells[iDate] ?? '')
    if (!date) {
      skipped++
      errors.push(`${i + 1}. sor: értelmezhetetlen dátum (${cells[iDate] ?? ''})`)
      continue
    }

    const rawAmount = (cells[iAmount] ?? '')
      .replace(/\s| |Ft/gi, '')
      .replace(/\.(?=\d{3}\b)/g, '')
      .replace(',', '.')
    const num = Number(rawAmount)
    if (!isFinite(num) || num === 0) {
      skipped++
      errors.push(`${i + 1}. sor: értelmezhetetlen összeg (${cells[iAmount] ?? ''})`)
      continue
    }

    const kindText = (cells[iKind] ?? '').toLowerCase()
    let kind: TxKind
    if (kindText.includes('átvez') || kindText.includes('atvez') || kindText.includes('transfer'))
      kind = 'transfer'
    else if (kindText.includes('bev') || kindText.includes('income')) kind = 'income'
    else if (kindText.includes('kiad') || kindText.includes('expense')) kind = 'expense'
    else kind = num < 0 ? 'expense' : 'income'

    const catName = (cells[iCat] ?? '').trim().toLowerCase()
    const category = db.categories.find(
      (c) => c.name.toLowerCase() === catName && (kind === 'transfer' || c.kind === kind),
    )

    const accName = (cells[iAcc] ?? '').trim().toLowerCase()
    const account = db.accounts.find((a) => a.name.toLowerCase() === accName) ?? defaultAccount

    const toName = (cells[iTo] ?? '').trim().toLowerCase()
    const toAccount = toName ? db.accounts.find((a) => a.name.toLowerCase() === toName) : undefined

    added.push({
      id: uid(),
      date,
      kind,
      amount: Math.abs(num),
      categoryId: category?.id,
      accountId: account.id,
      toAccountId: kind === 'transfer' ? (toAccount?.id ?? account.id) : undefined,
      note: (cells[iNote] ?? '').trim() || undefined,
    })
  }

  return { added, skipped, errors }
}

export function download(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function backupFilename(prefix: string, ext: string): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${prefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.${ext}`
}

export { fmtDate }
