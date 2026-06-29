import { type HTMLAttributes } from 'react'
import clsx from 'clsx'

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('bg-bg-card border border-border rounded-xl p-6', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
      <span className={clsx('text-2xl font-bold', accent ? 'text-accent' : 'text-text-primary')}>
        {value}
      </span>
      {sub && <span className="text-xs text-text-secondary">{sub}</span>}
    </Card>
  )
}
