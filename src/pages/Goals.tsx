import React, { useEffect, useMemo, useState } from 'react'
import { actions, useDB } from '../lib/store'
import { averageCompleteMonths } from '../lib/analytics'
import { buildProjection, goalForecast, goalsMonthlyCommitment } from '../lib/forecast'
import { fmtMonthLong, relativeMonths } from '../lib/date'
import { fmtFt, fmtPct, parseAmount, sum } from '../lib/money'
import { StatTile } from '../components/StatTile'
import {
  AmountInput,
  Badge,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  Field,
  IconButton,
  IconChip,
  Input,
  Meter,
  Modal,
  Select,
} from '../components/ui'
import { GOAL_ICON_KEYS, Icon, type IconKey } from '../components/icons'
import type { Goal } from '../lib/types'

const ICONS: IconKey[] = GOAL_ICON_KEYS

const COLORS = [
  'var(--s1)',
  'var(--s2)',
  'var(--s3)',
  'var(--s4)',
  'var(--s5)',
  'var(--s6)',
  'var(--s7)',
  'var(--s8)',
]

export function Goals({ onNavigate }: { onNavigate: (page: string) => void }) {
  const db = useDB()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [deleting, setDeleting] = useState<Goal | null>(null)
  const [contributing, setContributing] = useState<Goal | null>(null)

  const projection = useMemo(() => buildProjection(db, { pastMonths: 3, futureMonths: 12 }), [db])
  const monthlyFree = Math.max(0, projection.assumptions.monthlyNet)
  const commitment = goalsMonthlyCommitment(db)
  const savedTotal = sum(db.goals.map((g) => g.saved))
  const targetTotal = sum(db.goals.map((g) => g.target))

  const active = db.goals.filter((g) => !g.done)
  const done = db.goals.filter((g) => g.done)

  const overcommitted = commitment > monthlyFree

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          hero
          label="Célokra félretéve"
          value={fmtFt(savedTotal)}
          hint={
            targetTotal > 0 ? `${fmtPct((savedTotal / targetTotal) * 100)} az összes célból` : ''
          }
        />
        <StatTile label="Célösszegek összesen" value={fmtFt(targetTotal)} icon="target" />
        <StatTile
          label="Havi vállalás"
          value={fmtFt(commitment)}
          hint={`Havonta ${fmtFt(monthlyFree)} szabadul fel`}
          icon="calendar"
        />
        <StatTile
          label="Hátralévő összeg"
          value={fmtFt(Math.max(0, targetTotal - savedTotal))}
          hint={
            monthlyFree > 0
              ? relativeMonths(Math.ceil(Math.max(0, targetTotal - savedTotal) / monthlyFree))
              : 'nincs félretehető pénz'
          }
          icon="hourglass"
        />
      </div>

      {overcommitted && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-md border bg-panel p-3.5"
          style={{ borderColor: 'var(--warning)' }}
        >
          <span style={{ color: 'var(--warning)' }}>
            <Icon name="warning" size={16} />
          </span>
          <p className="min-w-[240px] flex-1 text-[12.5px] text-ink-2">
            <strong className="text-ink">Többet vállaltál, mint amennyi felszabadul.</strong> A
            céljaidra havi {fmtFt(commitment)}-ot terveztél, de a jelenlegi bevétel-kiadás mellett
            csak {fmtFt(monthlyFree)} marad. Vagy csökkentsd a havi összegeket, vagy nézd meg, hol
            tudsz faragni.
          </p>
          <Button
            variant="soft"
            size="sm"
            icon="arrowRight"
            onClick={() => onNavigate('analytics')}
          >
            Hol faraghatok?
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Aktív célok</h2>
        <Button
          variant="primary"
          size="sm"
          icon="plus"
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          Új cél
        </Button>
      </div>

      {active.length === 0 ? (
        <Card>
          <EmptyState
            icon="target"
            title="Még nincs megtakarítási célod"
            body="A célok teszik kézzelfoghatóvá a félretételt: megadod, mennyi kell és mikorra, mi pedig megmondjuk, havonta mennyit kell tenned érte, és hogy tartod-e a tempót. Kezdésnek a vésztartalék a legjobb választás."
            action={
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(null)
                  setOpen(true)
                }}
              >
                Első cél létrehozása
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              fallbackMonthly={monthlyFree}
              onEdit={() => {
                setEditing(g)
                setOpen(true)
              }}
              onDelete={() => setDeleting(g)}
              onContribute={() => setContributing(g)}
            />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-ink pt-2">Teljesített célok</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {done.map((g) => (
              <Card key={g.id}>
                <div className="flex items-center gap-3">
                  <IconChip icon={g.icon} color={g.color} size={32} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[13px] font-semibold text-ink">{g.name}</h3>
                    <p className="num text-[11.5px] text-muted">{fmtFt(g.target)} · kész</p>
                  </div>
                  <Badge tone="good" icon="check">
                    Teljesítve
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <GoalModal
        open={open}
        onClose={() => {
          setOpen(false)
          setEditing(null)
        }}
        editing={editing}
        suggestedEmergency={Math.round(
          averageCompleteMonths(db, 3).expense * db.settings.emergencyMonths,
        )}
      />
      <ContributeModal goal={contributing} onClose={() => setContributing(null)} />
      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && actions.deleteGoal(deleting.id)}
        title="Cél törlése"
        body={
          deleting
            ? `A(z) „${deleting.name}” cél törlődik. A hozzá tartozó átvezetések megmaradnak a tételek között.`
            : ''
        }
      />
    </div>
  )
}

