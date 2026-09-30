import React, { useEffect, useId, useRef } from 'react'
import { clamp } from '../lib/money'
import { Icon, type IconKey } from './icons'

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={`bg-panel border border-line rounded-md ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[13px] font-semibold text-ink leading-snug truncate">{title}</h2>
            )}
            {subtitle && <p className="mt-0.5 text-[12px] text-muted leading-snug">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={`px-4 py-4 ${bodyClassName}`}>{children}</div>
    </section>
  )
}

type ButtonVariant = 'primary' | 'soft' | 'ghost' | 'danger' | 'outline'

export function Button({
  variant = 'soft',
  size = 'md',
  icon,
  className = '',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: IconKey
}) {
  const pad = size === 'sm' ? 'h-[28px] px-2.5 text-[12px]' : 'h-[34px] px-3 text-[13px]'
  return (
    <button {...props} className={`btn btn-${variant} ${pad} ${className}`}>
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 14} />}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  icon,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: IconKey }) {
  return (
    <button
      {...props}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-sm text-ink-2 hover:bg-panel-2 hover:text-ink transition-colors ${className}`}
    >
      <Icon name={icon} size={14} />
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label?: string
  hint?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="eyebrow mb-1.5 block">{label}</span>}
      {children}
      {hint && <span className="mt-1.5 block text-[11.5px] text-muted leading-snug">{hint}</span>}
    </label>
  )
}

export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field text-[13px] ${className}`} />
}

export function Select({
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`field cursor-pointer pr-7 text-[13px] ${className}`}>
      {children}
    </select>
  )
}

export function Textarea({
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`field min-h-16 resize-y py-2 text-[13px] ${className}`} />
}

export function AmountInput({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input
        {...props}
        inputMode="numeric"
        className={`field num pr-8 text-right text-[13px] ${className}`}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted">
        Ft
      </span>
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-[13px] text-ink"
    >
      <span
        className="relative inline-block h-[18px] w-[32px] rounded-sm transition-colors"
        style={{ background: checked ? 'var(--accent)' : 'var(--line-strong)' }}
      >
        <span
          className="absolute top-[3px] h-3 w-3 rounded-[2px] transition-all"
          style={{
            left: checked ? 17 : 3,
            background: checked ? 'var(--on-accent)' : 'var(--panel)',
          }}
        />
      </span>
      {label}
    </button>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex rounded-md border border-line bg-panel-2 p-[2px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-sm font-medium transition-colors ${
            size === 'sm' ? 'h-6 px-2 text-[11.5px]' : 'h-7 px-2.5 text-[12.5px]'
          } ${value === o.value ? 'text-ink' : 'text-muted hover:text-ink-2'}`}
          style={value === o.value ? { background: 'var(--panel-3)' } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export type Tone = 'neutral' | 'good' | 'warning' | 'serious' | 'critical' | 'accent'

export const TONE_COLOR: Record<Tone, string> = {
  neutral: 'var(--ink-3)',
  good: 'var(--good)',
  warning: 'var(--warning)',
  serious: 'var(--serious)',
  critical: 'var(--critical)',
  accent: 'var(--accent)',
}

export function Badge({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: Tone
  icon?: IconKey
  children: React.ReactNode
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-panel-2 px-2 py-[3px] text-[11px] font-medium"
      style={{ color: TONE_COLOR[tone] }}
    >
      {icon ? <Icon name={icon} size={11} /> : <Dot color={TONE_COLOR[tone]} size={6} />}
      <span className="text-ink-2">{children}</span>
    </span>
  )
}
export function Meter({
  value,
  max,
  tone = 'accent',
  height = 6,
  marker,
}: {
  value: number
  max: number
  tone?: Tone
  height?: number
  marker?: number
}) {
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0
  return (
    <div
      className="relative w-full overflow-hidden rounded-[2px]"
      style={{ height, background: 'var(--line)' }}
    >
      <div
        className="h-full rounded-[2px] transition-[width] duration-500"
        style={{ width: `${pct}%`, background: TONE_COLOR[tone] }}
      />
      {marker !== undefined && marker > 0 && marker < 100 && (
        <span
          className="absolute top-0 h-full w-px"
          style={{ left: `${marker}%`, background: 'var(--ink)', opacity: 0.45 }}
        />
      )}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconKey
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-line"
        style={{ background: 'var(--panel-2)', color: 'var(--ink-3)' }}
      >
        <Icon name={icon} size={18} />
      </div>
      <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        className={`rise relative flex max-h-[92vh] w-full flex-col border border-line-strong bg-panel shadow-2xl sm:rounded-md ${width}`}
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
          <h2 id={titleId} className="text-[13px] font-semibold text-ink">
            {title}
          </h2>
          <IconButton label="Bezárás" icon="close" onClick={onClose} />
        </header>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Törlés',
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: string
  confirmLabel?: string
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Mégsem
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-ink-2">{body}</p>
    </Modal>
  )
}

export function Dot({ color, size = 7 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-[1px]"
      style={{ background: color, width: size, height: size }}
    />
  )
}

export function IconChip({
  icon,
  color,
  size = 28,
}: {
  icon: IconKey | string | undefined
  color?: string
  size?: number
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-sm border"
      style={{
        width: size,
        height: size,
        background: 'var(--panel-2)',
        borderColor: 'var(--line)',
        color: color ?? 'var(--ink-2)',
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </span>
  )
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 className="text-[13px] font-semibold text-ink">{children}</h2>
      {action}
    </div>
  )
}

export function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-1.5 last:border-0">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="num text-[12.5px] font-medium text-ink">{value}</span>
    </div>
  )
}
