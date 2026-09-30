import {
  averageCompleteMonths,
  budgetRows,
  categoryBreakdown,
  categoryMonthlySeries,
  liquidBalance,
  monthBounds,
  savingRate,
} from './analytics'
import { addMonths, fmtMonthLong, monthKey, startOfMonth, toISO } from './date'
import { buildProjection, firstShortfall, goalForecast, monthlyEquivalent } from './forecast'
import { fmtFt, fmtPct, sum } from './money'
import type { DB } from './types'

export type InsightLevel = 'good' | 'info' | 'warning' | 'critical'

export interface Insight {
  id: string
  level: InsightLevel
  icon: string
  title: string
  body: string
  impact?: number
  action?: { label: string; page: string }
}

const LEVEL_WEIGHT: Record<InsightLevel, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  good: 3,
}

export function buildInsights(db: DB): Insight[] {
  const out: Insight[] = []
  const avg = averageCompleteMonths(db, 3)
  const curKey = monthKey(new Date())
  const { settings } = db

  if (db.transactions.length < 3) {
    out.push({
      id: 'no-data',
      level: 'info',
      icon: 'compass',
      title: 'Kezdd el rögzíteni a tételeket',
      body: 'Néhány bevétel és kiadás után itt jelennek meg a személyre szabott javaslatok: hol csorog el a pénz, mennyit tudnál félretenni, és mikorra jön össze egy-egy cél. A Beállításoknál betölthetsz mintaadatot is, ha előbb körbenéznél.',
      action: { label: 'Tétel rögzítése', page: 'transactions' },
    })
    return out
  }

  const rate = savingRate(avg.income, avg.expense)
  if (rate !== null && avg.months > 0) {
    const monthlyNet = avg.net
    if (rate < 0) {
      out.push({
        id: 'rate-negative',
        level: 'critical',
        icon: 'warning',
        title: 'Többet költesz, mint amennyi bevételed van',
        body: `Az utolsó ${avg.months} lezárt hónapban átlagosan ${fmtFt(-monthlyNet)} hiányod keletkezett havonta. Ez éves szinten ${fmtFt(-monthlyNet * 12)} a tartalékodból. Nézd meg a legnagyobb kiadási kategóriákat, és jelölj ki egyet, amit a következő hónapban visszafogsz.`,
        impact: -monthlyNet * 12,
        action: { label: 'Kiadások elemzése', page: 'analytics' },
      })
    } else if (rate < settings.targetSavingRate) {
      const gap = ((settings.targetSavingRate - rate) / 100) * avg.income
      out.push({
        id: 'rate-below-target',
        level: 'warning',
        icon: 'down',
        title: `A megtakarítási rátád ${fmtPct(rate)} – a célod ${settings.targetSavingRate}%`,
        body: `Jelenleg havi ${fmtFt(monthlyNet)} marad nálad. A célhoz havi ${fmtFt(gap)}-tal kellene kevesebbet költened vagy többet keresned; ez évente ${fmtFt(gap * 12)} különbség.`,
        impact: gap * 12,
        action: { label: 'Mi lenne, ha…', page: 'forecast' },
      })
    } else {
      out.push({
        id: 'rate-good',
        level: 'good',
        icon: 'check',
        title: `Erős megtakarítási ráta: ${fmtPct(rate)}`,
        body: `Havonta átlagosan ${fmtFt(monthlyNet)} marad nálad, ami éves szinten ${fmtFt(monthlyNet * 12)}. Ha ezt az összeget célhoz rendeled, sokkal kisebb eséllyel folyik el észrevétlenül.`,
        impact: monthlyNet * 12,
        action: { label: 'Cél létrehozása', page: 'goals' },
      })
    }
  }

  if (avg.expense > 0) {
    const liquid = liquidBalance(db)
    const months = liquid / avg.expense
    const targetAmount = avg.expense * settings.emergencyMonths
    if (months < 3) {
      out.push({
        id: 'emergency-low',
        level: months < 1 ? 'critical' : 'warning',
        icon: 'emergency',
        title: `A tartalékod ${months.toFixed(1)} havi kiadásra elég`,
        body: `${fmtFt(liquid)} szabadon elérhető pénzed van, a havi kiadásod ${fmtFt(avg.expense)}. A ${settings.emergencyMonths} havi vésztartalékhoz ${fmtFt(Math.max(0, targetAmount - liquid))} hiányzik. Ezt érdemes minden más cél elé sorolni.`,
        impact: targetAmount - liquid,
        action: { label: 'Vésztartalék célként', page: 'goals' },
      })
    } else if (months >= settings.emergencyMonths) {
      out.push({
        id: 'emergency-ok',
        level: 'good',
        icon: 'emergency',
        title: `Megvan a ${Math.floor(months)} havi vésztartalék`,
        body: `${fmtFt(liquid)} elérhető pénzed ${months.toFixed(1)} hónapnyi kiadást fedez. Az e feletti részt (${fmtFt(Math.max(0, liquid - targetAmount))}) érdemes hosszabb távra, magasabb hozamú helyre tenni.`,
      })
    }
  }

  const activeRecurring = db.recurring.filter((r) => r.active && r.kind === 'expense')
  if (activeRecurring.length) {
    const fixedMonthly = sum(activeRecurring.map(monthlyEquivalent))
    const share = avg.income > 0 ? (fixedMonthly / avg.income) * 100 : 0
    const smalls = activeRecurring
      .filter((r) => monthlyEquivalent(r) <= 6000)
      .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))
    if (smalls.length >= 3) {
      const smallSum = sum(smalls.map(monthlyEquivalent))
      out.push({
        id: 'subscriptions',
        level: 'info',
        icon: 'phone',
        title: `${smalls.length} apró előfizetés évi ${fmtFt(smallSum * 12)}-ba kerül`,
        body: `Külön-külön elhanyagolhatók (${smalls
          .slice(0, 3)
          .map((r) => r.name)
          .join(', ')}${smalls.length > 3 ? ' és a többi' : ''}), együtt viszont havi ${fmtFt(smallSum)}. Ha ezek feléről lemondanál, évi ${fmtFt(smallSum * 6)} maradna nálad.`,
        impact: smallSum * 6,
        action: { label: 'Fix tételek átnézése', page: 'recurring' },
      })
    }
    if (share > 60) {
      out.push({
        id: 'fixed-heavy',
        level: 'warning',
        icon: 'scale',
        title: `A bevételed ${fmtPct(share)}-át fix költségek viszik el`,
        body: `Havi ${fmtFt(fixedMonthly)} megy el olyan tételekre, amiket nem tudsz egyik hónapról a másikra lefaragni. 50% alatt sokkal rugalmasabb a költségvetés – a legnagyobb tételek újratárgyalása (lakhatás, biztosítás, előfizetések) itt hozza a legtöbbet.`,
        impact: (fixedMonthly - avg.income * 0.5) * 12,
        action: { label: 'Fix tételek', page: 'recurring' },
      })
    }
  }

  const prevKey = monthKey(addMonths(startOfMonth(new Date()), -1))
  for (const cat of db.categories.filter((c) => c.kind === 'expense' && !c.archived)) {
    const series = categoryMonthlySeries(db, cat.id, 4)
    const lastComplete = series.find((s) => s.key === prevKey)?.value ?? 0
    const older = series.filter((s) => s.key !== prevKey && s.key !== curKey)
    if (older.length < 2 || lastComplete < 15_000) continue
    const base = sum(older.map((o) => o.value)) / older.length
    if (base <= 0) continue
    const change = ((lastComplete - base) / base) * 100
    if (change >= 35) {
      out.push({
        id: `spike-${cat.id}`,
        level: 'warning',
        icon: cat.icon,
        title: `${cat.name}: ${fmtPct(change)}-kal többet költöttél`,
        body: `${fmtMonthLong(prevKey)}ban ${fmtFt(lastComplete)} ment el erre, szemben a korábbi ${fmtFt(base)} átlaggal. A különbség havi ${fmtFt(lastComplete - base)}; ha ez tartós marad, évi ${fmtFt((lastComplete - base) * 12)} pluszkiadás.`,
        impact: (lastComplete - base) * 12,
        action: { label: 'Tételek megnézése', page: 'transactions' },
      })
    }
  }

  const { from } = monthBounds(monthKey(addMonths(startOfMonth(new Date()), -3)))
  const to = toISO(new Date())
  const slices = categoryBreakdown(db, 'expense', from, to)
  const top = slices[0]
  if (top && top.value > 0) {
    const monthlyTop = top.value / Math.max(1, avg.months || 3)
    if (monthlyTop >= 10_000) {
      out.push({
        id: 'top-category',
        level: 'info',
        icon: top.icon,
        title: `A legtöbb pénzed a(z) ${top.name} viszi: a kiadásaid ${fmtPct(top.share)}-a`,
        body: `Ez havi ${fmtFt(monthlyTop)}. Egy visszafogott, 10%-os faragás itt havi ${fmtFt(monthlyTop * 0.1)}-ot, egy év alatt ${fmtFt(monthlyTop * 1.2)}-ot jelent – ugyanez az összeg apróbb kategóriákban alig érezhető.`,
        impact: monthlyTop * 1.2,
        action: { label: 'Költségkeret beállítása', page: 'budgets' },
      })
    }
  }

  const budgets = budgetRows(db, curKey)
  const over = budgets.filter((b) => b.state === 'over')
  const risky = budgets.filter((b) => b.state === 'warning')
  if (over.length) {
    const total = sum(over.map((b) => -b.remaining))
    out.push({
      id: 'budget-over',
      level: 'warning',
      icon: 'target',
      title:
        over.length === 1
          ? `Túllépted a keretet: ${over[0].category.name}`
          : `${over.length} kategóriában túllépted a keretet`,
      body: `Összesen ${fmtFt(total)}-tal vagy a havi keret felett (${over
        .map((b) => `${b.category.name} ${fmtFt(-b.remaining)}`)
        .join(', ')}). A hónapból hátralévő időre érdemes visszafogni ezeket.`,
      impact: total * 12,
      action: { label: 'Keretek', page: 'budgets' },
    })
  } else if (risky.length) {
    out.push({
      id: 'budget-risky',
      level: 'info',
      icon: 'hourglass',
      title: `${risky.length} kategória a keret határán`,
      body: `${risky.map((b) => `${b.category.name} (${fmtPct(b.pct)})`).join(', ')} – az idő arányában elvárt ${fmtPct(risky[0].expectedPct)} felett jársz. Még van idő korrigálni a hónapban.`,
      action: { label: 'Keretek', page: 'budgets' },
    })
  }

  const proj = buildProjection(db, { pastMonths: 3, futureMonths: settings.horizonMonths })
  const short = firstShortfall(proj.points)
  if (short) {
    out.push({
      id: 'shortfall',
      level: 'critical',
      icon: 'warning',
      title: `${fmtMonthLong(short.key)}ra elfogyhat a pénzed`,
      body: `A jelenlegi bevételi és kiadási ritmus mellett a vagyonod ekkorra ${fmtFt(short.balance)} lenne. Az előrejelzés oldalon kipróbálhatod, mekkora kiadáscsökkentés vagy bevételnövekedés fordítaná meg a görbét.`,
      action: { label: 'Előrejelzés', page: 'forecast' },
    })
  }

  const monthlyFree = Math.max(0, avg.net)
  for (const goal of db.goals.filter((g) => !g.done)) {
    const gf = goalForecast(goal, monthlyFree)
    if (gf.remaining <= 0) continue
    if (gf.onTrack === false && gf.requiredMonthly !== null) {
      out.push({
        id: `goal-behind-${goal.id}`,
        level: 'warning',
        icon: goal.icon,
        title: `A(z) „${goal.name}" cél csúszik a határidőhöz képest`,
        body: `A határidőig ${gf.monthsToDeadline} hónap van, ehhez havi ${fmtFt(gf.requiredMonthly)} kellene, most viszont ${fmtFt(gf.monthly)}-tal számolunk. Vagy emeld a félretételt havi ${fmtFt(Math.max(0, gf.requiredMonthly - gf.monthly))}-tal, vagy told ki a határidőt ${gf.monthsToGo ?? '?'} hónapra.`,
        action: { label: 'Célok', page: 'goals' },
      })
    } else if (gf.monthsToGo === null) {
      out.push({
        id: `goal-stalled-${goal.id}`,
        level: 'info',
        icon: goal.icon,
        title: `A(z) „${goal.name}" célhoz jelenleg nem jut félretehető pénz`,
        body: `Még ${fmtFt(gf.remaining)} hiányzik, de a havi egyenleged alapján nem marad félretenni való. Állíts be havi összeget a célnál, vagy szabadíts fel keretet a kiadásaidból.`,
        action: { label: 'Célok', page: 'goals' },
      })
    }
  }

  const uncategorized = db.transactions.filter((t) => t.kind !== 'transfer' && !t.categoryId)
  if (uncategorized.length >= 5) {
    out.push({
      id: 'uncategorized',
      level: 'info',
      icon: 'bill',
      title: `${uncategorized.length} besorolatlan tétel`,
      body: `Összesen ${fmtFt(sum(uncategorized.map((t) => t.amount)))} nincs kategóriához rendelve, ezért kimarad az elemzésekből. Néhány perc besorolás sokkal pontosabb képet ad.`,
      action: { label: 'Tételek', page: 'transactions' },
    })
  }

  return out.sort((a, b) => {
    const w = LEVEL_WEIGHT[a.level] - LEVEL_WEIGHT[b.level]
    if (w !== 0) return w
    return Math.abs(b.impact ?? 0) - Math.abs(a.impact ?? 0)
  })
}
