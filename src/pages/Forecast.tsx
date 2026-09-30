import React, { useMemo, useState } from 'react'
import { useDB } from '../lib/store'
import { buildProjection, firstShortfall, monthReaching, NEUTRAL_SCENARIO } from '../lib/forecast'
import { addMonths, fmtMonthLong, monthRange, startOfMonth } from '../lib/date'
import { fmtFt, fmtFtSigned, parseAmount } from '../lib/money'
import { BalanceChart } from '../components/charts'
import { StatTile } from '../components/StatTile'
import {
  AmountInput,
  Button,
  Card,
  EmptyState,
  Field,
  KeyValue,
  Segmented,
  Select,
  Toggle,
} from '../components/ui'
import { Icon } from '../components/icons'
import type { Scenario } from '../lib/types'

const HORIZONS = [
  { value: '6', label: '6 hó' },
  { value: '12', label: '1 év' },
  { value: '24', label: '2 év' },
  { value: '36', label: '3 év' },
  { value: '60', label: '5 év' },
]

export function Forecast() {
  const db = useDB()
  const [horizon, setHorizon] = useState(String(db.settings.horizonMonths || 12))
  const [sc, setSc] = useState<Scenario>({ ...NEUTRAL_SCENARIO })
  const [targetInput, setTargetInput] = useState('')
  const [showTable, setShowTable] = useState(false)

  const months = Number(horizon)
  const patch = (p: Partial<Scenario>) => setSc((s) => ({ ...s, ...p }))

  const baseline = useMemo(
    () => buildProjection(db, { pastMonths: 3, futureMonths: months }),
    [db, months],
  )
  const scenario = useMemo(
    () => buildProjection(db, { pastMonths: 3, futureMonths: months, scenario: sc }),
    [db, months, sc],
  )

  const modified = Boolean(
    sc.incomeChangePct !== 0 ||
      sc.expenseChangePct !== 0 ||
      sc.extraMonthlySaving !== 0 ||
      (sc.oneOffAmount !== 0 && sc.oneOffMonth) ||
      sc.includeRecurringOnly,
  )

  const last = scenario.points[scenario.points.length - 1]
  const lastBase = baseline.points[baseline.points.length - 1]
  const diff = (last?.balance ?? 0) - (lastBase?.balance ?? 0)

  const target = parseAmount(targetInput)
  const reach = target > 0 ? monthReaching(scenario.points, target) : null
  const reachBase = target > 0 ? monthReaching(baseline.points, target) : null
  const shortfall = firstShortfall(scenario.points)

  const futureMonthOptions = useMemo(
    () => monthRange(addMonths(startOfMonth(new Date()), 1), months),
    [months],
  )

  if (!db.transactions.length && !db.recurring.length) {
    return (
      <Card>
        <EmptyState
          icon="forecast"
          title="Az előrejelzéshez adatok kellenek"
          body="Vedd fel a rendszeres bevételeidet és fix költségeidet – már ennyiből is látszik, hogyan alakul a vagyonod a következő években. A rögzített tényleges tételek tovább pontosítják a képet."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          hero
          label={`Vagyon ${months} hónap múlva`}
          value={fmtFt(last?.balance ?? 0)}
          hint={last ? `${fmtMonthLong(last.key)} végén` : ''}
        />
        <StatTile
          label="Havi félretehető"
          value={fmtFt(Math.max(0, scenario.assumptions.monthlyNet))}
          hint={
            scenario.assumptions.monthlyNet < 0
              ? `Havi ${fmtFt(-scenario.assumptions.monthlyNet)} hiány`
              : 'a forgatókönyv szerint'
          }
          icon="coins"
        />
        <StatTile
          label="Eltérés az alapesettől"
          value={fmtFtSigned(diff)}
          hint={modified ? 'a módosítások hatása' : 'nincs módosítás beállítva'}
          icon="scale"
        />
        <StatTile
          label="Éves félretétel"
          value={fmtFt(Math.max(0, scenario.assumptions.monthlyNet) * 12)}
          hint="ha minden így marad"
          icon="calendar"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card
          title="Vagyon alakulása"
          subtitle={
            modified
              ? 'A szürke vonal mutatja, hol tartanál módosítások nélkül.'
              : 'A szaggatott szakasz a jövőre vonatkozó becslés.'
          }
          action={<Segmented options={HORIZONS} value={horizon} onChange={setHorizon} size="sm" />}
        >
          <BalanceChart
            points={scenario.points}
            baseline={modified ? baseline.points : undefined}
            height={320}
            targetAmount={target > 0 ? target : undefined}
            targetLabel={target > 0 ? `Cél: ${fmtFt(target)}` : undefined}
          />

          {shortfall && (
            <div
              className="mt-4 flex items-start gap-2.5 rounded-sm border bg-panel-2 p-3"
              style={{ borderColor: 'var(--critical)' }}
            >
              <span className="mt-0.5 shrink-0" style={{ color: 'var(--critical)' }}>
                <Icon name="warning" size={15} />
              </span>
              <p className="text-[12.5px] text-ink-2">
                <strong className="text-ink">Figyelem:</strong> ezzel a beállítással{' '}
                {fmtMonthLong(shortfall.key)}ra a vagyonod {fmtFt(shortfall.balance)} lenne. Emeld a
                bevételt, csökkentsd a kiadást, vagy halaszd a nagy egyszeri tételt.
              </p>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Mi lenne, ha…" subtitle="Húzd a csúszkákat, a grafikon azonnal követi">
            <div className="space-y-5">
              <Slider
                label="Bevétel változása"
                value={sc.incomeChangePct}
                onChange={(v) => patch({ incomeChangePct: v })}
                min={-50}
                max={100}
                step={5}
                suffix="%"
                hint={
                  sc.incomeChangePct !== 0
                    ? `Havi ${fmtFtSigned((scenario.assumptions.recurringIncome + scenario.assumptions.variableIncome) * (sc.incomeChangePct / 100))}`
                    : 'Pl. fizetésemelés vagy új mellékállás'
                }
              />
              <Slider
                label="Kiadás változása"
                value={sc.expenseChangePct}
                onChange={(v) => patch({ expenseChangePct: v })}
                min={-50}
                max={50}
                step={5}
                suffix="%"
                hint={
                  sc.expenseChangePct !== 0
                    ? `Havi ${fmtFtSigned((scenario.assumptions.recurringExpense + scenario.assumptions.variableExpense) * (sc.expenseChangePct / 100))}`
                    : 'Pl. tudatosabb költés, drágulás'
                }
              />

              <Field
                label="Havi extra megtakarítás"
                hint="Fix összeg, amit minden hónapban lefaragsz a kiadásaidból."
              >
                <AmountInput
                  value={sc.extraMonthlySaving ? String(sc.extraMonthlySaving) : ''}
                  onChange={(e) => patch({ extraMonthlySaving: parseAmount(e.target.value) })}
                  placeholder="0"
                />
              </Field>

              <div className="space-y-2 border-t border-line pt-4">
                <div className="text-[13px] font-medium text-ink-2">Egyszeri nagy kiadás</div>
                <div className="grid grid-cols-2 gap-2">
                  <AmountInput
                    value={sc.oneOffAmount ? String(sc.oneOffAmount) : ''}
                    onChange={(e) => patch({ oneOffAmount: parseAmount(e.target.value) })}
                    placeholder="0"
                    aria-label="Egyszeri kiadás összege"
                  />
                  <Select
                    value={sc.oneOffMonth ?? ''}
                    onChange={(e) => patch({ oneOffMonth: e.target.value || null })}
                    aria-label="Egyszeri kiadás hónapja"
                  >
                    <option value="">Mikor?</option>
                    {futureMonthOptions.map((m) => (
                      <option key={m} value={m}>
                        {fmtMonthLong(m)}
                      </option>
                    ))}
                  </Select>
                </div>
                <p className="text-xs text-muted">Pl. autó, felújítás, nagyobb utazás.</p>
              </div>

              <div className="border-t border-line pt-4 space-y-3">
                <Toggle
                  checked={sc.includeRecurringOnly}
                  onChange={(v) => patch({ includeRecurringOnly: v })}
                  label="Csak a fix tételekkel számolj"
                />
                <p className="text-xs text-muted">
                  Bekapcsolva a szokásos változó költést (bevásárlás, szórakozás) figyelmen kívül
                  hagyjuk – ez a „legjobb eset”.
                </p>
                {modified && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSc({ ...NEUTRAL_SCENARIO })}
                    className="w-full"
                  >
                    Alaphelyzet visszaállítása
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card title="Mikorra lesz meg?" subtitle="Add meg a célösszeget">
            <AmountInput
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="Pl. 5 000 000"
              aria-label="Célösszeg"
            />
            <div className="mt-3">
              {target <= 0 ? (
                <p className="text-[13px] text-muted">
                  Írj be egy összeget, és megmondom, mikorra jön össze a mostani tempóval.
                </p>
              ) : reach ? (
                <div className="space-y-2">
                  <p className="text-[13px] text-ink-2">
                    A célösszeg <strong className="text-ink">{fmtMonthLong(reach.key)}</strong>{' '}
                    végére jön össze.
                  </p>
                  {modified && reachBase && reachBase.key !== reach.key && (
                    <p className="text-[12px] text-muted">
                      Módosítások nélkül: {fmtMonthLong(reachBase.key)}
                    </p>
                  )}
                  {modified && !reachBase && (
                    <p className="text-[12px] text-muted">
                      Módosítások nélkül {months} hónapon belül nem jönne össze.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-ink-2">
                  A következő {months} hónapban nem jön össze. Próbálj hosszabb horizontot, vagy
                  emeld a havi félretételt.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Miből számoltunk" subtitle="Az előrejelzés alapfeltevései">
          <KeyValue
            label="Rendszeres bevétel"
            value={`${fmtFt(scenario.assumptions.recurringIncome)} / hó`}
          />
          <KeyValue
            label="Rendszeres kiadás"
            value={`${fmtFt(scenario.assumptions.recurringExpense)} / hó`}
          />
          <KeyValue
            label="Egyéb, változó bevétel"
            value={`${fmtFt(scenario.assumptions.variableIncome)} / hó`}
          />
          <KeyValue
            label="Egyéb, változó kiadás"
            value={`${fmtFt(scenario.assumptions.variableExpense)} / hó`}
          />
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-[12px] text-muted leading-relaxed">
              A változó tételeket az utolsó {scenario.assumptions.baseMonths || 0} lezárt hónap
              átlagából becsüljük, a fix tételekkel való dupla számolást kiszűrve. A folyó hónapban
              a már rögzített tételekhez hozzáadjuk a hónapból hátralévő fix kiadásokat és
              bevételeket.
            </p>
          </div>
        </Card>

        <Card
          title="Havi bontás"
          subtitle="Ugyanaz az adat számokban"
          action={
            <Button variant="ghost" size="sm" onClick={() => setShowTable((s) => !s)}>
              {showTable ? 'Elrejtés' : 'Megnyitás'}
            </Button>
          }
        >
          {showTable ? (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-muted text-left">
                    <th className="font-medium py-1.5 pr-3">Hónap</th>
                    <th className="font-medium py-1.5 px-3 text-right">Bevétel</th>
                    <th className="font-medium py-1.5 px-3 text-right">Kiadás</th>
                    <th className="font-medium py-1.5 px-3 text-right">Egyenleg</th>
                    <th className="font-medium py-1.5 pl-3 text-right">Vagyon</th>
                  </tr>
                </thead>
                <tbody>
                  {scenario.points.map((p) => (
                    <tr key={p.key} className="border-t border-line">
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        {fmtMonthLong(p.key)}
                        {!p.actual && !p.current && <span className="text-muted"> · terv</span>}
                      </td>
                      <td className="py-1.5 px-3 text-right num">{fmtFt(p.income)}</td>
                      <td className="py-1.5 px-3 text-right num">{fmtFt(p.expense)}</td>
                      <td
                        className="py-1.5 px-3 text-right num"
                        style={{ color: p.net < 0 ? 'var(--critical)' : 'var(--good-text)' }}
                      >
                        {fmtFtSigned(p.net)}
                      </td>
                      <td className="py-1.5 pl-3 text-right num font-medium">
                        {fmtFt(p.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-muted">
              A táblázat hónapról hónapra mutatja ugyanazokat a számokat, amiket a grafikon rajzol –
              hasznos, ha egy konkrét hónapot keresel.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  suffix?: string
  hint?: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        <span className="text-[13px] font-semibold text-ink num">
          {value > 0 ? '+' : ''}
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-2 w-full accent-balance cursor-pointer"
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
