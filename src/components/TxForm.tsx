import React, { useEffect, useMemo, useState } from 'react'
import {
  AmountInput,
  Button,
  Field,
  IconChip,
  Input,
  Modal,
  Segmented,
  Select,
  Textarea,
} from './ui'
import { actions, useDB } from '../lib/store'
import { parseAmount } from '../lib/money'
import { today } from '../lib/date'
import type { Tx, TxKind } from '../lib/types'

const KIND_OPTIONS: Array<{ value: TxKind; label: string }> = [
  { value: 'expense', label: 'Kiadás' },
  { value: 'income', label: 'Bevétel' },
  { value: 'transfer', label: 'Átvezetés' },
]

export function TxModal({
  open,
  onClose,
  editing,
  defaultKind = 'expense',
}: {
  open: boolean
  onClose: () => void
  editing?: Tx | null
  defaultKind?: TxKind
}) {
  const db = useDB()
  const accounts = useMemo(() => db.accounts.filter((a) => !a.archived), [db.accounts])

  const [kind, setKind] = useState<TxKind>(defaultKind)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setKind(editing.kind)
      setAmount(String(editing.amount))
      setDate(editing.date)
      setCategoryId(editing.categoryId ?? '')
      setAccountId(editing.accountId)
      setToAccountId(editing.toAccountId ?? '')
      setNote(editing.note ?? '')
    } else {
      setKind(defaultKind)
      setAmount('')
      setDate(today())
      setCategoryId('')
      setAccountId(accounts[0]?.id ?? '')
      setToAccountId(accounts.find((a) => a.type === 'savings')?.id ?? accounts[1]?.id ?? '')
      setNote('')
    }
    setError('')
  }, [open, editing, defaultKind])

  const categories = useMemo(
    () => db.categories.filter((c) => !c.archived && (kind === 'transfer' ? false : c.kind === kind)),
    [db.categories, kind],
  )
  const selected = categories.find((c) => c.id === categoryId)

  // Típusváltásnál a másik oldal kategóriája már nem érvényes.
  useEffect(() => {
    if (kind !== 'transfer' && categoryId && !categories.some((c) => c.id === categoryId)) {
      setCategoryId('')
    }
  }, [kind, categories, categoryId])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (value <= 0) return setError('Adj meg egy nullánál nagyobb összeget.')
    if (!accountId) return setError('Válassz számlát.')
    if (kind === 'transfer') {
      if (!toAccountId) return setError('Válassz célszámlát.')
      if (toAccountId === accountId) return setError('A két számla nem lehet ugyanaz.')
    }

    actions.saveTx({
      id: editing?.id,
      date,
      kind,
      amount: value,
      categoryId: kind === 'transfer' ? undefined : categoryId || undefined,
      accountId,
      toAccountId: kind === 'transfer' ? toAccountId : undefined,
      note: note.trim() || undefined,
      recurringId: editing?.recurringId,
      goalId: editing?.goalId,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Tétel szerkesztése' : 'Új tétel'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Mégsem
          </Button>
          <Button variant="primary" type="submit" form="tx-form">
            {editing ? 'Mentés' : 'Hozzáadás'}
          </Button>
        </>
      }
    >
      <form id="tx-form" onSubmit={submit} className="space-y-4">
        <Segmented options={KIND_OPTIONS} value={kind} onChange={setKind} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Összeg">
            <AmountInput
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </Field>
          <Field label="Dátum">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        {kind !== 'transfer' && (
          <Field label="Kategória">
            <div className="flex items-center gap-2">
              <IconChip icon={selected?.icon} color={selected?.color} size={34} />
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="flex-1"
              >
                <option value="">Nincs besorolva</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={kind === 'transfer' ? 'Honnan' : 'Számla'}>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          {kind === 'transfer' && (
            <Field label="Hová">
              <Select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <Field label="Megjegyzés" hint="Nem kötelező – de később sokat segít a visszakeresésben.">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Pl. heti bevásárlás"
          />
        </Field>

        {error && (
          <p className="text-[12.5px] font-medium" style={{ color: 'var(--critical)' }}>
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