function GoalCard({
  goal,
  fallbackMonthly,
  onEdit,
  onDelete,
  onContribute,
}: {
  goal: Goal
  fallbackMonthly: number
  onEdit: () => void
  onDelete: () => void
  onContribute: () => void
}) {
  const gf = goalForecast(goal, fallbackMonthly)
  const tone = gf.onTrack === false ? 'warning' : gf.pct >= 100 ? 'good' : 'accent'

  return (
    <Card className="group">
      <div className="flex items-start gap-3">
        <IconChip icon={goal.icon} color={goal.color} size={36} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold text-ink">{goal.name}</h3>
          <p className="text-[11.5px] text-muted">
            {goal.deadline
              ? `Határidő: ${fmtMonthLong(goal.deadline.slice(0, 7))}`
              : 'Nincs határidő'}
          </p>
        </div>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <IconButton label="Szerkesztés" icon="edit" onClick={onEdit} />
          <IconButton label="Törlés" icon="trash" onClick={onDelete} />
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <span className="text-[15px] font-semibold text-ink num">{fmtFt(goal.saved)}</span>
          <span className="text-[12px] text-muted num">{fmtFt(goal.target)}</span>
        </div>
        <Meter value={goal.saved} max={goal.target} tone={tone} height={10} />
        <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[12px]">
          <span className="text-muted">{fmtPct(gf.pct)} kész</span>
          <span className="text-muted num">még {fmtFt(gf.remaining)}</span>
        </div>
      </div>

      <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-[12.5px]">
        <div className="flex justify-between gap-3">
          <span className="text-muted">Havi félretétel</span>
          <span className="text-ink num font-medium">{fmtFt(gf.monthly)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">Ezzel a tempóval</span>
          <span className="text-ink num font-medium">
            {gf.etaKey ? fmtMonthLong(gf.etaKey) : 'nem jön össze'}
          </span>
        </div>
        {gf.requiredMonthly !== null && (
          <div className="flex justify-between gap-3">
            <span className="text-muted">Határidőhöz kell</span>
            <span
              className="num font-medium"
              style={{ color: gf.onTrack === false ? 'var(--critical)' : 'var(--good-text)' }}
            >
              {fmtFt(gf.requiredMonthly)} / hó
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button variant="soft" size="sm" icon="plus" onClick={onContribute} className="flex-1">
          Félreteszek
        </Button>
        {gf.onTrack === false ? (
          <Badge tone="warning" icon="warning">
            Csúszik
          </Badge>
        ) : gf.onTrack === true ? (
          <Badge tone="good" icon="check">
            Tartod
          </Badge>
        ) : null}
      </div>
    </Card>
  )
}

function ContributeModal({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const db = useDB()
  const accounts = db.accounts.filter((a) => !a.archived)
  const [amount, setAmount] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!goal) return
    setAmount(goal.monthly ? String(goal.monthly) : '')
    setFrom(accounts.find((a) => a.type === 'bank')?.id ?? accounts[0]?.id ?? '')
    setTo(
      accounts.find((a) => a.type === 'savings')?.id ?? accounts[1]?.id ?? accounts[0]?.id ?? '',
    )
    setError('')
  }, [goal])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!goal) return
    const value = parseAmount(amount)
    if (value <= 0) return setError('Adj meg egy nullánál nagyobb összeget.')
    if (!from || !to) return setError('Válassz számlákat.')
    if (from === to) return setError('A két számla nem lehet ugyanaz.')
    actions.contributeToGoal(goal.id, value, from, to)
    onClose()
  }

  return (
    <Modal
      open={Boolean(goal)}
      onClose={onClose}
      title={goal ? `Félretétel – ${goal.name}` : ''}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Mégsem
          </Button>
          <Button variant="primary" type="submit" form="contrib-form">
            Félreteszem
          </Button>
        </>
      }
    >
      <form id="contrib-form" onSubmit={submit} className="space-y-4">
        <Field label="Összeg">
          <AmountInput value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Honnan">
            <Select value={from} onChange={(e) => setFrom(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hová">
            <Select value={to} onChange={(e) => setTo(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="text-xs text-muted">
          Ez egy átvezetést rögzít a tételek közé, és növeli a cél teljesítettségét. A teljes
          vagyonod nem változik – csak máshol lesz.
        </p>
        {error && (
          <p className="text-[13px] font-medium" style={{ color: 'var(--critical)' }}>
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}

function GoalModal({
  open,
  onClose,
  editing,
  suggestedEmergency,
}: {
  open: boolean
  onClose: () => void
  editing: Goal | null
  suggestedEmergency: number
}) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<IconKey>(ICONS[0])
  const [color, setColor] = useState(COLORS[0])
  const [target, setTarget] = useState('')
  const [saved, setSaved] = useState('')
  const [monthly, setMonthly] = useState('')
  const [deadline, setDeadline] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setIcon(editing.icon as IconKey)
      setColor(editing.color)
      setTarget(String(editing.target))
      setSaved(String(editing.saved))
      setMonthly(editing.monthly ? String(editing.monthly) : '')
      setDeadline(editing.deadline ?? '')
    } else {
      setName('')
      setIcon(ICONS[0])
      setColor(COLORS[0])
      setTarget('')
      setSaved('')
      setMonthly('')
      setDeadline('')
    }
    setError('')
  }, [open, editing])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = parseAmount(target)
    if (!name.trim()) return setError('Adj nevet a célnak.')
    if (t <= 0) return setError('A célösszeg legyen nullánál nagyobb.')
    const s = parseAmount(saved)
    actions.saveGoal({
      id: editing?.id,
      name: name.trim(),
      icon,
      color,
      target: t,
      saved: s,
      monthly: monthly ? parseAmount(monthly) : undefined,
      deadline: deadline || undefined,
      done: s >= t,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Cél szerkesztése' : 'Új megtakarítási cél'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Mégsem
          </Button>
          <Button variant="primary" type="submit" form="goal-form">
            {editing ? 'Mentés' : 'Létrehozás'}
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={submit} className="space-y-4">
        {!editing && suggestedEmergency > 0 && (
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-sm border border-line bg-panel-2 p-3 text-left transition-colors hover:border-line-strong"
            onClick={() => {
              setName('Vésztartalék')
              setIcon('emergency')
              setTarget(String(suggestedEmergency))
            }}
          >
            <IconChip icon="emergency" color="var(--accent)" size={30} />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium text-ink">
                Vésztartalék · <span className="num">{fmtFt(suggestedEmergency)}</span>
              </span>
              <span className="mt-0.5 block text-[11.5px] text-muted">
                A havi kiadásaid alapján ajánlott összeg – kattints a kitöltéshez.
              </span>
            </span>
          </button>
        )}

        <Field label="Cél neve">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pl. Nyaralás, Új autó"
            autoFocus
          />
        </Field>

        <Field label="Ikon">
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map((i) => (
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
                aria-label={`Ikon: ${i}`}
                aria-pressed={icon === i}
              >
                <Icon name={i} size={15} />
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Célösszeg">
            <AmountInput
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Már félretett">
            <AmountInput value={saved} onChange={(e) => setSaved(e.target.value)} placeholder="0" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Havi félretétel" hint="Üresen hagyva a szabad pénzeddel számolunk.">
            <AmountInput
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Határidő" hint="Nem kötelező.">
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>

        {error && (
          <p className="text-[13px] font-medium" style={{ color: 'var(--critical)' }}>
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
