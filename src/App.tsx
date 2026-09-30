import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDB } from './lib/store'
import { totalBalance } from './lib/analytics'
import { fmtFt } from './lib/money'
import { Button } from './components/ui'
import { Icon, type IconKey } from './components/icons'
import { TxModal } from './components/TxForm'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { RecurringPage } from './pages/Recurring'
import { Budgets } from './pages/Budgets'
import { Goals } from './pages/Goals'
import { Forecast } from './pages/Forecast'
import { Analytics } from './pages/Analytics'
import { SettingsPage } from './pages/Settings'

export interface NavItem {
  id: string
  label: string
  icon: IconKey
  group: 'main' | 'plan' | 'system'
}

export const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Áttekintés', icon: 'dashboard', group: 'main' },
  { id: 'transactions', label: 'Tételek', icon: 'list', group: 'main' },
  { id: 'analytics', label: 'Elemzés', icon: 'analyze', group: 'main' },
  { id: 'forecast', label: 'Előrejelzés', icon: 'forecast', group: 'plan' },
  { id: 'goals', label: 'Célok', icon: 'target', group: 'plan' },
  { id: 'budgets', label: 'Keretek', icon: 'budget', group: 'plan' },
  { id: 'recurring', label: 'Fix tételek', icon: 'recurring', group: 'plan' },
  { id: 'settings', label: 'Beállítások', icon: 'settings', group: 'system' },
]

const GROUP_LABEL: Record<NavItem['group'], string> = {
  main: 'Áttekintés',
  plan: 'Tervezés',
  system: 'Egyéb',
}

function pageFromHash(): string {
  const id = window.location.hash.replace(/^#\/?/, '')
  return NAV.some((n) => n.id === id) ? id : 'dashboard'
}

export default function App() {
  const db = useDB()
  const [page, setPage] = useState(pageFromHash)
  const [txOpen, setTxOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onHash = () => {
      setPage(pageFromHash())
      setMenuOpen(false)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((id: string) => {
    window.location.hash = `#/${id}`
    setPage(id)
    setMenuOpen(false)
    window.scrollTo({ top: 0 })
  }, [])

  useEffect(() => {
    const apply = () => {
      const t = db.settings.theme
      const dark =
        t === 'dark' ||
        (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [db.settings.theme])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setTxOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const balance = useMemo(() => totalBalance(db), [db])
  const current = NAV.find((n) => n.id === page)!

  const body = useMemo(() => {
    switch (page) {
      case 'transactions':
        return <Transactions />
      case 'recurring':
        return <RecurringPage />
      case 'budgets':
        return <Budgets />
      case 'goals':
        return <Goals onNavigate={go} />
      case 'forecast':
        return <Forecast />
      case 'analytics':
        return <Analytics />
      case 'settings':
        return <SettingsPage />
      default:
        return <Dashboard onNavigate={go} onAddTx={() => setTxOpen(true)} />
    }
  }, [page, go])

  return (
    <div className="min-h-full bg-ground">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-line bg-panel transition-transform lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-sm"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            <Icon name="compass" size={16} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold leading-tight text-ink">Pénziránytű</div>
            <div className="text-[10.5px] leading-tight text-muted">személyes pénzügyek</div>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
          {(['main', 'plan', 'system'] as const).map((group) => (
            <div key={group}>
              <div className="eyebrow px-2 pb-1.5">{GROUP_LABEL[group]}</div>
              <ul className="space-y-0.5">
                {NAV.filter((n) => n.group === group).map((n) => {
                  const active = page === n.id
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => go(n.id)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex w-full items-center gap-2.5 rounded-sm px-2 py-[7px] text-[13px] font-medium transition-colors ${
                          active ? 'text-ink' : 'text-ink-2 hover:bg-panel-2 hover:text-ink'
                        }`}
                        style={
                          active
                            ? {
                                background: 'var(--panel-2)',
                                boxShadow: 'inset 2px 0 0 var(--accent)',
                              }
                            : undefined
                        }
                      >
                        <span style={{ color: active ? 'var(--accent)' : undefined }}>
                          <Icon name={n.icon} size={15} />
                        </span>
                        {n.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line px-4 py-3">
          <div className="eyebrow">Teljes vagyon</div>
          <div
            className="num text-[17px] font-semibold"
            style={{ color: balance < 0 ? 'var(--critical)' : 'var(--ink)' }}
          >
            {fmtFt(balance)}
          </div>
        </div>
      </aside>

      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
      )}

      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-ground/90 px-4 backdrop-blur sm:px-6">
          <button
            className="-ml-1 flex h-8 w-8 items-center justify-center rounded-sm text-ink-2 hover:bg-panel-2 lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Menü"
          >
            <Icon name="menu" size={16} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-muted lg:hidden">
              <Icon name={current.icon} size={15} />
            </span>
            <h1 className="text-[13px] font-semibold text-ink">{current.label}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="primary" icon="plus" onClick={() => setTxOpen(true)}>
              Új tétel
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">{body}</main>

        <footer className="mx-auto max-w-[1400px] px-4 pb-8 pt-2 sm:px-6">
          <p className="text-[11.5px] text-muted">
            Az adataid csak ebben a böngészőben, a saját gépeden tárolódnak. Rendszeres mentéshez
            használd a{' '}
            <button
              className="underline underline-offset-2 hover:text-ink-2"
              onClick={() => go('settings')}
            >
              Beállítások
            </button>{' '}
            oldal export funkcióját.
          </p>
        </footer>
      </div>

      <TxModal open={txOpen} onClose={() => setTxOpen(false)} />
    </div>
  )
}
