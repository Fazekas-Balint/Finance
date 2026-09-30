import React from 'react'
import type { DB, Tx } from '../lib/types'
import { accById, catById } from '../lib/store'
import { fmtDateShort } from '../lib/date'
import { fmtFt } from '../lib/money'
import { IconButton, IconChip } from './ui'

export function TxRow({
  tx,
  db,
  compact = false,
  onEdit,
  onDelete,
}: {
  tx: Tx
  db: DB
  compact?: boolean
  onEdit?: (tx: Tx) => void
  onDelete?: (tx: Tx) => void
}) {
  const cat = catById(db, tx.categoryId)
  const acc = accById(db, tx.accountId)
  const to = accById(db, tx.toAccountId)

  const isTransfer = tx.kind === 'transfer'
  const color = isTransfer ? 'var(--ink-3)' : tx.kind === 'income' ? 'var(--income)' : 'var(--ink)'
  const sign = isTransfer ? '' : tx.kind === 'income' ? '+' : '−'

  const title = isTransfer
    ? `${acc?.name ?? '?'} → ${to?.name ?? '?'}`
    : (cat?.name ?? 'Besorolatlan')

  return (
    <li className="group flex items-center gap-3 py-2">
      <IconChip
        icon={isTransfer ? 'transfer' : cat?.icon}
        color={isTransfer ? undefined : cat?.color}
        size={28}
      />

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-ink">{title}</div>
        <div className="truncate text-[11.5px] text-muted">
          <span className="num">{fmtDateShort(tx.date)}</span>
          {tx.note ? ` · ${tx.note}` : ''}
          {!compact && acc && !isTransfer ? ` · ${acc.name}` : ''}
        </div>
      </div>

      <div className="num shrink-0 text-[13px] font-semibold" style={{ color }}>
        {sign}
        {fmtFt(tx.amount)}
      </div>

      {(onEdit || onDelete) && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {onEdit && <IconButton label="Szerkesztés" icon="edit" onClick={() => onEdit(tx)} />}
          {onDelete && <IconButton label="Törlés" icon="trash" onClick={() => onDelete(tx)} />}
        </div>
      )}
    </li>
  )
}
