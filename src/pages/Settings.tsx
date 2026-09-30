import React, { useRef, useState } from 'react'
import { actions, PALETTE, useDB } from '../lib/store'
import { accountBalances } from '../lib/analytics'
import { buildDemoDB } from '../lib/demo'
import { backupFilename, csvToTransactions, download, transactionsToCSV } from '../lib/csv'
import { fmtFt, parseAmount } from '../lib/money'
import {
  AmountInput,
  Button,
  Card,
  ConfirmModal,
  Field,
  IconButton,
  IconChip,
  Input,
  Modal,
  Segmented,
  Select,
  Toggle,
} from '../components/ui'
import { ACCOUNT_ICON, CATEGORY_ICON_KEYS, Icon, type IconKey } from '../components/icons'
import type { Account, AccountType, Category, DB, Theme } from '../lib/types'

const ACCOUNT_TYPES: Array<{ value: AccountType; label: string }> = [
  { value: 'bank', label: 'Bankszámla' },
  { value: 'cash', label: 'Készpénz' },
  { value: 'savings', label: 'Megtakarítás' },
  { value: 'investment', label: 'Befektetés' },
  { value: 'credit', label: 'Hitelkeret' },
]

export function SettingsPage() {
  const db = useDB()
  const [confirm, setConfirm] = useState<null | 'reset' | 'demo' | 'clearTx'>(null)
  const [accountModal, setAccountModal] = useState<Account | 'new' | null>(null)
  const [categoryModal, setCategoryModal] = useState<Category | 'new' | null>(null)
  const [importMsg, setImportMsg] = useState('')
  const jsonInput = useRef<HTMLInputElement>(null)
  const csvInput = useRef<HTMLInputElement>(null)

  const balances = accountBalances(db)

  function exportJSON() {
    download(
      backupFilename('penziranytu-mentes', 'json'),
      JSON.stringify(db, null, 2),
      'application/json',
    )
  }

  async function importJSON(file: File) {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as DB
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.transactions)) {
        setImportMsg('A fájl nem érvényes Pénziránytű-mentés.')
        return
      }
      actions.replaceDB(parsed)
      setImportMsg(`Betöltve: ${parsed.transactions.length} tétel.`)
    } catch {
      setImportMsg('Nem sikerült beolvasni a fájlt.')
    }
  }

  async function importCSV(file: File) {
    const text = await file.text()
    const res = csvToTransactions(db, text)
    if (res.added.length) {
      actions.saveManyTx(res.added)
      setImportMsg(
        `${res.added.length} tétel importálva${res.skipped ? `, ${res.skipped} sor kimaradt` : ''}.` +
          (res.errors.length ? ` Első hiba: ${res.errors[0]}` : ''),
      )
    } else {
      setImportMsg(res.errors[0] ?? 'Nem találtam importálható sort.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Megjelenés és számítás">
          <div className="space-y-4">
            <Field label="Téma">
              <Segmented
                value={db.settings.theme}
                onChange={(v: Theme) => actions.setSettings({ theme: v })}
                options={[
                  { value: 'dark', label: 'Sötét' },
                  { value: 'light', label: 'Világos' },
                  { value: 'system', label: 'Rendszer' },
                ]}
              />
            </Field>

            <Field
              label="Előrejelzési horizont"
              hint="Az áttekintő oldal ennyi hónapra előre rajzolja a görbét."
            >
              <Select
                value={String(db.settings.horizonMonths)}
                onChange={(e) => actions.setSettings({ horizonMonths: Number(e.target.value) })}
              >
                {[6, 12, 18, 24, 36, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} hónap
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Vésztartalék (hónap)" hint="Hány havi kiadást tekintünk teljesnek.">
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={db.settings.emergencyMonths}
                  onChange={(e) =>
                    actions.setSettings({ emergencyMonths: Math.max(1, Number(e.target.value)) })
                  }
                />
              </Field>
              <Field label="Cél megtakarítási ráta (%)" hint="Ehhez mérjük a teljesítményed.">
                <Input
                  type="number"
                  min={0}
                  max={90}
                  value={db.settings.targetSavingRate}
                  onChange={(e) =>
                    actions.setSettings({ targetSavingRate: Math.max(0, Number(e.target.value)) })
                  }
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card
          title="Számlák"
          subtitle="A nyitóegyenleg az az összeg, amennyi a követés kezdetekor a számlán volt."
          action={
            <Button variant="soft" size="sm" icon="plus" onClick={() => setAccountModal('new')}>
              Új számla
            </Button>
          }
        >
          <ul className="divide-y divide-line">
            {db.accounts.map((a) => {
              const bal = balances.find((b) => b.id === a.id)?.balance ?? 0
              return (
                <li key={a.id} className="group flex items-center gap-3 py-2.5">
                  <IconChip icon={ACCOUNT_ICON[a.type] ?? 'bank'} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-ink">
                      {a.name}
                      {a.archived && <span className="text-muted"> · archivált</span>}
                    </div>
                    <div className="text-[11.5px] text-muted">
                      {ACCOUNT_TYPES.find((t) => t.value === a.type)?.label}
                      {a.liquid ? ' · szabadon elérhető' : ''}
                    </div>
                  </div>
                  <span className="num shrink-0 text-[13px] font-semibold text-ink">
                    {fmtFt(bal)}
                  </span>
                  <IconButton
                    label="Szerkesztés"
                    icon="edit"
                    onClick={() => setAccountModal(a)}
                  />
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <Card
        title="Kategóriák"
        subtitle="A színek a diagramokon jelennek meg – érdemes eltérőt adni a gyakoriaknak."
        action={
          <Button variant="soft" size="sm" icon="plus" onClick={() => setCategoryModal('new')}>
            Új kategória
          </Button>
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          {(['expense', 'income'] as const).map((kind) => (
            <div key={kind}>
              <div className="eyebrow mb-2">{kind === 'expense' ? 'Kiadás' : 'Bevétel'}</div>
              <ul className="space-y-0.5">
                {db.categories
                  .filter((c) => c.kind === kind && !c.archived)
                  .map((c) => (
                    <li
                      key={c.id}
                      className="group flex items-center gap-2.5 rounded-sm px-1.5 py-1 hover:bg-panel-2"
                    >
                      <span style={{ color: c.color }}>
                        <Icon name={c.icon} size={15} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                        {c.name}
                      </span>
                      {c.budget ? (
                        <span className="num text-[11.5px] text-muted">{fmtFt(c.budget)} / hó</span>
                      ) : null}
                      <IconButton
                        label="Szerkesztés"
                        icon="edit"
                        onClick={() => setCategoryModal(c)}
                      />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Adatok"
        subtitle="Minden adat a böngésződben marad. Rendszeres mentés nélkül elveszhet, ha törlöd a böngésző adatait."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" icon="download" onClick={exportJSON}>
            Teljes mentés (JSON)
          </Button>
          <Button variant="soft" icon="upload" onClick={() => jsonInput.current?.click()}>
            Mentés visszatöltése
          </Button>
          <Button
            variant="soft"
            icon="download"
            onClick={() =>
              download(
                backupFilename('tetelek', 'csv'),
                transactionsToCSV(db, db.transactions),
                'text/csv;charset=utf-8',
              )
            }
          >
            Tételek CSV-be
          </Button>
          <Button variant="soft" icon="upload" onClick={() => csvInput.current?.click()}>
            CSV import
          </Button>
        </div>

        <input
          ref={jsonInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importJSON(f)
            e.target.value = ''
          }}
        />
        <input
          ref={csvInput}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importCSV(f)
            e.target.value = ''
          }}
        />

        {importMsg && (
          <p className="mt-3 rounded-sm border border-line bg-panel-2 p-3 text-[12.5px] text-ink-2">
            {importMsg}
          </p>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <h3 className="mb-1 text-[12.5px] font-semibold text-ink">Kipróbálás és újrakezdés</h3>
          <p className="mb-3 text-[12px] text-muted">
            A mintaadat 14 hónapnyi életszerű tételt tölt be, és <strong>felülírja</strong> a
            jelenlegi adataidat. Előtte érdemes mentést készíteni.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setConfirm('demo')}>
              Mintaadat betöltése
            </Button>
            <Button variant="danger" icon="trash" onClick={() => setConfirm('clearTx')}>
              Tételek törlése
            </Button>
            <Button variant="danger" icon="trash" onClick={() => setConfirm('reset')}>
              Minden adat törlése
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-1 border-t border-line pt-4 text-[11.5px] text-muted">
          <p>
            Jelenleg {db.transactions.length} tétel, {db.recurring.length} rendszeres tétel és{' '}
            {db.goals.length} cél van eltárolva.
          </p>
          <p>Gyorsbillentyű: N – új tétel rögzítése.</p>
        </div>
      </Card>

      <AccountModal state={accountModal} onClose={() => setAccountModal(null)} />
      <CategoryModal state={categoryModal} onClose={() => setCategoryModal(null)} />

      <ConfirmModal
        open={confirm === 'demo'}
        onClose={() => setConfirm(null)}
        onConfirm={() => actions.replaceDB(buildDemoDB())}
        title="Mintaadat betöltése"
        body="Ez felülírja az összes jelenlegi adatodat 14 hónapnyi mintával. Biztosan folytatod?"
        confirmLabel="Betöltés"
      />
      <ConfirmModal
        open={confirm === 'clearTx'}
        onClose={() => setConfirm(null)}
        onConfirm={() => actions.clearTransactions()}
        title="Tételek törlése"
        body="Minden rögzített bevétel, kiadás és átvezetés törlődik. A kategóriák, számlák, célok és fix tételek megmaradnak."
      />
      <ConfirmModal
        open={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        onConfirm={() => actions.reset()}
        title="Minden adat törlése"
        body="Az alkalmazás visszaáll az alaphelyzetbe: minden tétel, cél, fix tétel és beállítás elvész. Ez nem vonható vissza."
      />
    </div>
  )
}


function AccountModal({ state, onClose }: { state: Account | 'new' | null; onClose: () => void }) {
  const editing = state && state !== 'new' ? state : null
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  const [opening, setOpening] = useState('')
  const [liquid, setLiquid] = useState(true)
  const [error, setError] = useState('')

  React.useEffect(() => {
    if (!state) return
    setName(editing?.name ?? '')
    setType(editing?.type ?? 'bank')
    setOpening(editing ? String(editing.openingBalance) : '')
    setLiquid(editing?.liquid ?? true)
    setError('')
  }, [state])

  return (
    <Modal
      open={Boolean(state)}
      onClose={onClose}
      width="max-w-md"
      title={editing ? 'Számla szerkesztése' : 'Új számla'}
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              onClick={() => {
                const res = actions.deleteAccount(editing.id)
                if (res === 'last') setError('Legalább egy számlának maradnia kell.')
                else onClose()
              }}
            >
              Törlés
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Mégsem
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!name.trim()) return setError('Adj nevet a számlának.')
              actions.saveAccount({
                id: editing?.id,
                name: name.trim(),
                type,
                openingBalance: parseAmount(opening),
                liquid,
                archived: editing?.archived,
              })
              onClose()
            }}
          >
            Mentés
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Név">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pl. OTP folyószámla"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Típus">
            <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nyitóegyenleg">
            <AmountInput
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
        <Toggle
          checked={liquid}
          onChange={setLiquid}
          label="Szabadon elérhető pénz (számít a vésztartalékba)"
        />
        {error && (
          <p className="text-[12.5px] font-medium" style={{ color: 'var(--critical)' }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

function CategoryModal({
  state,
  onClose,
}: {
  state: Category | 'new' | null
  onClose: () => void
}) {
  const editing = state && state !== 'new' ? state : null
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'income' | 'expense'>('expense')
  const [icon, setIcon] = useState<IconKey>(CATEGORY_ICON_KEYS[0])
  const [color, setColor] = useState(PALETTE[0])
  const [budget, setBudget] = useState('')
  const [error, setError] = useState('')

  React.useEffect(() => {
    if (!state) return
    setName(editing?.name ?? '')
    setKind(editing?.kind ?? 'expense')
    setIcon((editing?.icon as IconKey) ?? CATEGORY_ICON_KEYS[0])
    setColor(editing?.color ?? PALETTE[0])
    setBudget(editing?.budget ? String(editing.budget) : '')
    setError('')
  }, [state])

  return (
    <Modal
      open={Boolean(state)}
      onClose={onClose}
      title={editing ? 'Kategória szerkesztése' : 'Új kategória'}
      footer={
        <>
          {editing && (
            <Button
              variant="danger"
              onClick={() => {
                actions.deleteCategory(editing.id)
                onClose()
              }}
            >
              Törlés
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Mégsem
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!name.trim()) return setError('Adj nevet a kategóriának.')
              actions.saveCategory({
                id: editing?.id,
                name: name.trim(),
                kind,
                icon,
                color,
                budget: kind === 'expense' && budget ? parseAmount(budget) : undefined,
                archived: editing?.archived,
              })
              onClose()
            }}
          >
            Mentés
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Kiadás' },
            { value: 'income', label: 'Bevétel' },
          ]}
        />
        <Field label="Név">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pl. Éttermek" />
        </Field>

        <Field label="Ikon">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_ICON_KEYS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                className="flex h-8 w-8 items-center justify-center rounded-sm border transition-colors"
                style={{
                  borderColor: icon === i ? 'var(--accent)' : 'var(--line)',
                  background: icon === i ? 'var(--panel-2)' : 'transparent',
                  color: icon === i ? 'var(--accent)' : 'var(--ink-2)',
                }}
                aria-pressed={icon === i}
                aria-label={`Ikon: ${i}`}
              >
                <Icon name={i} size={15} />
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Szín"
          hint="A nyolc szín úgy lett kiválasztva, hogy színtévesztéssel is elkülönüljön."
        >
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-sm border-2 transition-transform"
                style={{
                  background: c,
                  borderColor: color === c ? 'var(--ink)' : 'transparent',
                  transform: color === c ? 'scale(1.1)' : undefined,
                }}
                aria-pressed={color === c}
                aria-label={`Szín ${i + 1}`}
              />
            ))}
          </div>
        </Field>

        {kind === 'expense' && (
          <Field label="Havi keret" hint="Nem kötelező – a Keretek oldalon is beállítható.">
            <AmountInput
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0"
            />
          </Field>
        )}

        {error && (
          <p className="text-[12.5px] font-medium" style={{ color: 'var(--critical)' }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
